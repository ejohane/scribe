/**
 * SelectionToolbar Styles
 *
 * Vanilla-extract styles for the floating selection toolbar.
 * Appears above selected text with formatting options.
 */

import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

const enter = keyframes({
  from: { opacity: 0, transform: 'translateX(-50%) scale(0.95)' },
  to: { opacity: 1, transform: 'translateX(-50%) scale(1)' },
});

export const toolbar = style({
  position: 'fixed',
  transform: 'translateX(-50%)',
  zIndex: vars.zIndex.popover,

  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
  padding: vars.spacing['2'],

  backgroundColor: vars.color.background,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.lg,
  border: `1px solid ${vars.color.border}`,

  animation: `${enter} ${vars.animation.duration.normal} ${vars.animation.easing.default}`,
});

export const button = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: vars.color.foreground,
  transition: `all ${vars.animation.duration.fast}`,

  ':hover': {
    backgroundColor: vars.color.surface,
  },
});

export const buttonActive = style({
  backgroundColor: vars.color.accent,
  color: vars.color.accentForeground,

  ':hover': {
    backgroundColor: vars.color.accent,
  },
});

export const divider = style({
  width: '1px',
  height: '20px',
  backgroundColor: vars.color.border,
  margin: `0 ${vars.spacing['1']}`,
});

export const askAiButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  cursor: 'pointer',
  color: vars.color.foreground,
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
  transition: `all ${vars.animation.duration.fast}`,

  ':hover': {
    backgroundColor: vars.color.backgroundAlt,
  },
});

export const pointer = style({
  position: 'absolute',
  bottom: '-6px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: '6px solid transparent',
  borderRight: '6px solid transparent',
  borderTop: `6px solid ${vars.color.background}`,
});

// Border for the pointer to match the toolbar border
export const pointerBorder = style({
  position: 'absolute',
  bottom: '-8px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: '7px solid transparent',
  borderRight: '7px solid transparent',
  borderTop: `7px solid ${vars.color.border}`,
});
