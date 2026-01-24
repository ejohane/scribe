/**
 * Command Palette Types and Constants
 *
 * Defines the type system for the command palette, including views, items,
 * and context types.
 *
 * @module
 */

import type { CommandContext, CommandPaletteCommandHandler } from '@scribe/plugin-core';

// ============================================================================
// View Types
// ============================================================================

/**
 * The current view mode of the command palette.
 */
export type CommandPaletteView = 'command' | 'note-search';

// ============================================================================
// Item Types
// ============================================================================

/**
 * Base interface for all command palette items.
 */
export interface BaseCommandPaletteItem {
  /** Unique identifier for the item */
  id: string;
  /** Display label */
  label: string;
  /** Optional description shown below the label */
  description?: string;
  /** Optional Lucide icon name */
  icon?: string;
  /** Display hint for keyboard shortcut */
  shortcut?: string;
}

/**
 * A command item in the palette.
 */
export interface CommandItem extends BaseCommandPaletteItem {
  type: 'command';
  /** Category for grouping commands */
  category: string;
  /** Sort priority within category (lower = higher) */
  priority: number;
  /** Handler function to execute the command */
  handler: CommandPaletteCommandHandler;
}

/**
 * A note item in the palette (from search or recent).
 */
export interface NoteItem extends BaseCommandPaletteItem {
  type: 'note';
  /** Note type (note, daily, meeting, person) */
  noteType: 'note' | 'daily' | 'meeting' | 'person';
  /** When the note was last accessed */
  lastAccessedAt?: string;
  /** When the note was last updated */
  updatedAt?: string;
  /** Search snippet with match context */
  snippet?: string;
}

/**
 * Union of all item types.
 */
export type CommandPaletteItem = CommandItem | NoteItem;

// ============================================================================
// Section Types
// ============================================================================

/**
 * A section in the command palette for grouping items.
 */
export interface CommandPaletteSection {
  /** Section identifier */
  id: string;
  /** Display label */
  label: string;
  /** Items in this section */
  items: CommandPaletteItem[];
}

// ============================================================================
// State Types
// ============================================================================

/**
 * State for the command palette.
 */
export interface CommandPaletteState {
  /** Whether the palette is open */
  isOpen: boolean;
  /** Current view mode */
  view: CommandPaletteView;
  /** Search query */
  query: string;
  /** Index of the currently selected item (across all sections) */
  selectedIndex: number;
  /** Whether note search is loading */
  isSearching: boolean;
}

/**
 * Actions for updating command palette state.
 */
export interface CommandPaletteActions {
  /** Open the palette */
  open: (view?: CommandPaletteView) => void;
  /** Close the palette */
  close: () => void;
  /** Toggle the palette open/closed */
  toggle: (view?: CommandPaletteView) => void;
  /** Set the search query */
  setQuery: (query: string) => void;
  /** Move selection up */
  selectPrevious: () => void;
  /** Move selection down */
  selectNext: () => void;
  /** Execute the currently selected item */
  executeSelected: () => void;
  /** Switch to a different view */
  setView: (view: CommandPaletteView) => void;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Full context value for the command palette.
 */
export interface CommandPaletteContextValue extends CommandPaletteState, CommandPaletteActions {
  /** All sections with their items */
  sections: CommandPaletteSection[];
  /** Total number of items across all sections */
  totalItems: number;
  /** Get the currently selected item */
  getSelectedItem: () => CommandPaletteItem | null;
  /** Get the command context for executing commands */
  commandContext: CommandContext;
}

// ============================================================================
// Built-in Command Types
// ============================================================================

/**
 * Built-in command registration.
 */
export interface BuiltInCommand {
  id: string;
  label: string;
  description?: string;
  icon: string;
  shortcut?: string;
  category: string;
  priority: number;
  execute: (ctx: CommandContext) => void | Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default debounce delay for note search (ms).
 */
export const NOTE_SEARCH_DEBOUNCE_MS = 300;

/**
 * Maximum number of recent notes to display.
 */
export const RECENT_NOTES_LIMIT = 10;

/**
 * Maximum number of search results to display.
 */
export const SEARCH_RESULTS_LIMIT = 20;

/**
 * Animation duration for the palette (ms).
 */
export const ANIMATION_DURATION_MS = 150;

/**
 * Built-in command categories.
 */
export const BUILTIN_CATEGORIES = {
  NOTES: 'Notes',
  NAVIGATION: 'Navigation',
  GENERAL: 'General',
} as const;

/**
 * Built-in command IDs for easy reference.
 */
export const BUILTIN_COMMAND_IDS = {
  NEW_NOTE: 'core.newNote',
  SEARCH_NOTES: 'core.searchNotes',
  NEW_MEETING: 'core.newMeeting',
  SETTINGS: 'core.settings',
} as const;

/**
 * Keyboard shortcuts used in the command palette.
 */
export const KEYBOARD_SHORTCUTS = {
  OPEN_PALETTE: '⌘K',
  CLOSE: 'Escape',
  SELECT_NEXT: 'ArrowDown',
  SELECT_PREVIOUS: 'ArrowUp',
  EXECUTE: 'Enter',
  NEW_NOTE: '⌘N',
  SEARCH_NOTES: '⌘⇧F',
  SETTINGS: '⌘,',
} as const;

/**
 * Alias for CommandPaletteItem for convenience.
 */
export type PaletteItem = CommandPaletteItem;
