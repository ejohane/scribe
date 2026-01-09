/**
 * NoteContextMenu Styles
 *
 * Vanilla-extract styles for the note context menu.
 * Uses design system tokens for consistent theming.
 */

import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

export const contextMenu = style({
  position: 'fixed',
  minWidth: '160px',
  padding: `${vars.spacing['1']} 0`,
  background: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.md,
  zIndex: vars.zIndex.popover,
});

export const menuItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  width: '100%',
  padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
  border: 'none',
  background: 'transparent',
  color: vars.color.foreground,
  fontSize: vars.typography.size.sm,
  textAlign: 'left',
  cursor: 'pointer',
  transition: `background ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  ':hover': {
    background: vars.color.backgroundAlt,
  },

  ':focus': {
    outline: 'none',
    background: vars.color.backgroundAlt,
  },

  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '-2px',
    background: vars.color.backgroundAlt,
  },

  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
});
