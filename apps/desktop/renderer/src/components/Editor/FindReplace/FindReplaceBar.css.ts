/**
 * FindReplaceBar Styles
 *
 * Vanilla-extract styles for the find/replace search bar.
 * Fixed position in top-right, slides in when opened.
 */

import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

const slideIn = keyframes({
  from: { opacity: 0, transform: 'translateY(-8px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

export const container = style({
  position: 'fixed',
  top: vars.spacing['4'], // 16px from top
  right: vars.spacing['4'], // 16px from right
  zIndex: vars.zIndex.popover, // Above content, below modal

  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'], // 8px between elements
  padding: vars.spacing['2'], // 8px all around

  backgroundColor: vars.color.background,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.lg,
  border: `1px solid ${vars.color.border}`,

  animation: `${slideIn} ${vars.animation.duration.normal} ${vars.animation.easing.default}`,
});

export const searchIcon = style({
  color: vars.color.foregroundMuted,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
});

export const input = style({
  width: '200px',
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  fontSize: vars.typography.size.sm,
  fontFamily: vars.typography.fontFamily.ui,
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  color: vars.color.foreground,
  outline: 'none',

  ':focus': {
    borderColor: vars.color.accent,
    boxShadow: `0 0 0 2px color-mix(in srgb, ${vars.color.accent} 20%, transparent)`,
  },

  '::placeholder': {
    color: vars.color.foregroundMuted,
  },
});

export const matchCount = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
  minWidth: '56px', // Prevent layout shift
  textAlign: 'center',
  whiteSpace: 'nowrap',
});

export const noResults = style({
  color: vars.color.danger, // Red for "no results"
});

export const navButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: vars.color.foreground,
  transition: `all ${vars.animation.duration.fast}`,

  ':hover': {
    backgroundColor: vars.color.surface,
  },

  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },

  selectors: {
    '&:disabled:hover': {
      backgroundColor: 'transparent',
    },
  },
});

export const closeButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: vars.color.foreground,
  transition: `all ${vars.animation.duration.fast}`,

  ':hover': {
    backgroundColor: vars.color.danger,
    color: vars.color.background, // White text on red bg
  },

  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },
});

/**
 * Match highlight styles for the editor
 * These are applied via MarkNode to matched text
 */
export const searchMatch = style({
  backgroundColor: `color-mix(in srgb, ${vars.color.warning} 30%, transparent)`,
  borderRadius: '2px',
});

export const searchMatchActive = style({
  backgroundColor: vars.color.warning,
  color: vars.color.background,
  borderRadius: '2px',
});
