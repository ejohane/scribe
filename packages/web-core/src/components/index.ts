export { CollaborativeEditor } from './CollaborativeEditor';
export type { CollaborativeEditorProps, CollabEditorProps } from './CollaborativeEditor';

// Command Palette - Components
export {
  CommandPalette,
  CommandPaletteProvider,
  useCommandPalette,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteSection,
} from './CommandPalette';

// Command Palette - Hooks
export { useRecentNotes, useNoteSearch, useDebouncedValue } from './CommandPalette';

// Command Palette - Utilities
export { filterCommands, fuzzyMatch, fuzzyScore, builtInCommands } from './CommandPalette';

// Command Palette - Constants
export {
  BUILTIN_COMMAND_IDS,
  KEYBOARD_SHORTCUTS,
  BUILTIN_CATEGORIES,
  NOTE_SEARCH_DEBOUNCE_MS,
  RECENT_NOTES_LIMIT,
  SEARCH_RESULTS_LIMIT,
  ANIMATION_DURATION_MS,
  SEARCH_NOTES_COMMAND_ID,
} from './CommandPalette';

// Command Palette - Types
export type {
  CommandPaletteProps,
  CommandPaletteProviderProps,
  CommandPaletteInputProps,
  CommandPaletteItemProps,
  CommandPaletteSectionProps,
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
} from './CommandPalette';
