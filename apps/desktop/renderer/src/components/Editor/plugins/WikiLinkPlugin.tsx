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
 *
 * Uses the shared useTriggerableAutocomplete hook for common autocomplete patterns.
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useCallback, useRef } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  $getNodeByKey,
  TextNode,
  COMMAND_PRIORITY_LOW,
  $createTextNode,
  createCommand,
  type LexicalCommand,
} from 'lexical';
import { createLogger } from '@scribe/shared';
import { $createWikiLinkNode } from './WikiLinkNode';

const log = createLogger({ prefix: 'WikiLinkPlugin' });
import { WikiLinkAutocomplete } from './WikiLinkAutocomplete';
import {
  useTriggerableAutocomplete,
  useAutocompleteKeyboardNavigation,
  type TriggerState,
} from '../hooks';
import type { SearchResult, NoteId } from '@scribe/shared';

/**
 * Command payload for inserting a wiki link.
 * Contains all necessary data captured at the moment of detection,
 * avoiding closure issues with stale state.
 */
export interface InsertWikiLinkPayload {
  linkText: string;
  targetId: NoteId | null;
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

// Re-export TriggerState for backward compatibility
export type { TriggerState };

export function WikiLinkPlugin({ currentNoteId }: WikiLinkPluginProps) {
  const [editor] = useLexicalComposerContext();

  // Ref for debounced search timeout
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Perform search with debouncing
  const performSearch = useCallback(
    async (
      query: string,
      setResults: (results: SearchResult[]) => void,
      setLoading: (loading: boolean) => void
    ) => {
      if (!query.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const results = await window.scribe.notes.searchTitles(query, 10);
        // Filter out current note
        const filtered = results.filter((r) => r.id !== currentNoteId);
        setResults(filtered);
        setLoading(false);
      } catch (error) {
        log.error('Search failed', { query, error });
        setResults([]);
        setLoading(false);
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

  // Use the shared triggerable autocomplete hook
  const { state, actions, triggerState } = useTriggerableAutocomplete<SearchResult>({
    triggerPattern: '[[',
    closurePattern: ']]',
    onTriggerStart: () => {
      // Autocomplete opened - state is managed by the hook
    },
    onQueryChange: (query) => {
      // Debounced search
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(query, actions.setResults, actions.setLoading);
      }, 150);
    },
    onClose: () => {
      // Cleanup on close
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    },
    onClosureDetected: (linkText, currentTriggerState) => {
      // Handle ]] closure - dispatch command with captured state
      if (linkText) {
        editor.dispatchCommand(INSERT_WIKILINK_COMMAND, {
          linkText,
          targetId: null,
          startOffset: currentTriggerState.startOffset,
          anchorKey: currentTriggerState.anchorKey,
        });
      }
    },
  });

  // Register command handler for inserting wiki links
  useEffect(() => {
    return editor.registerCommand(
      INSERT_WIKILINK_COMMAND,
      (payload: InsertWikiLinkPayload) => {
        const { linkText, targetId, startOffset, anchorKey } = payload;

        // Signal insertion to prevent re-triggering
        actions.markInserted();

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

        actions.clearTriggerState();
        actions.close();

        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, actions]);

  // Insert wiki-link when called (by autocomplete selection)
  const insertWikiLink = useCallback(
    (linkText: string, targetId: NoteId | null = null) => {
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

  // Keyboard navigation using shared hook
  const handleKeyboardSelect = useCallback(() => {
    if (state.results.length > 0) {
      const selected = state.results[state.selectedIndex];
      if (selected) {
        handleSelect(selected);
      }
    }
  }, [state.results, state.selectedIndex, handleSelect]);

  useAutocompleteKeyboardNavigation(
    state.isOpen,
    state.selectedIndex,
    state.results.length,
    handleKeyboardSelect,
    actions
  );

  return (
    <WikiLinkAutocomplete
      isOpen={state.isOpen}
      query={state.query}
      position={state.position}
      results={state.results}
      selectedIndex={state.selectedIndex}
      onSelect={handleSelect}
      onClose={actions.close}
      isLoading={state.isLoading}
    />
  );
}
