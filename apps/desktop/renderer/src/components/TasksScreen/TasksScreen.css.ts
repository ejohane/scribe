/**
 * TasksScreen component styles
 *
 * Styles for the full Tasks screen layout with header, filters, and task list.
 */

import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Main container for the Tasks screen
 */
export const container = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: vars.color.background,
  overflow: 'hidden',
});

/**
 * Header section with title
 */
export const header = style({
  padding: vars.spacing['6'],
  paddingTop: '40px', // Account for macOS titlebar
  paddingBottom: vars.spacing['4'],
  flexShrink: 0,
});

/**
 * Page title
 */
export const title = style({
  fontSize: vars.typography.size['3xl'],
  fontWeight: vars.typography.weight.bold,
  fontFamily: vars.typography.fontFamily.serif,
  color: vars.color.foreground,
  letterSpacing: '-0.02em',
  margin: 0,
});

/**
 * Filters section
 */
export const filters = style({
  padding: `0 ${vars.spacing['6']}`,
  flexShrink: 0,
});

/**
 * Scrollable content area for task list
 */
export const content = style({
  flex: 1,
  overflowY: 'auto',
  padding: vars.spacing['6'],
  paddingTop: vars.spacing['4'],
});

/**
 * Task list container
 */
export const taskList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['2'],
});

/**
 * Empty state container
 */
export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: vars.spacing['12'],
  textAlign: 'center',
});

/**
 * Empty state icon
 */
export const emptyIcon = style({
  width: '64px',
  height: '64px',
  marginBottom: vars.spacing['4'],
  color: vars.color.foregroundMuted,
  opacity: 0.4,
});

/**
 * Empty state title
 */
export const emptyTitle = style({
  fontSize: vars.typography.size.lg,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
  marginBottom: vars.spacing['2'],
});

/**
 * Empty state description
 */
export const emptyDescription = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
  maxWidth: '280px',
});

/**
 * Loading spinner animation
 */
const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

/**
 * Loading state container
 */
export const loadingState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: vars.spacing['12'],
  textAlign: 'center',
});

/**
 * Loading spinner
 */
export const loadingSpinner = style({
  width: '32px',
  height: '32px',
  marginBottom: vars.spacing['4'],
  border: `3px solid ${vars.color.border}`,
  borderTopColor: vars.color.accent,
  borderRadius: '50%',
  animation: `${spin} 0.8s linear infinite`,
});

/**
 * Loading text
 */
export const loadingText = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
});

/**
 * Load more button container
 */
export const loadMoreContainer = style({
  display: 'flex',
  justifyContent: 'center',
  padding: vars.spacing['4'],
  paddingTop: vars.spacing['6'],
});

/**
 * Load more button
 */
export const loadMoreButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  padding: `${vars.spacing['2']} ${vars.spacing['4']}`,
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  color: vars.color.foreground,
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  cursor: 'pointer',
  transition: `all ${vars.animation.duration.normal} ${vars.animation.easing.default}`,

  ':hover': {
    backgroundColor: vars.color.background,
    borderColor: vars.color.accent,
  },

  ':focus': {
    outline: 'none',
    borderColor: vars.color.accent,
    boxShadow: `0 0 0 2px ${vars.color.accent}33`,
  },

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});
