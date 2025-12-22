/**
 * Shared Timing Constants for Desktop Renderer
 *
 * This file contains named constants for timing-related values used throughout
 * the desktop renderer. Using named constants instead of magic numbers provides:
 *
 * - **Clarity**: `TOAST_AUTO_DISMISS_MS` is self-documenting; `3000` is not
 * - **Consistency**: Ensures uniform behavior across components
 * - **Maintainability**: Change timing in one place, not scattered throughout
 * - **Discoverability**: All timing constants are documented here
 *
 * @see architecture/decision_3_internal_architecture.md for coding standards
 */

// =============================================================================
// Toast & Notification Durations
// =============================================================================

/**
 * How long success/info toasts remain visible before auto-dismissing.
 *
 * 3 seconds is a standard UX choice that balances:
 * - Enough time to read short messages
 * - Not so long that it feels sticky
 *
 * @see useToast.ts
 */
export const TOAST_AUTO_DISMISS_MS = 3000;

/**
 * How long error notifications remain visible before auto-dismissing.
 *
 * 5 seconds (longer than regular toasts) because:
 * - Error messages may require more reading time
 * - Users need time to understand what went wrong
 * - Important enough to not disappear too quickly
 *
 * @see ErrorNotification.tsx
 */
export const ERROR_NOTIFICATION_DURATION_MS = 5000;

// =============================================================================
// Mouse Activity & UI Visibility
// =============================================================================

/**
 * How long to wait after the last mouse movement before hiding UI elements.
 *
 * 2 seconds provides a balance between:
 * - Not hiding UI too quickly while user is thinking
 * - Not keeping UI visible too long when user is focused on content
 *
 * @see useMouseActivity.ts
 */
export const MOUSE_INACTIVITY_THRESHOLD_MS = 2000;

// =============================================================================
// Accessibility Announcements
// =============================================================================

/**
 * How long to keep screen reader announcements in the live region before clearing.
 *
 * 1 second is sufficient for:
 * - Screen reader to capture and announce the text
 * - Clearing the region so duplicate announcements don't accumulate
 *
 * @see DateNavigator.tsx
 */
export const SCREEN_READER_ANNOUNCEMENT_TIMEOUT_MS = 1000;

// =============================================================================
// Debounce Timings (search-related are in CommandPalette/config.ts)
// =============================================================================

/**
 * How long to wait after hover ends before hiding hover-triggered UI.
 *
 * Small delay prevents flickering when moving between elements.
 * Used for hover-to-reveal patterns like date navigation chevrons.
 *
 * @see DateNavigator.tsx
 */
export const HOVER_HIDE_DEBOUNCE_MS = 150;

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Standard wait time for async operations in tests.
 *
 * Used when tests need to wait for debounced operations or state updates.
 * Should match or slightly exceed actual debounce timings.
 */
export const TEST_ASYNC_BUFFER_MS = 100;

/**
 * Longer wait time for tests involving search debounce.
 *
 * Should be SEARCH_DEBOUNCE_MS + buffer to ensure search completes.
 * @see CommandPalette/config.ts for SEARCH_DEBOUNCE_MS (150ms)
 */
export const TEST_SEARCH_BUFFER_MS = 200;
