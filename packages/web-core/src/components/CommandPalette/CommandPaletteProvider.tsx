/**
 * CommandPaletteProvider
 *
 * Provides command palette state and actions to the component tree.
 * Handles keyboard shortcuts, state management, and command execution.
 *
 * @module
 */

import {
  createContext,
  useContext,
  useCallback,
  useReducer,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrpc } from '../../providers/ScribeProvider';
import type { CommandContext } from '@scribe/plugin-core';
import type {
  CommandPaletteState,
  CommandPaletteContextValue,
  CommandPaletteView,
  CommandPaletteItem,
  CommandPaletteSection,
  CommandItem,
} from './types';
import { useRecentNotes } from './useRecentNotes';
import { useNoteSearch } from './useNoteSearch';
import { filterCommands } from './fuzzyFilter';
import { builtInCommands, SEARCH_NOTES_COMMAND_ID } from './builtInCommands';

// ============================================================================
// Context
// ============================================================================

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

// ============================================================================
// State Reducer
// ============================================================================

type Action =
  | { type: 'OPEN'; view?: CommandPaletteView }
  | { type: 'CLOSE' }
  | { type: 'TOGGLE'; view?: CommandPaletteView }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_VIEW'; view: CommandPaletteView }
  | { type: 'SELECT_NEXT'; totalItems: number }
  | { type: 'SELECT_PREVIOUS'; totalItems: number }
  | { type: 'SET_SEARCHING'; isSearching: boolean };

const initialState: CommandPaletteState = {
  isOpen: false,
  view: 'command',
  query: '',
  selectedIndex: 0,
  isSearching: false,
};

function reducer(state: CommandPaletteState, action: Action): CommandPaletteState {
  switch (action.type) {
    case 'OPEN':
      return {
        ...state,
        isOpen: true,
        view: action.view ?? 'command',
        query: '',
        selectedIndex: 0,
      };
    case 'CLOSE':
      return {
        ...state,
        isOpen: false,
        query: '',
        selectedIndex: 0,
      };
    case 'TOGGLE':
      if (state.isOpen) {
        return {
          ...state,
          isOpen: false,
          query: '',
          selectedIndex: 0,
        };
      }
      return {
        ...state,
        isOpen: true,
        view: action.view ?? 'command',
        query: '',
        selectedIndex: 0,
      };
    case 'SET_QUERY':
      return {
        ...state,
        query: action.query,
        selectedIndex: 0,
      };
    case 'SET_VIEW':
      return {
        ...state,
        view: action.view,
        query: '',
        selectedIndex: 0,
      };
    case 'SELECT_NEXT':
      return {
        ...state,
        selectedIndex: Math.min(state.selectedIndex + 1, action.totalItems - 1),
      };
    case 'SELECT_PREVIOUS':
      return {
        ...state,
        selectedIndex: Math.max(state.selectedIndex - 1, 0),
      };
    case 'SET_SEARCHING':
      return {
        ...state,
        isSearching: action.isSearching,
      };
    default:
      return state;
  }
}

// ============================================================================
// Provider Props
// ============================================================================

