/**
 * TaskItem component styles
 *
 * Styles for individual task row in the draggable task list.
 * Supports both truncated (panel) and full (screen) display modes.
 */

import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Container for a single task item
 */
export const taskItem = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: vars.spacing['2'],
  padding: vars.spacing['2'],
  borderRadius: vars.radius.md,
  backgroundColor: 'transparent',
  transition: `background-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  cursor: 'pointer',

  ':hover': {
    backgroundColor: vars.color.surface,
  },
});

/**
 * Task item when dragging
 */
export const taskItemDragging = style({
  backgroundColor: vars.color.surface,
  boxShadow: vars.shadow.md,
  opacity: 0.9,
});

/**
 * Task item with completed state
 */
export const taskItemCompleted = style({
  opacity: 0.6,
});

/**
 * Drag handle container (shown on left side)
 */
export const dragHandle = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '16px',
  height: '16px',
  flexShrink: 0,
  color: vars.color.foregroundMuted,
  cursor: 'grab',
  opacity: 0,
  transition: `opacity ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  marginTop: '2px',

  selectors: {
    [`${taskItem}:hover &`]: {
      opacity: 1,
    },
  },
});

/**
 * Always visible drag handle (for Tasks screen)
 */
export const dragHandleVisible = style({
  opacity: 0.6,

  selectors: {
    [`${taskItem}:hover &`]: {
      opacity: 1,
    },
  },
});

/**
 * Drag handle when actively dragging
 */
export const dragHandleActive = style({
  cursor: 'grabbing',
});

/**
 * Custom checkbox container
 */
export const checkbox = style({
  position: 'relative',
  width: '16px',
  height: '16px',
  flexShrink: 0,
  marginTop: '2px',
});

/**
 * Hidden native checkbox input
 */
export const checkboxInput = style({
  position: 'absolute',
  opacity: 0,
  width: '100%',
  height: '100%',
  cursor: 'pointer',
  margin: 0,
  zIndex: 1,
});

/**
 * Custom checkbox visual
 */
export const checkboxVisual = style({
  width: '16px',
  height: '16px',
  borderRadius: vars.radius.sm,
  border: `2px solid ${vars.color.border}`,
  backgroundColor: vars.color.background,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: `all ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  selectors: {
    [`${checkboxInput}:checked + &`]: {
      backgroundColor: vars.color.accent,
      borderColor: vars.color.accent,
    },
    [`${checkboxInput}:focus-visible + &`]: {
      boxShadow: `0 0 0 2px ${vars.color.background}, 0 0 0 4px ${vars.color.accent}`,
    },
  },
});

/**
 * Checkmark icon inside checkbox
 */
export const checkmark = style({
  width: '10px',
  height: '10px',
  color: vars.color.accentForeground,
  opacity: 0,
  transform: 'scale(0.5)',
  transition: `all ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  selectors: {
    [`${checkboxInput}:checked ~ ${checkboxVisual} &`]: {
      opacity: 1,
      transform: 'scale(1)',
    },
  },
});

/**
 * Task content container
 */
export const content = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
});

/**
 * Task text
 */
export const text = style({
  fontSize: vars.typography.size.sm,
  lineHeight: vars.typography.lineHeight.normal,
  color: vars.color.foreground,
});

/**
 * Text variants for truncation mode
 */
export const textVariants = styleVariants({
  truncate: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  full: {
    wordBreak: 'break-word',
  },
});

/**
 * Text with strikethrough for completed tasks
 */
export const textCompleted = style({
  textDecoration: 'line-through',
  color: vars.color.foregroundMuted,
});

/**
 * Metadata row (note title, date)
 */
export const meta = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
});

/**
 * Note title link
 */
export const noteTitle = style({
  cursor: 'pointer',
  transition: `color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  ':hover': {
    color: vars.color.accent,
  },
});

/**
 * Separator dot between meta items
 */
export const metaSeparator = style({
  width: '3px',
  height: '3px',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.border,
});

/**
 * Date text
 */
export const date = style({
  flexShrink: 0,
});
