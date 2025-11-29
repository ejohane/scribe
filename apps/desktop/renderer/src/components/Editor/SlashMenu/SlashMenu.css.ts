/**
 * SlashMenu Styles
 *
 * Vanilla-extract styles for the slash command menu.
 * Appears below cursor when user types "/" at start of line or after space.
 */

import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(-4px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

export const menu = style({
  position: 'fixed',
  zIndex: vars.zIndex.popover,
  minWidth: '280px',
  maxWidth: '320px',
  maxHeight: '300px',
  overflow: 'auto',

  backgroundColor: vars.color.background,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.lg,
  border: `1px solid ${vars.color.border}`,

  animation: `${fadeIn} ${vars.animation.duration.normal} ${vars.animation.easing.default}`,
});

export const menuItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
  padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
  cursor: 'pointer',
  transition: `background-color ${vars.animation.duration.fast}`,

  ':hover': {
    backgroundColor: vars.color.backgroundAlt,
  },
});

export const menuItemSelected = style({
  backgroundColor: vars.color.surface,
});

export const menuItemIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  color: vars.color.foreground,
  flexShrink: 0,
});

export const menuItemIconAi = style({
  backgroundColor: vars.color.warning,
  color: vars.color.background,
});

export const menuItemText = style({
  flex: 1,
  minWidth: 0,
});

export const menuItemLabel = style({
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
});

export const menuItemDescription = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
});

export const emptyState = style({
  padding: `${vars.spacing['4']} ${vars.spacing['3']}`,
  textAlign: 'center',
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
});

export const divider = style({
  height: '1px',
  backgroundColor: vars.color.border,
  margin: `${vars.spacing['2']} 0`,
});

export const sectionLabel = style({
  padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foregroundMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});
