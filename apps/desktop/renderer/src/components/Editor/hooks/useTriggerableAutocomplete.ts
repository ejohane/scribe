/**
 * useTriggerableAutocomplete Hook
 *
 * A shared hook for creating triggerable autocomplete experiences in Lexical.
 * Used by WikiLinkPlugin ([[) and PersonMentionPlugin (@) to reduce code duplication.
 *
 * Features:
 * - Configurable trigger pattern detection
 * - Query extraction and state management
 * - Keyboard navigation (ArrowUp/Down/Enter/Tab)
 * - Escape key handling with text cleanup
 * - Position calculation for floating menus
 * - Insertion tracking to prevent re-triggering
 *
 * @module hooks/useTriggerableAutocomplete
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useCallback, useState, useRef } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  $getNodeByKey,
  TextNode,
  COMMAND_PRIORITY_LOW,
  KEY_ESCAPE_COMMAND,
} from 'lexical';

// Re-export the extracted hooks for convenience
export { useClickOutside } from './useClickOutside';
export {
  useAutocompleteKeyboardNavigation,
  type KeyboardNavigationActions,
} from './useAutocompleteKeyboard';

/**
 * State tracking the active trigger in the editor.
 */
export interface TriggerState {
  /** Whether a trigger is currently active */
  isActive: boolean;
  /** Character offset where the trigger started (before the trigger pattern) */
  startOffset: number;
  /** Key of the text node containing the trigger */
  anchorKey: string;
  /** Current query text after the trigger pattern */
  query: string;
}

/**
 * Configuration options for the triggerable autocomplete hook.
 */
export interface TriggerableAutocompleteConfig {
  /**
   * The trigger pattern to detect (e.g., '[[' for wiki links, '@' for mentions).
   */
  triggerPattern: string;

  /**
   * Optional validation function to check if the trigger is valid in context.
   * For example, @ mentions require whitespace or start of line before the trigger.
   * @param textBeforeTrigger - Character immediately before the trigger (or null if at start)
   * @returns true if the trigger is valid
   */
  validateTrigger?: (textBeforeTrigger: string | null) => boolean;

  /**
   * Callback when a trigger is detected and autocomplete should open.
   * @param position - Calculated position for the floating menu
   * @param triggerState - The current trigger state
   */
  onTriggerStart: (position: { top: number; left: number }, triggerState: TriggerState) => void;

  /**
   * Callback when the query changes while autocomplete is open.
   * @param query - The updated query string
   */
  onQueryChange: (query: string) => void;

  /**
   * Callback when autocomplete should close (escape pressed or moved away).
   */
  onClose: () => void;

  /**
   * Optional closure pattern that ends the autocomplete and triggers insertion.
   * For example, ']]' for wiki links.
   * If provided, typing this pattern will call onClosureDetected.
   */
  closurePattern?: string;

  /**
   * Callback when the closure pattern is detected.
   * @param query - The query text (without the closure pattern)
   * @param triggerState - The current trigger state
   */
  onClosureDetected?: (query: string, triggerState: TriggerState) => void;
}

/**
 * State returned by the hook for managing autocomplete UI.
 */
export interface AutocompleteState<T> {
  /** Whether the autocomplete menu is open */
  isOpen: boolean;
  /** Current query string */
  query: string;
  /** Search results */
  results: T[];
  /** Currently selected index in results */
  selectedIndex: number;
  /** Position for the floating menu */
  position: { top: number; left: number };
  /** Whether a search is in progress */
  isLoading: boolean;
}

/**
 * Actions for updating autocomplete state.
 */
export interface AutocompleteActions<T> {
  /** Set the search results */
  setResults: (results: T[]) => void;
  /** Set loading state */
  setLoading: (isLoading: boolean) => void;
  /** Move selection up */
  selectPrevious: () => void;
  /** Move selection down */
  selectNext: (maxIndex: number) => void;
  /** Reset selection to first item */
  resetSelection: () => void;
  /** Close the autocomplete */
  close: () => void;
  /** Signal that an insertion just occurred (prevents re-triggering) */
  markInserted: () => void;
  /** Get the current trigger state */
  getTriggerState: () => TriggerState | null;
  /** Clear the trigger state after insertion */
  clearTriggerState: () => void;
}

