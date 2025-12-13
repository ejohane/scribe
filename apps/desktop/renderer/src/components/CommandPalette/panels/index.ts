/**
 * CommandPalette Panel Components
 *
 * Re-exports all panel components for easy importing.
 */

export { CommandModePanel } from './CommandModePanel';
export type { CommandModePanelProps } from './CommandModePanel';

export { FileBrowsePanel } from './FileBrowsePanel';
export type { FileBrowsePanelProps } from './FileBrowsePanel';

export { DeleteBrowsePanel } from './DeleteBrowsePanel';
export type { DeleteBrowsePanelProps } from './DeleteBrowsePanel';

export { DeleteConfirmDialog } from './DeleteConfirmDialog';
export type { DeleteConfirmDialogProps } from './DeleteConfirmDialog';

export { PersonBrowsePanel } from './PersonBrowsePanel';
export type { PersonBrowsePanelProps } from './PersonBrowsePanel';

export { PromptInputPanel } from './PromptInputPanel';
export type { PromptInputPanelProps } from './PromptInputPanel';

// Shared item component
export { PaletteItem, PaletteItemList } from './PaletteItem';
export type { PaletteItemProps, PaletteItemListProps } from './PaletteItem';

// Hooks
export { useFuzzySearch, useRecentNotes } from './useFuzzySearch';
export type { UseFuzzySearchOptions, UseFuzzySearchResult } from './useFuzzySearch';

export { useNotesData, usePeopleData } from './useNotesData';
export type { UseNotesDataOptions, UseNotesDataResult } from './useNotesData';

export { useKeyboardNavigation } from './useKeyboardNavigation';
export type { UseKeyboardNavigationOptions } from './useKeyboardNavigation';

// Utilities
export { truncateTitle, truncateTitleForDelete, isDateQuery, parseSearchDate } from './utils';
