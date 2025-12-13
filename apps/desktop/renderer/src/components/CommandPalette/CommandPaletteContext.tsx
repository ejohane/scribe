/**
 * CommandPaletteContext
 *
 * React context for sharing CommandPalette state across panel components.
 * Eliminates props drilling by providing:
 * - Selection state (indices and setters)
 * - Mode state
 * - Common callbacks (onClose, onBackToCommand)
 */

import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
import type { Note, NoteId } from '@scribe/shared';
import type { PaletteMode } from '../../commands/types';

// ---------------------------------------------------------------------------
// Context Types
// ---------------------------------------------------------------------------

export interface CommandPaletteContextValue {
  // Mode state
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;

  // Query state
  query: string;
  setQuery: (query: string) => void;

  // Selection state for notes (file-browse, delete-browse)
  selectedNoteIndex: number;
  setSelectedNoteIndex: (index: number | ((prev: number) => number)) => void;

  // Selection state for people (person-browse)
  selectedPersonIndex: number;
  setSelectedPersonIndex: (index: number | ((prev: number) => number)) => void;

  // Selection state for commands (command mode)
  selectedIndex: number;
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;

  // Current note context
  currentNoteId: NoteId | null | undefined;

  // Common callbacks
  onClose: () => void;
  onModeChange?: (mode: PaletteMode) => void;
  onNoteSelect?: (noteId: NoteId) => void;

  // Delete flow callbacks
  onDeleteNote: (note: Note) => void;
  onSelectForDelete: (note: Note) => void;
}

// ---------------------------------------------------------------------------
// Context Creation
// ---------------------------------------------------------------------------

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider Props
// ---------------------------------------------------------------------------

export interface CommandPaletteProviderProps {
  children: ReactNode;
  // Mode state
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
  // Query state
  query: string;
  setQuery: (query: string) => void;
  // Selection state
  selectedNoteIndex: number;
  setSelectedNoteIndex: (index: number | ((prev: number) => number)) => void;
  selectedPersonIndex: number;
  setSelectedPersonIndex: (index: number | ((prev: number) => number)) => void;
  selectedIndex: number;
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
  // Current note
  currentNoteId: NoteId | null | undefined;
  // Callbacks
  onClose: () => void;
  onModeChange?: (mode: PaletteMode) => void;
  onNoteSelect?: (noteId: NoteId) => void;
  // Delete flow
  setPendingDeleteNote: (note: Note | null) => void;
  setReturnMode: (mode: PaletteMode) => void;
}

// ---------------------------------------------------------------------------
// Provider Component
// ---------------------------------------------------------------------------

export function CommandPaletteProvider({
  children,
  mode,
  setMode,
  query,
  setQuery,
  selectedNoteIndex,
  setSelectedNoteIndex,
  selectedPersonIndex,
  setSelectedPersonIndex,
  selectedIndex,
  setSelectedIndex,
  currentNoteId,
  onClose,
  onModeChange,
  onNoteSelect,
  setPendingDeleteNote,
  setReturnMode,
}: CommandPaletteProviderProps) {
  // Delete from file-browse mode
  const onDeleteNote = useCallback(
    (note: Note) => {
      setPendingDeleteNote(note);
      setReturnMode('file-browse');
      setMode('delete-confirm');
      onModeChange?.('delete-confirm');
    },
    [setPendingDeleteNote, setReturnMode, setMode, onModeChange]
  );

  // Select for delete from delete-browse mode
  const onSelectForDelete = useCallback(
    (note: Note) => {
      setPendingDeleteNote(note);
      setReturnMode('delete-browse');
      setMode('delete-confirm');
      onModeChange?.('delete-confirm');
    },
    [setPendingDeleteNote, setReturnMode, setMode, onModeChange]
  );

  const value = useMemo<CommandPaletteContextValue>(
    () => ({
      mode,
      setMode,
      query,
      setQuery,
      selectedNoteIndex,
      setSelectedNoteIndex,
      selectedPersonIndex,
      setSelectedPersonIndex,
      selectedIndex,
      setSelectedIndex,
      currentNoteId,
      onClose,
      onModeChange,
      onNoteSelect,
      onDeleteNote,
      onSelectForDelete,
    }),
    [
      mode,
      setMode,
      query,
      setQuery,
      selectedNoteIndex,
      setSelectedNoteIndex,
      selectedPersonIndex,
      setSelectedPersonIndex,
      selectedIndex,
      setSelectedIndex,
      currentNoteId,
      onClose,
      onModeChange,
      onNoteSelect,
      onDeleteNote,
      onSelectForDelete,
    ]
  );

  return <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>;
}

// ---------------------------------------------------------------------------
// Consumer Hook
// ---------------------------------------------------------------------------

/**
 * Hook to access CommandPalette context.
 * Must be used within a CommandPaletteProvider.
 */
export function useCommandPaletteContext(): CommandPaletteContextValue {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPaletteContext must be used within a CommandPaletteProvider');
  }
  return context;
}

/**
 * Hook to optionally access CommandPalette context.
 * Returns null if used outside of a CommandPaletteProvider.
 * Useful for components that can work with or without context.
 */
export function useOptionalCommandPaletteContext(): CommandPaletteContextValue | null {
  return useContext(CommandPaletteContext);
}
