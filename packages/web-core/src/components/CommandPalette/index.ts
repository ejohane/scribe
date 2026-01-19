/**
 * Command Palette Module
 *
 * Exports all command palette components, hooks, and utilities.
 *
 * @module
 */

// ============================================================================
// Components
// ============================================================================

export { CommandPalette } from './CommandPalette';
export type { CommandPaletteProps } from './CommandPalette';

export { CommandPaletteInput } from './CommandPaletteInput';
export type { CommandPaletteInputProps } from './CommandPaletteInput';

export { CommandPaletteItem } from './CommandPaletteItem';
export type { CommandPaletteItemProps } from './CommandPaletteItem';

export { CommandPaletteSection } from './CommandPaletteSection';
export type { CommandPaletteSectionProps } from './CommandPaletteSection';

// ============================================================================
// Provider and Context Hook
// ============================================================================

export { CommandPaletteProvider, useCommandPalette } from './CommandPaletteProvider';
export type { CommandPaletteProviderProps } from './CommandPaletteProvider';

// ============================================================================
// Types
// ============================================================================

export type {
  CommandPaletteView,
  CommandPaletteState,
  CommandPaletteActions,
  CommandPaletteContextValue,
  CommandPaletteSection as CommandPaletteSectionType,
  CommandPaletteItem as CommandPaletteItemType,
  BaseCommandPaletteItem,
  CommandItem,
  NoteItem,
  BuiltInCommand,
  PaletteItem,
} from './types';

// ============================================================================
// Constants
// ============================================================================

export {
  BUILTIN_COMMAND_IDS,
  KEYBOARD_SHORTCUTS,
  BUILTIN_CATEGORIES,
  NOTE_SEARCH_DEBOUNCE_MS,
  RECENT_NOTES_LIMIT,
  SEARCH_RESULTS_LIMIT,
  ANIMATION_DURATION_MS,
} from './types';

export { builtInCommands, SEARCH_NOTES_COMMAND_ID } from './builtInCommands';

// ============================================================================
// Hooks
// ============================================================================

export { useRecentNotes } from './useRecentNotes';
export { useNoteSearch } from './useNoteSearch';
export { useDebouncedValue } from './useDebouncedValue';

// ============================================================================
// Utilities
// ============================================================================

export { filterCommands, fuzzyMatch, fuzzyScore } from './fuzzyFilter';
