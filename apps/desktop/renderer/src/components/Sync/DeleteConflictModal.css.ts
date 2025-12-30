import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Modal container
 */
export const container = style({
  width: '480px',
  maxWidth: '90vw',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: vars.color.surface,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.lg,
  overflow: 'hidden',
});

/**
 * Modal header with icon and title
 */
export const header = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: vars.spacing['3'],
  padding: vars.spacing['4'],
  borderBottom: `1px solid ${vars.color.border}`,
});

/**
 * Alert icon in header
 */
export const alertIcon = style({
  color: vars.color.warning,
  flexShrink: 0,
  marginTop: vars.spacing['1'],
});

/**
 * Header text container
 */
export const headerText = style({
  flex: 1,
  minWidth: 0,
});

/**
 * Modal body content
 */
export const body = style({
  padding: vars.spacing['4'],
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['4'],
});

/**
 * Note title display
 */
export const noteTitle = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  padding: vars.spacing['3'],
  backgroundColor: vars.color.backgroundAlt,
  borderRadius: vars.radius.md,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
});

/**
 * File icon for note title
 */
export const fileIcon = style({
  color: vars.color.foregroundMuted,
  flexShrink: 0,
});

/**
 * Note title text
 */
export const noteTitleText = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

/**
 * Explanation text
 */
export const explanation = style({
  color: vars.color.foregroundMuted,
  lineHeight: 1.5,
});

/**
 * Modal footer with action buttons
 */
export const footer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: vars.spacing['2'],
  padding: vars.spacing['4'],
  borderTop: `1px solid ${vars.color.border}`,
});

/**
 * Primary action button (restore/keep)
 */
export const primaryAction = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
});

/**
 * Destructive action button (delete)
 */
export const destructiveAction = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
});
