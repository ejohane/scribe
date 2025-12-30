import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Spin animation for the sync icon
 */
const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

/**
 * Modal container
 */
export const container = style({
  width: '400px',
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
  alignItems: 'center',
  gap: vars.spacing['3'],
  padding: vars.spacing['4'],
  borderBottom: `1px solid ${vars.color.border}`,
});

/**
 * Icon container in header
 */
export const iconContainer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  flexShrink: 0,
});

/**
 * Spinning sync icon during active sync
 */
export const spinningIcon = style({
  color: vars.color.accent,
  animation: `${spin} 1s linear infinite`,
});

/**
 * Static success icon when completed
 */
export const successIcon = style({
  color: vars.color.success,
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
 * Progress bar container
 */
export const progressContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['2'],
});

/**
 * Progress bar track (background)
 */
export const progressTrack = style({
  width: '100%',
  height: '8px',
  backgroundColor: vars.color.backgroundAlt,
  borderRadius: vars.radius.full,
  overflow: 'hidden',
});

/**
 * Progress bar fill
 */
export const progressFill = style({
  height: '100%',
  backgroundColor: vars.color.accent,
  borderRadius: vars.radius.full,
  transition: `width ${vars.animation.duration.normal} ${vars.animation.easing.default}`,
});

/**
 * Progress text showing items processed
 */
export const progressText = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

/**
 * Phase label
 */
export const phaseLabel = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.foreground,
  fontWeight: vars.typography.weight.medium,
});

/**
 * Items counter (e.g., "5 of 10")
 */
export const itemsCounter = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
});

/**
 * Conflict warning container
 */
export const conflictWarning = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  padding: vars.spacing['3'],
  backgroundColor: vars.color.backgroundAlt,
  borderRadius: vars.radius.md,
  borderLeft: `3px solid ${vars.color.warning}`,
});

/**
 * Warning icon color
 */
export const warningIcon = style({
  color: vars.color.warning,
  flexShrink: 0,
});

/**
 * Modal footer
 */
export const footer = style({
  display: 'flex',
  justifyContent: 'flex-end',
  padding: vars.spacing['4'],
  borderTop: `1px solid ${vars.color.border}`,
});
