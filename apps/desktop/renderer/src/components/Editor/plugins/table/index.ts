/**
 * Table keyboard plugin and hooks
 *
 * Re-exports the main plugin for easy imports
 */

export { TableKeyboardPlugin } from './TableKeyboardPlugin';

// Also export individual hooks for testing and composition
export { useTableTabNavigation } from './useTableTabNavigation';
export { useTableEnterBehavior } from './useTableEnterBehavior';
export { useTableEscape } from './useTableEscape';
export { useTableSelectAll } from './useTableSelectAll';
export { useTableDeletion } from './useTableDeletion';
