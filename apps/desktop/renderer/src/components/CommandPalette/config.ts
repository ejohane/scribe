/**
 * CommandPalette Configuration
 *
 * Shared constants for the CommandPalette component.
 * Exported for reuse in tests and potential customization.
 */

/**
 * Maximum number of fuzzy search results to display in file-browse mode.
 * Limits result set for performance and UX.
 */
export const MAX_SEARCH_RESULTS = 25;

/**
 * Maximum number of recent notes to display in file-browse mode
 * when no search query is entered.
 */
export const MAX_RECENT_NOTES = 10;

/**
 * Debounce delay in milliseconds for search input.
 * Prevents excessive API calls while typing.
 */
export const SEARCH_DEBOUNCE_MS = 150;

/**
 * Maximum characters for note titles in delete confirmation dialog
 * and toast notifications before truncation occurs.
 */
export const DELETE_TITLE_TRUNCATION_LENGTH = 30;

/**
 * Default maximum length for title truncation in other contexts
 * (e.g., note list items).
 */
export const DEFAULT_TITLE_TRUNCATION_LENGTH = 50;
