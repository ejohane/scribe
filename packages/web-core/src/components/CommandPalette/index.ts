/**
 * Command Palette Module
 *
 * Exports all command palette components, hooks, and utilities.
 *
 * @module
 */

// Main component
export { CommandPalette } from './CommandPalette';
export type { CommandPaletteProps } from './CommandPalette';

// Provider and hook
export { CommandPaletteProvider, useCommandPalette } from './CommandPaletteProvider';
export type { CommandPaletteProviderProps } from './CommandPaletteProvider';

// Sub-components
export { CommandPaletteInput } from './CommandPaletteInput';
export type { CommandPaletteInputProps } from './CommandPaletteInput';

export { CommandPaletteItem } from './CommandPaletteItem';
export type { CommandPaletteItemProps } from './CommandPaletteItem';

export { CommandPaletteSection } from './CommandPaletteSection';
export type { CommandPaletteSectionProps } from './CommandPaletteSection';

// Types and constants
export * from './types';

// Utilities
export { filterCommands, fuzzyMatch, fuzzyScore } from './fuzzyFilter';
export { builtInCommands, SEARCH_NOTES_COMMAND_ID } from './builtInCommands';

// Hooks
export { useRecentNotes } from './useRecentNotes';
export { useNoteSearch } from './useNoteSearch';
export { useDebouncedValue } from './useDebouncedValue';
