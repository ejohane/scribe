/**
 * Shared types for CommandPalette panel components
 */

import type { Note, NoteId, SearchResult } from '@scribe/shared';
import type { Command, PaletteMode } from '../../../commands/types';

/**
 * Common props passed to all panel components
 */
export interface BasePanelProps {
  /** Current search/filter query */
  query: string;
  /** Callback to update the query */
  setQuery: (query: string) => void;
  /** Callback to close the palette */
  onClose: () => void;
  /** Callback when mode changes */
  onModeChange?: (mode: PaletteMode) => void;
}

/**
 * Props for CommandModePanel
 */
export interface CommandModePanelProps extends BasePanelProps {
  /** Available commands */
  commands: Command[];
  /** Currently selected index */
  selectedIndex: number;
  /** Callback to update selected index */
  setSelectedIndex: (index: number) => void;
  /** Callback when a command is selected */
  onCommandSelect: (command: Command) => void;
  /** Callback when a search result is selected */
  onSearchResultSelect?: (result: SearchResult) => void;
  /** Optional filter function for commands */
  filterCommands?: (commands: Command[], query: string) => Command[];
  /** Callback to create a daily note for a specific date */
  onCreateDailyNote?: (isoDate: string) => Promise<void>;
}

/**
 * Props for FileBrowsePanel
 */
export interface FileBrowsePanelProps extends BasePanelProps {
  /** All notes in the vault */
  allNotes: Note[];
  /** Whether notes are loading */
  isLoading: boolean;
  /** Currently selected note index */
  selectedNoteIndex: number;
  /** Callback to update selected note index */
  setSelectedNoteIndex: (index: number) => void;
  /** Current note ID to exclude from display */
  currentNoteId?: NoteId | null;
  /** Callback when a note is selected */
  onNoteSelect?: (noteId: NoteId) => void;
  /** Callback to initiate note deletion (transitions to delete-confirm) */
  onDeleteNote: (note: Note) => void;
}

/**
 * Props for DeleteBrowsePanel
 */
export interface DeleteBrowsePanelProps extends BasePanelProps {
  /** All notes in the vault */
  allNotes: Note[];
  /** Whether notes are loading */
  isLoading: boolean;
  /** Currently selected note index */
  selectedNoteIndex: number;
  /** Callback to update selected note index */
  setSelectedNoteIndex: (index: number) => void;
  /** Current note ID to exclude from display */
  currentNoteId?: NoteId | null;
  /** Callback when a note is selected for deletion */
  onSelectForDelete: (note: Note) => void;
}

/**
 * Props for DeleteConfirmDialog
 */
export interface DeleteConfirmDialogProps {
  /** Note pending deletion */
  pendingDeleteNote: Note | null;
  /** Whether delete operation is in progress */
  isDeleting: boolean;
  /** Callback to cancel deletion */
  onCancel: () => void;
  /** Callback to confirm deletion */
  onConfirm: () => void;
}

/**
 * Props for PersonBrowsePanel
 */
export interface PersonBrowsePanelProps extends BasePanelProps {
  /** All people in the vault */
  allPeople: Note[];
  /** Whether people are loading */
  isLoading: boolean;
  /** Currently selected person index */
  selectedPersonIndex: number;
  /** Callback to update selected person index */
  setSelectedPersonIndex: (index: number) => void;
  /** Callback when a person is selected */
  onPersonSelect?: (noteId: NoteId) => void;
}

/**
 * Props for PromptInputPanel
 */
export interface PromptInputPanelProps {
  /** Placeholder text for the input */
  placeholder?: string;
  /** Current input value */
  value: string;
  /** Callback to update input value */
  setValue: (value: string) => void;
  /** Callback when input is submitted */
  onSubmit: (value: string) => void;
  /** Callback when input is cancelled */
  onCancel: () => void;
}