export interface CommandPaletteProviderProps {
  children: ReactNode;
  /**
   * Current note ID for command context (if a note is open).
   */
  currentNoteId?: string | null;
  /**
   * Additional commands from plugins.
   */
  pluginCommands?: CommandItem[];
  /**
   * Toast function for command context.
   */
  toast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// ============================================================================
// Provider Component
// ============================================================================

export function CommandPaletteProvider({
  children,
  currentNoteId = null,
  pluginCommands = [],
  toast = () => {},
}: CommandPaletteProviderProps) {
  const navigate = useNavigate();
  const trpc = useTrpc();
  const [state, dispatch] = useReducer(reducer, initialState);

  // Fetch recent notes when in note-search view with empty query
  const showRecent = state.isOpen && state.view === 'note-search' && !state.query;
  const { data: recentNotes = [] } = useRecentNotes(showRecent);

  // Search notes when query is entered
  const { data: searchResults = [], isFetching: isSearching } = useNoteSearch(
    state.query,
    state.isOpen && state.view === 'note-search'
  );

  // Update searching state
  useEffect(() => {
    dispatch({ type: 'SET_SEARCHING', isSearching });
  }, [isSearching]);

  // Create note helper for command context
  const createNote = useCallback(
    async (options?: { title?: string; type?: 'note' | 'daily' | 'meeting' | 'person' }) => {
      try {
        const newNote = await trpc.notes.create.mutate({
          title: options?.title ?? 'Untitled',
          type: options?.type ?? 'note',
        });
        return newNote.id;
      } catch (err) {
        console.error('[CommandPalette] Failed to create note:', err);
        toast('Failed to create note', 'error');
        return null;
      }
    },
    [trpc, toast]
  );

  // Create command context
  const commandContext: CommandContext = useMemo(
    () => ({
      noteId: currentNoteId,
      navigate,
      toast,
      createNote,
    }),
    [currentNoteId, navigate, toast, createNote]
  );

  // Convert built-in commands to CommandItems
  const allBuiltInCommands: CommandItem[] = useMemo(() => {
    return builtInCommands.map((cmd) => ({
      type: 'command' as const,
      id: cmd.id,
      label: cmd.label,
      description: cmd.description,
      icon: cmd.icon,
      shortcut: cmd.shortcut,
      category: cmd.category,
      priority: cmd.priority,
      handler: {
        execute: cmd.execute,
      },
    }));
  }, []);

  // Merge built-in and plugin commands
  const allCommands = useMemo(
    () => [...allBuiltInCommands, ...pluginCommands],
    [allBuiltInCommands, pluginCommands]
  );

  // Build sections based on current view
  const sections: CommandPaletteSection[] = useMemo(() => {
    if (state.view === 'command') {
      // Filter commands by query
      const filteredCommands = filterCommands(allCommands, state.query);

      if (filteredCommands.length === 0) {
        return [];
      }

      // Group by category
      const categoryMap = new Map<string, CommandItem[]>();
      for (const cmd of filteredCommands) {
        const existing = categoryMap.get(cmd.category) ?? [];
        categoryMap.set(cmd.category, [...existing, cmd]);
      }

      // Convert to sections
      return Array.from(categoryMap.entries()).map(([category, items]) => ({
        id: category,
        label: category,
        items,
      }));
    } else {
      // Note search view
      if (state.query) {
        // Show search results
        if (searchResults.length === 0) {
          return [];
        }
        return [
          {
            id: 'search-results',
            label: 'Search Results',
            items: searchResults,
          },
        ];
      } else {
        // Show recent notes
        if (recentNotes.length === 0) {
          return [];
        }
        return [
          {
            id: 'recent',
            label: 'Recent Notes',
            items: recentNotes,
          },
        ];
      }
    }
  }, [state.view, state.query, allCommands, searchResults, recentNotes]);

  // Calculate total items
  const totalItems = useMemo(
    () => sections.reduce((acc, section) => acc + section.items.length, 0),
    [sections]
  );

  // Get currently selected item
  const getSelectedItem = useCallback((): CommandPaletteItem | null => {
    if (totalItems === 0) return null;

    let currentIndex = 0;
    for (const section of sections) {
      for (const item of section.items) {
        if (currentIndex === state.selectedIndex) {
          return item;
        }
        currentIndex++;
      }
    }
    return null;
  }, [sections, state.selectedIndex, totalItems]);

  // Actions
  const open = useCallback((view?: CommandPaletteView) => {
    dispatch({ type: 'OPEN', view });
  }, []);

  const close = useCallback(() => {
    dispatch({ type: 'CLOSE' });
  }, []);

  const toggle = useCallback((view?: CommandPaletteView) => {
    dispatch({ type: 'TOGGLE', view });
  }, []);

  const setQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_QUERY', query });
  }, []);

  const setView = useCallback((view: CommandPaletteView) => {
    dispatch({ type: 'SET_VIEW', view });
  }, []);

  const selectNext = useCallback(() => {
    dispatch({ type: 'SELECT_NEXT', totalItems });
  }, [totalItems]);

  const selectPrevious = useCallback(() => {
    dispatch({ type: 'SELECT_PREVIOUS', totalItems });
  }, [totalItems]);

  const executeSelected = useCallback(() => {
    const item = getSelectedItem();
    if (!item) return;

    if (item.type === 'command') {
      // Check if it's the search notes command
      if (item.id === SEARCH_NOTES_COMMAND_ID) {
        setView('note-search');
        return;
      }

      // Execute the command
      item.handler.execute(commandContext);
      close();
    } else if (item.type === 'note') {
      // Navigate to the note
      navigate(`/note/${item.id}`);
      close();
    }
  }, [getSelectedItem, commandContext, close, navigate, setView]);

  // Global keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Cmd+K or Ctrl+K to toggle
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        toggle('command');
        return;
      }

      // Cmd+Shift+F or Ctrl+Shift+F to open note search
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'f') {
        event.preventDefault();
        open('note-search');
        return;
      }
    }

    // Use capture phase to intercept before editor or other handlers
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [toggle, open]);

  // Context value
  const value: CommandPaletteContextValue = useMemo(
    () => ({
      ...state,
      sections,
      totalItems,
      getSelectedItem,
      commandContext,
      open,
      close,
      toggle,
      setQuery,
      setView,
      selectNext,
      selectPrevious,
      executeSelected,
    }),
    [
      state,
      sections,
      totalItems,
      getSelectedItem,
      commandContext,
      open,
      close,
      toggle,
      setQuery,
      setView,
      selectNext,
      selectPrevious,
      executeSelected,
    ]
  );

  return <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access command palette state and actions.
 *
 * @returns Command palette context value
 * @throws Error if used outside CommandPaletteProvider
 *
 * @example
 * ```tsx
 * const { isOpen, open, close, toggle } = useCommandPalette();
 *
 * // Open the palette
 * open('command');
 *
 * // Or toggle it
 * toggle();
 * ```
 */
export function useCommandPalette(): CommandPaletteContextValue {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }
  return context;
}
