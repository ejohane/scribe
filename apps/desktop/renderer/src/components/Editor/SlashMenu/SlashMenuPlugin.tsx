/**
 * SlashMenuPlugin - Lexical plugin for slash commands
 *
 * Responsibilities:
 * 1. Detect when user types "/" at start of line or after space
 * 2. Track the position where menu should appear
 * 3. Handle keyboard navigation (up/down/enter/escape)
 * 4. Execute selected command and clean up trigger text
 * 5. Render SlashMenu component via portal
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
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
} from 'lexical';
import { SlashMenu } from './SlashMenu';
import { slashCommands, filterCommands, type SlashCommand } from './commands';

interface TriggerState {
  isActive: boolean;
  startOffset: number;
  anchorKey: string;
  query: string;
}

export function SlashMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const [triggerState, setTriggerState] = useState<TriggerState | null>(null);

  // Menu state
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filtered commands based on query
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>(slashCommands);

  // Use ref for triggerState to avoid re-registering the update listener
  const triggerStateRef = useRef(triggerState);
  triggerStateRef.current = triggerState;

  // Use ref to track insertion state via counter to prevent re-triggering
  const insertionCounterRef = useRef(0);
  const lastProcessedCounterRef = useRef(0);

  // Refs for keyboard command handlers to avoid re-registering on state changes
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const filteredCommandsRef = useRef(filteredCommands);
  filteredCommandsRef.current = filteredCommands;

  // Update filtered commands when query changes
  useEffect(() => {
    const filtered = filterCommands(query);
    setFilteredCommands(filtered);
    // Reset selection when query changes
    setSelectedIndex(0);
  }, [query]);

  // Handle closing menu
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
    setTriggerState(null);
  }, []);

  // Remove "/" and query text when cancelling
  const removeSlashAndQuery = useCallback(() => {
    const currentTriggerState = triggerStateRef.current;
    if (!currentTriggerState) return;

    editor.update(() => {
      const node = $getNodeByKey(currentTriggerState.anchorKey);
      if (node instanceof TextNode) {
        const text = node.getTextContent();
        // Remove "/" and any query text
        const endOffset = currentTriggerState.startOffset + 1 + currentTriggerState.query.length;
        const newText = text.slice(0, currentTriggerState.startOffset) + text.slice(endOffset);
        node.setTextContent(newText);

        // Move cursor to where "/" was
        node.select(currentTriggerState.startOffset, currentTriggerState.startOffset);
      }
    });
  }, [editor]);

  // Execute selected command
  const executeCommand = useCallback(
    (command: SlashCommand) => {
      const currentTriggerState = triggerStateRef.current;
      if (!currentTriggerState) return;

      // Increment counter to prevent re-triggering detection
      insertionCounterRef.current += 1;

      // Remove the "/" and query text first
      editor.update(() => {
        const node = $getNodeByKey(currentTriggerState.anchorKey);
        if (node instanceof TextNode) {
          const text = node.getTextContent();
          // Remove "/" and any query text
          const endOffset = currentTriggerState.startOffset + 1 + currentTriggerState.query.length;
          const newText = text.slice(0, currentTriggerState.startOffset) + text.slice(endOffset);
          node.setTextContent(newText);

          // Move cursor to where "/" was
          node.select(currentTriggerState.startOffset, currentTriggerState.startOffset);
        }
      });

      // Execute the command
      command.execute(editor);

      // Close menu
      handleClose();

      // Update the last processed counter on the next animation frame
      requestAnimationFrame(() => {
        lastProcessedCounterRef.current = insertionCounterRef.current;
      });
    },
    [editor, handleClose]
  );

  // Handle command selection from menu click
  const handleSelect = useCallback(
    (command: SlashCommand) => {
      executeCommand(command);
    },
    [executeCommand]
  );

  // Handle hover on menu item
  const handleHover = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  // Key detection logic - monitor text changes
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      // Skip if we just executed a command (counter hasn't been processed yet)
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

        // Check for "/" pattern (only when not already tracking)
        // "/" must be at start of line or after whitespace
        if (!currentTriggerState && offset >= 1 && text[offset - 1] === '/') {
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
                  // Fallback: use domNode rect if range rect is empty
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
              setFilteredCommands(slashCommands);

              setTriggerState({
                isActive: true,
                startOffset: offset - 1, // Position of "/"
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
  }, [editor, handleClose]);

  // Escape key handling
  useEffect(() => {
    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        if (triggerStateRef.current?.isActive) {
          removeSlashAndQuery();
          handleClose();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, handleClose, removeSlashAndQuery]);

  // Arrow down handling - uses ref to avoid re-registering on filteredCommands changes
  useEffect(() => {
    return editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      () => {
        const commands = filteredCommandsRef.current;
        if (!isOpen || commands.length === 0) return false;

        setSelectedIndex((prev) => Math.min(prev + 1, commands.length - 1));
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, isOpen]);

  // Arrow up handling - uses ref to avoid re-registering on filteredCommands changes
  useEffect(() => {
    return editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      () => {
        const commands = filteredCommandsRef.current;
        if (!isOpen || commands.length === 0) return false;

        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, isOpen]);

  // Enter key handling - uses refs to avoid re-registering on filteredCommands/selectedIndex changes
  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        const commands = filteredCommandsRef.current;
        const index = selectedIndexRef.current;

        if (!isOpen || commands.length === 0) return false;

        event?.preventDefault();
        const selectedCommand = commands[index];
        if (selectedCommand) {
          executeCommand(selectedCommand);
        }
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, isOpen, executeCommand]);

  // Handle click outside to close
  useEffect(() => {
    // Always define the handler to ensure cleanup is properly registered
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is inside the menu
      if (target.closest('[role="listbox"]')) return;

      handleClose();
    };

    // Only add listener when menu is open
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup always runs, removing listener if it was added
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, handleClose]);

  // Render menu using portal
  if (!isOpen) return null;

  return createPortal(
    <SlashMenu
      commands={filteredCommands}
      position={position}
      selectedIndex={selectedIndex}
      onSelect={handleSelect}
      onHover={handleHover}
    />,
    document.body
  );
}
