import { style, styleVariants, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Base container for the sync status indicator
 */
export const container = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
});

/**
 * Clickable indicator button
 */
export const indicatorButton = style({
  background: 'none',
  border: 'none',
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  cursor: 'default',
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
  borderRadius: vars.radius.sm,
  transition: `background-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  fontSize: vars.typography.size.xs,
  fontFamily: 'inherit',
  color: vars.color.foregroundMuted,

  selectors: {
    '&:not(:disabled)': {
      cursor: 'pointer',
    },
    '&:not(:disabled):hover': {
      backgroundColor: vars.color.surface,
    },
  },
});

/**
 * Spin animation for syncing state
 */
const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

/**
 * Pulse animation for pending state
 */
const pulse = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.6 },
});

/**
 * Base icon styles
 */
const iconBase = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '14px',
  height: '14px',
  flexShrink: 0,
});

/**
 * Icon variants for each sync state
 */
export const icon = styleVariants({
  synced: [
    iconBase,
    {
      color: vars.color.success,
    },
  ],
  syncing: [
    iconBase,
    {
      color: vars.color.accent,
      animation: `${spin} 1s linear infinite`,
    },
  ],
  pending: [
    iconBase,
    {
      color: vars.color.warning,
      animation: `${pulse} 2s ease-in-out infinite`,
    },
  ],
  conflict: [
    iconBase,
    {
      color: vars.color.warning,
    },
  ],
  offline: [
    iconBase,
    {
      color: vars.color.foregroundMuted,
    },
  ],
  error: [
    iconBase,
    {
      color: vars.color.danger,
    },
  ],
  disabled: [
    iconBase,
    {
      color: vars.color.foregroundMuted,
    },
  ],
});

/**
 * Label text
 */
export const label = style({
  color: 'inherit',
  whiteSpace: 'nowrap',
});

/**
 * Conflict badge count
 */
export const conflictBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '16px',
  height: '16px',
  padding: `0 ${vars.spacing['1']}`,
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.warning,
  color: vars.color.foreground,
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
});
