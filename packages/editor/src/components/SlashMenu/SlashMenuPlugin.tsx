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
import { useEffect, useCallback, useState, useRef, useMemo, type ReactNode } from 'react';
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
  KEY_DOWN_COMMAND,
  type LexicalEditor,
} from 'lexical';
import type { SlashCommandEntry, SlashCommandArgs } from '@scribe/plugin-core';
import { SlashMenu } from './SlashMenu.js';
import { SlashCommandProvider } from './SlashCommandContext.js';
import { getFilteredCommandCount, getCommandByIndex, type CoreSlashCommand } from './SlashMenu.js';

interface TriggerState {
  isActive: boolean;
  startOffset: number;
  anchorKey: string;
  query: string;
}

export interface SlashMenuCommandDefinition {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  section: 'formatting' | 'insert' | 'ai';
  icon?: ReactNode;
  execute: (editor: LexicalEditor) => void;
}

export interface SlashMenuPluginProps {
  coreCommands: SlashMenuCommandDefinition[];
  pluginCommands?: SlashCommandEntry[];
  isLoadingPlugins?: boolean;
  noteId?: string;
  showToast?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

function defaultShowToast(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const method = type === 'error' ? 'error' : type === 'success' ? 'info' : 'log';
  // eslint-disable-next-line no-console -- Fallback toast implementation
  console[method](message);
}

export function SlashMenuPlugin({
  coreCommands: coreCommandDefinitions,
  pluginCommands = [],
  isLoadingPlugins = false,
  noteId,
  showToast = defaultShowToast,
}: SlashMenuPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [triggerState, setTriggerState] = useState<TriggerState | null>(null);

  // Menu state
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const coreCommands = useMemo<CoreSlashCommand[]>(
    () =>
      coreCommandDefinitions.map((command) => ({
        ...command,
        execute: () => command.execute(editor),
      })),
    [coreCommandDefinitions, editor]
  );

  // Use ref for triggerState to avoid re-registering the update listener
  const triggerStateRef = useRef(triggerState);
  triggerStateRef.current = triggerState;

  // Use ref to track insertion state via counter to prevent re-triggering
  const insertionCounterRef = useRef(0);
  const lastProcessedCounterRef = useRef(0);

  // Refs for keyboard command handlers to avoid re-registering on state changes
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const coreCommandsRef = useRef(coreCommands);
  coreCommandsRef.current = coreCommands;
  const pluginCommandsRef = useRef(pluginCommands);
  pluginCommandsRef.current = pluginCommands;
  const queryRef = useRef(query);
  queryRef.current = query;

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle closing menu
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
    setTriggerState(null);
  }, []);

  const finalizeCommandExecution = useCallback(() => {
    requestAnimationFrame(() => {
      lastProcessedCounterRef.current = insertionCounterRef.current;
    });
  }, []);

  const removeTriggerText = useCallback(() => {
    const currentTriggerState = triggerStateRef.current;
    if (!currentTriggerState) return false;

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

    return true;
  }, [editor]);

  const executeCoreCommand = useCallback(
    (command: CoreSlashCommand) => {
      if (!removeTriggerText()) return;
      command.execute();
      handleClose();
      finalizeCommandExecution();
    },
    [finalizeCommandExecution, handleClose, removeTriggerText]
  );

  const executePluginCommand = useCallback(
    async (command: SlashCommandEntry) => {
      if (!removeTriggerText()) return;

      if (!command.handler) {
        showToast(`Command "${command.command}" has no handler`, 'error');
        handleClose();
        finalizeCommandExecution();
        return;
      }

      const args: SlashCommandArgs = {
        text: '',
        noteId: noteId ?? '',
        insertContent: (content: unknown) => {
          if (typeof content === 'string') {
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                selection.insertText(content);
              }
            });
            return;
          }

          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.insertText(JSON.stringify(content));
            }
          });
        },
      };

      try {
        await command.handler.execute(args);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        // eslint-disable-next-line no-console -- Log for debugging
        console.error(`[plugin:${command.pluginId}] Slash command error:`, error);
        showToast(`Command failed: ${message}`, 'error');
      }

      handleClose();
      finalizeCommandExecution();
    },
    [editor, finalizeCommandExecution, handleClose, noteId, removeTriggerText, showToast]
  );

  const handleSelectCore = useCallback(
    (command: CoreSlashCommand) => {
      executeCoreCommand(command);
    },
    [executeCoreCommand]
  );

  const handleSelectPlugin = useCallback(
    (_command: SlashCommandEntry) => {
      handleClose();
      finalizeCommandExecution();
    },
    [finalizeCommandExecution, handleClose]
  );

  // Handle hover on menu item
  const handleHover = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  // Key detection logic - monitor text changes
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      // Skip if we just executed a command (counter hasn't been processed yet)
      if (insertionCounterRef.current !== lastProcessedCounterRef.current) {
        if (triggerStateRef.current?.isActive) {
          return;
        }

        lastProcessedCounterRef.current = insertionCounterRef.current;
      }

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
            const rootNode = editor.getRootElement();
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
              } else if (domNode) {
                // Fallback: use domNode rect if range rect is empty
                const rect = domNode.getBoundingClientRect();
                newPosition = {
                  top: rect.bottom + 4,
                  left: rect.left,
                };
              }
            } else if (domNode) {
              // Fallback if no selection available
              const rect = domNode.getBoundingClientRect();
              newPosition = {
                top: rect.bottom + 4,
                left: rect.left,
              };
            } else if (rootNode) {
              const rect = rootNode.getBoundingClientRect();
              newPosition = {
                top: rect.top + 32,
                left: rect.left + 16,
              };
            }

            setPosition(newPosition);
            setIsOpen(true);
            setQuery('');
            setSelectedIndex(0);

            setTriggerState({
              isActive: true,
              startOffset: offset - 1, // Position of "/"
              anchorKey: anchorNode.getKey(),
              query: '',
            });
            return;
          }
        }

        // If tracking, update query
        if (
          currentTriggerState?.isActive &&
          anchorNode.getKey() === currentTriggerState.anchorKey
        ) {
          const newQuery = text.slice(currentTriggerState.startOffset + 1, offset);

          // If space is typed immediately after "/" (query starts with space),
          // dismiss the dropdown and keep "/ " in the editor
          if (newQuery.startsWith(' ')) {
            handleClose();
            return;
          }

          // Update query if changed
          if (newQuery !== currentTriggerState.query) {
            setTriggerState((prev) => (prev ? { ...prev, query: newQuery } : null));
            setQuery(newQuery);
          }
        }

        if (currentTriggerState?.isActive) {
          const triggerNode = $getNodeByKey(currentTriggerState.anchorKey);
          const triggerText = triggerNode instanceof TextNode ? triggerNode.getTextContent() : '';
          const slashStillThere = triggerText[currentTriggerState.startOffset] === '/';

          if (!slashStillThere) {
            if (anchorNode.getKey() !== currentTriggerState.anchorKey) {
              const slashIndex = text.lastIndexOf('/', offset - 1);
              const charBeforeSlash = slashIndex > 0 ? text[slashIndex - 1] : null;
              const isValidTrigger =
                slashIndex >= 0 &&
                (charBeforeSlash === null || charBeforeSlash === ' ' || charBeforeSlash === '\n');

              if (isValidTrigger) {
                const newQuery = text.slice(slashIndex + 1, offset);
                setTriggerState({
                  isActive: true,
                  startOffset: slashIndex,
                  anchorKey: anchorNode.getKey(),
                  query: newQuery,
                });
                setQuery(newQuery);
              } else {
                handleClose();
              }
            } else {
              handleClose();
            }
          }
        }
      });
    });
  }, [editor, handleClose]);

  // Escape key handling - dismiss dropdown but keep "/" in editor
  useEffect(() => {
    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        if (triggerStateRef.current?.isActive) {
          // Just close the menu without removing the "/" character
          handleClose();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, handleClose]);

  // Slash key handling - open menu on key press
  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
          return false;
        }

        const domSelection = window.getSelection();
        if (!domSelection || domSelection.rangeCount === 0) {
          return false;
        }

        const domAnchor = domSelection.anchorNode;
        const domOffset = domSelection.anchorOffset;
        const domText = domAnchor?.textContent ?? '';
        const charBefore = domOffset > 0 ? domText[domOffset - 1] : null;
        const isValidTrigger = charBefore === null || charBefore === ' ' || charBefore === '\n';

        if (!isValidTrigger) {
          return false;
        }

        requestAnimationFrame(() => {
          if (triggerStateRef.current?.isActive) {
            return;
          }

          editor.getEditorState().read(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;

            const anchor = selection.anchor;
            const anchorNode = anchor.getNode();
            if (!(anchorNode instanceof TextNode)) return;

            const text = anchorNode.getTextContent();
            const offset = anchor.offset;

            if (offset < 1 || text[offset - 1] !== '/') {
              return;
            }

            const charBefore = offset > 1 ? text[offset - 2] : null;
            const isValidTrigger = charBefore === null || charBefore === ' ' || charBefore === '\n';

            if (!isValidTrigger) {
              return;
            }

            const domNode = editor.getElementByKey(anchorNode.getKey());
            const rootNode = editor.getRootElement();
            const domSelection = window.getSelection();
            let newPosition = { top: 0, left: 0 };

            if (domSelection && domSelection.rangeCount > 0) {
              const range = domSelection.getRangeAt(0);
              const rangeRect = range.getBoundingClientRect();

              if (rangeRect.width > 0 || rangeRect.height > 0) {
                newPosition = {
                  top: rangeRect.bottom + 4,
                  left: rangeRect.left,
                };
              } else if (domNode) {
                const rect = domNode.getBoundingClientRect();
                newPosition = {
                  top: rect.bottom + 4,
                  left: rect.left,
                };
              }
            } else if (domNode) {
              const rect = domNode.getBoundingClientRect();
              newPosition = {
                top: rect.bottom + 4,
                left: rect.left,
              };
            } else if (rootNode) {
              const rect = rootNode.getBoundingClientRect();
              newPosition = {
                top: rect.top + 32,
                left: rect.left + 16,
              };
            }

            setPosition(newPosition);
            setIsOpen(true);
            setQuery('');
            setSelectedIndex(0);
            setTriggerState({
              isActive: true,
              startOffset: offset - 1,
              anchorKey: anchorNode.getKey(),
              query: '',
            });
          });
        });

        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

  // Arrow down handling - uses ref to avoid re-registering on filteredCommands changes
  useEffect(() => {
    return editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      () => {
        const count = getFilteredCommandCount(
          coreCommandsRef.current,
          pluginCommandsRef.current,
          queryRef.current
        );
        if (!isOpen || count === 0) return false;

        setSelectedIndex((prev) => Math.min(prev + 1, count - 1));
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
        const count = getFilteredCommandCount(
          coreCommandsRef.current,
          pluginCommandsRef.current,
          queryRef.current
        );
        if (!isOpen || count === 0) return false;

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
        const index = selectedIndexRef.current;

        const command = getCommandByIndex(
          coreCommandsRef.current,
          pluginCommandsRef.current,
          queryRef.current,
          index
        );

        if (!isOpen || !command) return false;

        event?.preventDefault();

        if (command.type === 'core') {
          executeCoreCommand(command.command);
          return true;
        }

        void executePluginCommand(command.command);
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, executeCoreCommand, executePluginCommand, isOpen]);

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
    <SlashCommandProvider
      config={{
        editor,
        showToast: (message, type = 'success') => showToast(message, type),
        closeMenu: handleClose,
        noteId,
      }}
    >
      <SlashMenu
        coreCommands={coreCommands}
        pluginCommands={pluginCommands}
        isLoadingPlugins={isLoadingPlugins}
        position={position}
        selectedIndex={selectedIndex}
        query={query}
        onSelectCore={handleSelectCore}
        onSelectPlugin={handleSelectPlugin}
        onHover={handleHover}
        onBeforeExecutePlugin={removeTriggerText}
      />
    </SlashCommandProvider>,
    document.body
  );
}
