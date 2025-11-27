/**
 * WikiLinkPlugin - Core plugin for wiki-link creation
 *
 * Responsibilities:
 * 1. Detect when user types [[
 * 2. Track the position where autocomplete should appear
 * 3. Insert WikiLinkNode when link is finalized
 * 4. Handle manual link closure with ]]
 * 5. Handle Escape key to cancel
 * 6. Manage autocomplete state and search integration
 * 7. Handle keyboard navigation for autocomplete
 * 8. Render WikiLinkAutocomplete component
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
  $createTextNode,
  createCommand,
  type LexicalCommand,
} from 'lexical';
import { $createWikiLinkNode } from './WikiLinkNode';
import { WikiLinkAutocomplete } from './WikiLinkAutocomplete';
import type { SearchResult } from '@scribe/shared';

/**
 * Command payload for inserting a wiki link.
 * Contains all necessary data captured at the moment of detection,
 * avoiding closure issues with stale state.
 */
export interface InsertWikiLinkPayload {
  linkText: string;
  targetId: string | null;
  startOffset: number;
  anchorKey: string;
}

/**
 * Custom command for inserting wiki links.
 * Using Lexical's command system ensures the operation executes safely
 * without race conditions from setTimeout.
 */
export const INSERT_WIKILINK_COMMAND: LexicalCommand<InsertWikiLinkPayload> =
  createCommand('INSERT_WIKILINK_COMMAND');

export interface WikiLinkPluginProps {
  currentNoteId: string | null;
}

export interface TriggerState {
  isActive: boolean;
  startOffset: number;
  anchorKey: string;
  query: string;
}

