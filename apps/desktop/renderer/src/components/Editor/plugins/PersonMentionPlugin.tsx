/**
 * PersonMentionPlugin - Core plugin for person mention creation
 *
 * Responsibilities:
 * 1. Detect when user types @
 * 2. Track the position where autocomplete should appear
 * 3. Insert PersonMentionNode when person is selected
 * 4. Handle Escape key to cancel
 * 5. Manage autocomplete state and search integration
 * 6. Handle keyboard navigation for autocomplete
 * 7. Handle person creation when no match exists
 * 8. Render PersonMentionAutocomplete component
 *
 * Uses the shared useTriggerableAutocomplete hook for common autocomplete patterns.
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { $createPersonMentionNode } from './PersonMentionNode';

const log = createLogger({ prefix: 'PersonMentionPlugin' });
import { usePersonMentionContext } from './PersonMentionContext';
import { PersonMentionAutocomplete } from './PersonMentionAutocomplete';
import type { PersonResult } from './PersonMentionAutocomplete';
import { useTriggerableAutocomplete, useClickOutside, type TriggerState } from '../hooks';
import type { NoteId } from '@scribe/shared';

/**
 * Command payload for inserting a person mention.
 * Contains all necessary data captured at the moment of detection,
 * avoiding closure issues with stale state.
 */
export interface InsertPersonMentionPayload {
  personName: string;
  personId: NoteId;
  startOffset: number;
  anchorKey: string;
}

/**
 * Custom command for inserting person mentions.
 * Using Lexical's command system ensures the operation executes safely
 * without race conditions from setTimeout.
 */
export const INSERT_PERSON_MENTION_COMMAND: LexicalCommand<InsertPersonMentionPayload> =
  createCommand('INSERT_PERSON_MENTION_COMMAND');

export interface PersonMentionPluginProps {
  currentNoteId: NoteId | null; // For excluding self from autocomplete
}

// Re-export TriggerState for backward compatibility
export type { TriggerState };

export function PersonMentionPlugin({ currentNoteId }: PersonMentionPluginProps) {
  const [editor] = useLexicalComposerContext();
  const { onError } = usePersonMentionContext();

  // Track results and metadata for keyboard navigation
  const resultsRef = useRef<PersonResult[]>([]);
  const hasExactMatchRef = useRef(false);

  // Validate @ trigger - must be at start of text or preceded by whitespace
  const validateTrigger = useCallback((charBefore: string | null): boolean => {
    return charBefore === null || charBefore === ' ' || charBefore === '\n';
  }, []);

  // Use the shared triggerable autocomplete hook
  const { state, actions, triggerState } = useTriggerableAutocomplete<PersonResult>({
    triggerPattern: '@',
    validateTrigger,
    onTriggerStart: () => {
      // Autocomplete opened - state is managed by the hook
    },
    onQueryChange: () => {
      // Query changes are handled by the autocomplete component's internal search
      // Reset selection when query changes
      actions.resetSelection();
    },
    onClose: () => {
      // Cleanup on close
    },
  });

  // Register command handler for inserting person mentions
  useEffect(() => {
    return editor.registerCommand(
      INSERT_PERSON_MENTION_COMMAND,
      (payload: InsertPersonMentionPayload) => {
        const { personName, personId, startOffset, anchorKey } = payload;

        // Signal insertion to prevent re-triggering
        actions.markInserted();

        if (!personName) {
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

          // Create person mention node
          const personMentionNode = $createPersonMentionNode(personName, personId);

          // Replace text: set content before @, insert node, add content after
          anchorNode.setTextContent(before);
          anchorNode.insertAfter(personMentionNode);

          if (after) {
            const afterNode = $createTextNode(after);
            personMentionNode.insertAfter(afterNode);
            afterNode.select(0, 0);
          } else {
            // Add a space after the mention for continued typing
            const spaceNode = $createTextNode(' ');
            personMentionNode.insertAfter(spaceNode);
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

  // Insert person mention when called (by autocomplete selection)
  const insertPersonMention = useCallback(
    (personName: string, personId: NoteId) => {
      if (!triggerState) return;

      editor.dispatchCommand(INSERT_PERSON_MENTION_COMMAND, {
        personName,
        personId,
        startOffset: triggerState.startOffset,
        anchorKey: triggerState.anchorKey,
      });
    },
    [editor, triggerState]
  );

  // Handle selection from autocomplete
  const handleSelect = useCallback(
    (person: PersonResult) => {
      insertPersonMention(person.name, person.id);
    },
    [insertPersonMention]
  );

  // Handle create new person
  const handleCreate = useCallback(
    async (name: string) => {
      try {
        // Create the person via API
        const newPerson = await window.scribe.people.create(name);
        // Insert the mention with the new person's ID (using explicit title field)
        insertPersonMention(newPerson.title || name, newPerson.id);
      } catch (error) {
        log.error('Failed to create person', { name, error });
        // Show error to user via context
        onError(`Failed to create "${name}"`);
        // Close autocomplete on error
        actions.close();
      }
    },
    [insertPersonMention, actions, onError]
  );

  // Callback to receive results from autocomplete for keyboard navigation
  const handleResultsChange = useCallback((results: PersonResult[], hasExactMatch: boolean) => {
    resultsRef.current = results;
    hasExactMatchRef.current = hasExactMatch;
  }, []);

  // Keyboard navigation for autocomplete
  // PersonMention has special handling for "create" option, so we implement custom navigation
  useEffect(() => {
    if (!state.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const results = resultsRef.current;
      const showCreateOption = state.query.trim().length > 0 && !hasExactMatchRef.current;
      const totalItems = results.length + (showCreateOption ? 1 : 0);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          actions.selectNext(totalItems - 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          actions.selectPrevious();
          break;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          // Handle selection based on selectedIndex
          if (state.selectedIndex < results.length) {
            const person = results[state.selectedIndex];
            if (person) {
              handleSelect(person);
            }
          } else if (showCreateOption && state.selectedIndex === results.length) {
            handleCreate(state.query.trim());
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [state.isOpen, state.selectedIndex, state.query, handleSelect, handleCreate, actions]);

  // Handle click outside to close
  useClickOutside(state.isOpen, actions.close, '[role="listbox"]');

  // Render autocomplete using portal
  if (!state.isOpen) return null;

  return createPortal(
    <PersonMentionAutocomplete
      query={state.query}
      position={state.position}
      selectedIndex={state.selectedIndex}
      onSelect={handleSelect}
      onCreate={handleCreate}
      currentNoteId={currentNoteId}
      onResultsChange={handleResultsChange}
    />,
    document.body
  );
}
