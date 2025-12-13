/**
 * DraggableTaskList component styles
 *
 * Styles for the draggable task list container and drag overlay.
 */

import { style, keyframes } from '@vanilla-extract/css';
import { vars, emptyStateInline } from '@scribe/design-system';

/**
 * Main list container
 */
export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
});

/**
 * Empty state container - extends design system style with centered text
 */
export const emptyState = style([emptyStateInline, { textAlign: 'center' }]);

/**
 * Drop placeholder animation
 */
const dropPlaceholderPulse = keyframes({
  '0%, 100%': {
    opacity: 0.4,
  },
  '50%': {
    opacity: 0.6,
  },
});

/**
 * Drop placeholder when dragging over
 */
export const dropPlaceholder = style({
  height: '4px',
  backgroundColor: vars.color.accent,
  borderRadius: vars.radius.full,
  margin: `${vars.spacing['1']} 0`,
  animation: `${dropPlaceholderPulse} 1s ease-in-out infinite`,
});

/**
 * Drag overlay wrapper
 */
export const dragOverlay = style({
  cursor: 'grabbing',
});

/**
 * Sortable item wrapper
 */
export const sortableItem = style({
  touchAction: 'none',
});

/**
 * Sortable item when being dragged (placeholder in original position)
 */
export const sortableItemDragging = style({
  opacity: 0.3,
});