export function WikiLinkPlugin({ currentNoteId }: WikiLinkPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [triggerState, setTriggerState] = useState<TriggerState | null>(null);

  // Autocomplete state
  const [autocompleteState, setAutocompleteState] = useState<{
    isOpen: boolean;
    query: string;
    results: SearchResult[];
    selectedIndex: number;
    position: { top: number; left: number };
    isLoading: boolean;
  }>({
    isOpen: false,
    query: '',
    results: [],
    selectedIndex: 0,
    position: { top: 0, left: 0 },
    isLoading: false,
  });

  // Use ref to track whether we just inserted a link to prevent re-triggering
  const justInsertedRef = useRef(false);

  // Ref for debounced search timeout
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Perform search with debouncing
  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setAutocompleteState((s) => ({ ...s, results: [], isLoading: false }));
        return;
      }

      setAutocompleteState((s) => ({ ...s, isLoading: true }));

      try {
        const results = await window.scribe.notes.searchTitles(query, 10);
        // Filter out current note
        const filtered = results.filter((r) => r.id !== currentNoteId);
        setAutocompleteState((s) => ({
          ...s,
          results: filtered,
          selectedIndex: 0,
          isLoading: false,
        }));
      } catch (error) {
        console.error('Search failed:', error);
        setAutocompleteState((s) => ({ ...s, results: [], isLoading: false }));
      }
    },
    [currentNoteId]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle closing autocomplete
  const handleCancel = useCallback(() => {
    setAutocompleteState((s) => ({
      ...s,
      isOpen: false,
      query: '',
      results: [],
      selectedIndex: 0,
    }));
  }, []);

  // Register command handler for inserting wiki links
  // This handles the actual insertion logic with all data passed via payload,
  // avoiding race conditions from stale closure state
  useEffect(() => {
    return editor.registerCommand(
      INSERT_WIKILINK_COMMAND,
      (payload: InsertWikiLinkPayload) => {
        const { linkText, targetId, startOffset, anchorKey } = payload;

        // Set flag to prevent re-triggering detection
        justInsertedRef.current = true;

        // Parse alias syntax: "note title|display text" (last pipe wins)
        const pipeIndex = linkText.lastIndexOf('|');
        let noteTitle: string;
        let displayText: string;

        if (pipeIndex > 0) {
          noteTitle = linkText.slice(0, pipeIndex).trim();
          displayText = linkText.slice(pipeIndex + 1).trim();
        } else {
          noteTitle = linkText.trim();
          displayText = noteTitle;
        }

        if (!noteTitle) {
          justInsertedRef.current = false;
          return true;
        }

        const anchorNode = $getNodeByKey(anchorKey);
        if (anchorNode instanceof TextNode) {
          const text = anchorNode.getTextContent();
          const selection = $getSelection();
          const currentOffset = $isRangeSelection(selection)
            ? selection.anchor.offset
            : text.length;

          const before = text.slice(0, startOffset);
          const after = text.slice(currentOffset);

          // Create wiki-link node
          const wikiLinkNode = $createWikiLinkNode(noteTitle, displayText, targetId);

          // Replace text: set content before [[, insert node, add content after
          anchorNode.setTextContent(before);
          anchorNode.insertAfter(wikiLinkNode);

          if (after) {
            const afterNode = $createTextNode(after);
            wikiLinkNode.insertAfter(afterNode);
            afterNode.select(0, 0);
          } else {
            // Add a space after the link for continued typing
            const spaceNode = $createTextNode(' ');
            wikiLinkNode.insertAfter(spaceNode);
            spaceNode.select(1, 1);
          }
        }

        setTriggerState(null);
        handleCancel();

        // Reset flag after a short delay
        setTimeout(() => {
          justInsertedRef.current = false;
        }, 100);

        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, handleCancel]);

  // Insert wiki-link when called (by autocomplete selection or ]] closure)
  // This is a convenience wrapper that dispatches the command with the current trigger state
  const insertWikiLink = useCallback(
    (linkText: string, targetId: string | null = null) => {
      if (!triggerState) return;

      editor.dispatchCommand(INSERT_WIKILINK_COMMAND, {
        linkText,
        targetId,
        startOffset: triggerState.startOffset,
        anchorKey: triggerState.anchorKey,
      });
    },
    [editor, triggerState]
  );

  // Handle selection from autocomplete
  const handleSelect = useCallback(
    (result: SearchResult) => {
      insertWikiLink(result.title || '', result.id);
    },
    [insertWikiLink]
  );

  // Key detection logic - monitor text changes
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      // Skip if we just inserted a link
      if (justInsertedRef.current) return;

      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();

        if (!(anchorNode instanceof TextNode)) return;

        const text = anchorNode.getTextContent();
        const offset = anchor.offset;

        // Check for [[ pattern (only when not already tracking)
        if (!triggerState && offset >= 2 && text.slice(offset - 2, offset) === '[[') {
          // Start tracking
          const domNode = editor.getElementByKey(anchorNode.getKey());
          if (domNode) {
            const rect = domNode.getBoundingClientRect();
            // Calculate approximate cursor position
            // Use getComputedStyle to get more accurate character width
            const computedStyle = window.getComputedStyle(domNode);
            const fontSize = parseFloat(computedStyle.fontSize) || 16;
            const charWidth = fontSize * 0.6; // Approximate character width ratio

            const position = {
              top: rect.bottom + 4, // Small gap below the line
              left: rect.left + offset * charWidth,
            };

            // Open autocomplete
            setAutocompleteState((s) => ({
              ...s,
              isOpen: true,
              query: '',
              results: [],
              selectedIndex: 0,
              position,
            }));

            setTriggerState({
              isActive: true,
              startOffset: offset - 2,
              anchorKey: anchorNode.getKey(),
              query: '',
            });
          }
          return;
        }

        // If tracking, update query
        if (triggerState?.isActive && anchorNode.getKey() === triggerState.anchorKey) {
          const query = text.slice(triggerState.startOffset + 2, offset);

          // Check for ]] closure
          if (query.endsWith(']]')) {
            const linkText = query.slice(0, -2);
            if (linkText) {
              // Dispatch command with all necessary data captured now.
              // Using the command system ensures the update executes safely
              // after the read completes, without race conditions from setTimeout.
              editor.dispatchCommand(INSERT_WIKILINK_COMMAND, {
                linkText,
                targetId: null,
                startOffset: triggerState.startOffset,
                anchorKey: triggerState.anchorKey,
              });
            }
            return;
          }

          // Update query if changed
          if (query !== triggerState.query) {
            setTriggerState((prev) => (prev ? { ...prev, query } : null));
            setAutocompleteState((s) => ({ ...s, query }));

            // Debounced search
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
            }
            searchTimeoutRef.current = setTimeout(() => {
              performSearch(query);
            }, 150);
          }
        }

        // If we moved to a different node, cancel tracking
        if (triggerState?.isActive && anchorNode.getKey() !== triggerState.anchorKey) {
          setTriggerState(null);
          handleCancel();
        }
      });
    });
  }, [editor, triggerState, performSearch, handleCancel]);

  // Escape key handling
  useEffect(() => {
    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        if (triggerState?.isActive) {
          // Remove [[ text and cancel
          editor.update(() => {
            const node = $getNodeByKey(triggerState.anchorKey);
            if (node instanceof TextNode) {
              const text = node.getTextContent();
              const endOffset = triggerState.startOffset + 2 + triggerState.query.length;
              const newText = text.slice(0, triggerState.startOffset) + text.slice(endOffset);
              node.setTextContent(newText);

              // Move cursor to where [[ was
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                node.select(triggerState.startOffset, triggerState.startOffset);
              }
            }
          });
          setTriggerState(null);
          handleCancel();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, triggerState, handleCancel]);

  // Keyboard navigation for autocomplete
  useEffect(() => {
    if (!autocompleteState.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setAutocompleteState((s) => ({
            ...s,
            selectedIndex: Math.min(s.selectedIndex + 1, s.results.length - 1),
          }));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setAutocompleteState((s) => ({
            ...s,
            selectedIndex: Math.max(s.selectedIndex - 1, 0),
          }));
          break;
        case 'Tab':
        case 'Enter':
          if (autocompleteState.results.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            const selected = autocompleteState.results[autocompleteState.selectedIndex];
            if (selected) {
              handleSelect(selected);
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [
    autocompleteState.isOpen,
    autocompleteState.selectedIndex,
    autocompleteState.results,
    handleSelect,
  ]);

  // Expose insertWikiLink for external use (by autocomplete)
  // This is done by attaching to the editor instance
  useEffect(() => {
    // Store the callback on editor for WikiLinkAutocomplete to access
    (editor as unknown as { __wikiLinkInsert?: typeof insertWikiLink }).__wikiLinkInsert =
      insertWikiLink;
    (editor as unknown as { __wikiLinkTriggerState?: TriggerState | null }).__wikiLinkTriggerState =
      triggerState;

    return () => {
      delete (editor as unknown as { __wikiLinkInsert?: typeof insertWikiLink }).__wikiLinkInsert;
      delete (editor as unknown as { __wikiLinkTriggerState?: TriggerState | null })
        .__wikiLinkTriggerState;
    };
  }, [editor, insertWikiLink, triggerState]);

  return (
    <WikiLinkAutocomplete
      isOpen={autocompleteState.isOpen}
      query={autocompleteState.query}
      position={autocompleteState.position}
      results={autocompleteState.results}
      selectedIndex={autocompleteState.selectedIndex}
      onSelect={handleSelect}
      onClose={handleCancel}
      isLoading={autocompleteState.isLoading}
    />
  );
}
