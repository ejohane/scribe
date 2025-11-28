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
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useCallback, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { $createPersonMentionNode } from './PersonMentionNode';
import { usePersonMentionContext } from './PersonMentionContext';
import { PersonMentionAutocomplete } from './PersonMentionAutocomplete';
import type { PersonResult } from './PersonMentionAutocomplete';
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

export interface TriggerState {
  isActive: boolean;
  startOffset: number;
  anchorKey: string;
  query: string;
}

export function PersonMentionPlugin({ currentNoteId }: PersonMentionPluginProps) {
  const [editor] = useLexicalComposerContext();
  const { onError } = usePersonMentionContext();
  const [triggerState, setTriggerState] = useState<TriggerState | null>(null);

  // Autocomplete state
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Track results and metadata for keyboard navigation
  const resultsRef = useRef<PersonResult[]>([]);
  const hasExactMatchRef = useRef(false);

  // Use ref to track insertion state via counter to prevent re-triggering
  // Using a counter instead of boolean to handle rapid insertions safely
  // The counter is incremented on insertion and checked in the update listener
  const insertionCounterRef = useRef(0);
  const lastProcessedCounterRef = useRef(0);

  // Use ref for triggerState to avoid re-registering the update listener
  // on every triggerState change (optimization for linked-94)
  const triggerStateRef = useRef(triggerState);
  triggerStateRef.current = triggerState;

  // Handle closing autocomplete
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  // Register command handler for inserting person mentions
  // This handles the actual insertion logic with all data passed via payload,
  // avoiding race conditions from stale closure state
  useEffect(() => {
    return editor.registerCommand(
      INSERT_PERSON_MENTION_COMMAND,
      (payload: InsertPersonMentionPayload) => {
        const { personName, personId, startOffset, anchorKey } = payload;

        // Increment counter to prevent re-triggering detection
        insertionCounterRef.current += 1;

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

        setTriggerState(null);
        handleClose();

        // Update the last processed counter on the next animation frame
        // This ensures the update listener skips the immediate re-trigger
        // while avoiding race conditions from arbitrary timeouts
        requestAnimationFrame(() => {
          lastProcessedCounterRef.current = insertionCounterRef.current;
        });

        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, handleClose]);

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
        // Insert the mention with the new person's ID
        insertPersonMention(newPerson.metadata.title || name, newPerson.id);
      } catch (error) {
        console.error('Failed to create person:', error);
        // Show error to user via context
        onError(`Failed to create "${name}"`);
        // Close autocomplete on error
        handleClose();
        setTriggerState(null);
      }
    },
    [insertPersonMention, handleClose, onError]
  );

  // Remove @ and query text when cancelling
  const removeAtAndQuery = useCallback(() => {
    if (!triggerState) return;

    editor.update(() => {
      const node = $getNodeByKey(triggerState.anchorKey);
      if (node instanceof TextNode) {
        const text = node.getTextContent();
        const endOffset = triggerState.startOffset + 1 + triggerState.query.length;
        const newText = text.slice(0, triggerState.startOffset) + text.slice(endOffset);
        node.setTextContent(newText);

        // Move cursor to where @ was
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          node.select(triggerState.startOffset, triggerState.startOffset);
        }
      }
    });
  }, [editor, triggerState]);

  // Key detection logic - monitor text changes
  // Uses triggerStateRef to avoid re-registering the listener on every triggerState change
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      // Skip if we just inserted a mention (counter hasn't been processed yet)
      if (insertionCounterRef.current !== lastProcessedCounterRef.current) return;

      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();

        if (!(anchorNode instanceof TextNode)) return;

        const text = anchorNode.getTextContent();
        const offset = anchor.offset;

        // Get current triggerState from ref to avoid stale closure
        const currentTriggerState = triggerStateRef.current;

        // Check for @ pattern (only when not already tracking)
        // Make sure @ is at start of text or preceded by whitespace
        if (!currentTriggerState && offset >= 1 && text[offset - 1] === '@') {
          const charBefore = offset > 1 ? text[offset - 2] : null;
          const isValidTrigger = charBefore === null || charBefore === ' ' || charBefore === '\n';

          if (isValidTrigger) {
            // Start tracking
            const domNode = editor.getElementByKey(anchorNode.getKey());
            if (domNode) {
              // Use browser selection API for accurate cursor position
              const domSelection = window.getSelection();
              let newPosition = { top: 0, left: 0 };

              if (domSelection && domSelection.rangeCount > 0) {
                const range = domSelection.getRangeAt(0);
                const rangeRect = range.getBoundingClientRect();

                // Use range bounding rect for accurate position
                if (rangeRect.width > 0 || rangeRect.height > 0) {
                  newPosition = {
                    top: rangeRect.bottom + 4, // Small gap below cursor
                    left: rangeRect.left,
                  };
                } else {
                  // Fallback: use domNode rect if range rect is empty (e.g., empty line)
                  const rect = domNode.getBoundingClientRect();
                  newPosition = {
                    top: rect.bottom + 4,
                    left: rect.left,
                  };
                }
              } else {
                // Fallback if no selection available
                const rect = domNode.getBoundingClientRect();
                newPosition = {
                  top: rect.bottom + 4,
                  left: rect.left,
                };
              }

              setPosition(newPosition);
              setIsOpen(true);
              setQuery('');
              setSelectedIndex(0);

              setTriggerState({
                isActive: true,
                startOffset: offset - 1, // Position of @
                anchorKey: anchorNode.getKey(),
                query: '',
              });
            }
            return;
          }
        }

        // If tracking, update query
        if (
          currentTriggerState?.isActive &&
          anchorNode.getKey() === currentTriggerState.anchorKey
        ) {
          const newQuery = text.slice(currentTriggerState.startOffset + 1, offset);

          // Update query if changed
          if (newQuery !== currentTriggerState.query) {
            setTriggerState((prev) => (prev ? { ...prev, query: newQuery } : null));
            setQuery(newQuery);
            setSelectedIndex(0); // Reset selection when query changes
          }
        }

        // If we moved to a different node, cancel tracking
        if (
          currentTriggerState?.isActive &&
          anchorNode.getKey() !== currentTriggerState.anchorKey
        ) {
          setTriggerState(null);
          handleClose();
        }
      });
    });
  }, [editor, handleClose]);

  // Escape key handling
  useEffect(() => {
    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        if (triggerState?.isActive) {
          removeAtAndQuery();
          setTriggerState(null);
          handleClose();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, triggerState, handleClose, removeAtAndQuery]);

  // Keyboard navigation for autocomplete
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const results = resultsRef.current;
      const showCreateOption = query.trim().length > 0 && !hasExactMatchRef.current;
      const totalItems = results.length + (showCreateOption ? 1 : 0);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, totalItems - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          // Handle selection based on selectedIndex
          if (selectedIndex < results.length) {
            const person = results[selectedIndex];
            if (person) {
              handleSelect(person);
            }
          } else if (showCreateOption && selectedIndex === results.length) {
            handleCreate(query.trim());
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, selectedIndex, query, handleSelect, handleCreate]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is inside the autocomplete container
      if (target.closest('[role="listbox"]')) return;

      setTriggerState(null);
      handleClose();
    };

    // Use mousedown to detect clicks before focus changes
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, handleClose]);

  // Callback to receive results from autocomplete for keyboard navigation
  const handleResultsChange = useCallback((results: PersonResult[], hasExactMatch: boolean) => {
    resultsRef.current = results;
    hasExactMatchRef.current = hasExactMatch;
  }, []);

  // Render autocomplete using portal
  if (!isOpen) return null;

  return createPortal(
    <PersonMentionAutocomplete
      query={query}
      position={position}
      selectedIndex={selectedIndex}
      onSelect={handleSelect}
      onCreate={handleCreate}
      currentNoteId={currentNoteId}
      onResultsChange={handleResultsChange}
    />,
    document.body
  );
}