/**
 * Return type of useTriggerableAutocomplete hook.
 */
export interface UseTriggerableAutocompleteReturn<T> {
  /** Current autocomplete state */
  state: AutocompleteState<T>;
  /** Actions for updating state */
  actions: AutocompleteActions<T>;
  /** Current trigger state (for insertion logic) */
  triggerState: TriggerState | null;
}

/**
 * Hook for creating triggerable autocomplete experiences in Lexical.
 *
 * @example
 * ```tsx
 * const { state, actions, triggerState } = useTriggerableAutocomplete<SearchResult>({
 *   triggerPattern: '[[',
 *   closurePattern: ']]',
 *   onTriggerStart: (position) => { ... },
 *   onQueryChange: (query) => performSearch(query),
 *   onClose: () => { ... },
 *   onClosureDetected: (query, triggerState) => insertWikiLink(query),
 * });
 * ```
 */
export function useTriggerableAutocomplete<T>(
  config: TriggerableAutocompleteConfig
): UseTriggerableAutocompleteReturn<T> {
  const [editor] = useLexicalComposerContext();
  const [triggerState, setTriggerState] = useState<TriggerState | null>(null);

  // Autocomplete UI state
  const [autocompleteState, setAutocompleteState] = useState<AutocompleteState<T>>({
    isOpen: false,
    query: '',
    results: [],
    selectedIndex: 0,
    position: { top: 0, left: 0 },
    isLoading: false,
  });

  // Use ref to track whether we just inserted to prevent re-triggering
  // Counter-based approach handles rapid insertions safely
  const insertionCounterRef = useRef(0);
  const lastProcessedCounterRef = useRef(0);

  // Use ref for triggerState to avoid re-registering update listener on every change
  const triggerStateRef = useRef(triggerState);
  triggerStateRef.current = triggerState;

  // Store config in ref to avoid re-registering listeners on config changes
  const configRef = useRef(config);
  configRef.current = config;

  /**
   * Calculate position for the floating menu based on cursor location.
   */
  const calculatePosition = useCallback(
    (domNode: HTMLElement, offset: number): { top: number; left: number } => {
      // Try to use browser selection API for accurate cursor position
      const domSelection = window.getSelection();

      if (domSelection && domSelection.rangeCount > 0) {
        const range = domSelection.getRangeAt(0);
        const rangeRect = range.getBoundingClientRect();

        // Use range bounding rect for accurate position
        if (rangeRect.width > 0 || rangeRect.height > 0) {
          return {
            top: rangeRect.bottom + 4, // Small gap below cursor
            left: rangeRect.left,
          };
        }
      }

      // Fallback: use domNode rect with character width estimation
      const rect = domNode.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(domNode);
      const fontSize = parseFloat(computedStyle.fontSize) || 16;
      const charWidth = fontSize * 0.6; // Approximate character width ratio

      return {
        top: rect.bottom + 4,
        left: rect.left + offset * charWidth,
      };
    },
    []
  );

  /**
   * Close autocomplete and reset state.
   */
  const handleClose = useCallback(() => {
    setAutocompleteState((s) => ({
      ...s,
      isOpen: false,
      query: '',
      results: [],
      selectedIndex: 0,
    }));
    setTriggerState(null);
    configRef.current.onClose();
  }, []);

  /**
   * Key detection logic - monitor text changes for trigger pattern.
   */
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      // Skip if we just inserted (counter hasn't been processed yet)
      if (insertionCounterRef.current !== lastProcessedCounterRef.current) return;

      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();

        if (!(anchorNode instanceof TextNode)) return;

        const text = anchorNode.getTextContent();
        const offset = anchor.offset;

        const currentTriggerState = triggerStateRef.current;
        const cfg = configRef.current;
        const triggerLen = cfg.triggerPattern.length;

        // Check for trigger pattern (only when not already tracking)
        if (
          !currentTriggerState &&
          offset >= triggerLen &&
          text.slice(offset - triggerLen, offset) === cfg.triggerPattern
        ) {
          // Validate trigger if validator provided
          const charBefore = offset > triggerLen ? text[offset - triggerLen - 1] : null;
          const isValidTrigger = cfg.validateTrigger ? cfg.validateTrigger(charBefore) : true;

          if (isValidTrigger) {
            // Start tracking
            const domNode = editor.getElementByKey(anchorNode.getKey());
            if (domNode) {
              const position = calculatePosition(domNode, offset);

              const newTriggerState: TriggerState = {
                isActive: true,
                startOffset: offset - triggerLen,
                anchorKey: anchorNode.getKey(),
                query: '',
              };

              setTriggerState(newTriggerState);
              setAutocompleteState((s) => ({
                ...s,
                isOpen: true,
                query: '',
                results: [],
                selectedIndex: 0,
                position,
              }));

              cfg.onTriggerStart(position, newTriggerState);
            }
            return;
          }
        }

        // If tracking, update query
        if (
          currentTriggerState?.isActive &&
          anchorNode.getKey() === currentTriggerState.anchorKey
        ) {
          const query = text.slice(currentTriggerState.startOffset + triggerLen, offset);

          // Check for closure pattern if configured
          if (cfg.closurePattern && cfg.onClosureDetected && query.endsWith(cfg.closurePattern)) {
            const linkText = query.slice(0, -cfg.closurePattern.length);
            if (linkText) {
              cfg.onClosureDetected(linkText, currentTriggerState);
            }
            return;
          }

          // Update query if changed
          if (query !== currentTriggerState.query) {
            setTriggerState((prev) => (prev ? { ...prev, query } : null));
            setAutocompleteState((s) => ({ ...s, query, selectedIndex: 0 }));
            cfg.onQueryChange(query);
          }
        }

        // If we moved to a different node, cancel tracking
        if (
          currentTriggerState?.isActive &&
          anchorNode.getKey() !== currentTriggerState.anchorKey
        ) {
          handleClose();
        }
      });
    });
  }, [editor, calculatePosition, handleClose]);

  /**
   * Escape key handling - remove trigger text and close.
   */
  useEffect(() => {
    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        const currentTriggerState = triggerStateRef.current;
        if (currentTriggerState?.isActive) {
          // Remove trigger text and query
          editor.update(() => {
            const node = $getNodeByKey(currentTriggerState.anchorKey);
            if (node instanceof TextNode) {
              const text = node.getTextContent();
              const triggerLen = configRef.current.triggerPattern.length;
              const endOffset =
                currentTriggerState.startOffset + triggerLen + currentTriggerState.query.length;
              const newText =
                text.slice(0, currentTriggerState.startOffset) + text.slice(endOffset);
              node.setTextContent(newText);

              // Move cursor to where trigger was
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                node.select(currentTriggerState.startOffset, currentTriggerState.startOffset);
              }
            }
          });
          handleClose();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, handleClose]);

  /**
   * Actions for updating autocomplete state.
   */
  const actions: AutocompleteActions<T> = {
    setResults: useCallback((results: T[]) => {
      setAutocompleteState((s) => ({ ...s, results, selectedIndex: 0 }));
    }, []),

    setLoading: useCallback((isLoading: boolean) => {
      setAutocompleteState((s) => ({ ...s, isLoading }));
    }, []),

    selectPrevious: useCallback(() => {
      setAutocompleteState((s) => ({
        ...s,
        selectedIndex: Math.max(s.selectedIndex - 1, 0),
      }));
    }, []),

    selectNext: useCallback((maxIndex: number) => {
      setAutocompleteState((s) => ({
        ...s,
        selectedIndex: Math.min(s.selectedIndex + 1, maxIndex),
      }));
    }, []),

    resetSelection: useCallback(() => {
      setAutocompleteState((s) => ({ ...s, selectedIndex: 0 }));
    }, []),

    close: handleClose,

    markInserted: useCallback(() => {
      insertionCounterRef.current += 1;
      // Update processed counter on next animation frame
      requestAnimationFrame(() => {
        lastProcessedCounterRef.current = insertionCounterRef.current;
      });
    }, []),

    getTriggerState: useCallback(() => triggerStateRef.current, []),

    clearTriggerState: useCallback(() => {
      setTriggerState(null);
    }, []),
  };

  return {
    state: autocompleteState,
    actions,
    triggerState,
  };
}

// Note: useAutocompleteKeyboardNavigation and useClickOutside have been
// extracted to separate files for reusability. They are re-exported above
// from ./useAutocompleteKeyboard and ./useClickOutside respectively.
