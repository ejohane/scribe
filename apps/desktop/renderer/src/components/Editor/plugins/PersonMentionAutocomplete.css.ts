/**
 * PersonMentionAutocomplete Styles
 *
 * Vanilla-extract styles for the person mention autocomplete popup.
 * Uses design system tokens for consistent theming.
 */

import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

export const autocompleteContainer = style({
  position: 'absolute',
  width: '280px',
  maxHeight: '300px',
  overflow: 'auto',
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.lg,
  zIndex: vars.zIndex.popover,
});

export const autocompleteItem = style({
  padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
  cursor: 'pointer',
  ':hover': {
    backgroundColor: vars.color.backgroundAlt,
  },
});

export const autocompleteItemSelected = style({
  backgroundColor: vars.color.backgroundAlt,
});

export const createOption = style({
  borderTop: `1px solid ${vars.color.border}`,
  color: vars.color.accent,
});

export const emptyState = style({
  padding: vars.spacing['3'],
  color: vars.color.foregroundMuted,
  textAlign: 'center',
});

export const loadingState = style({
  padding: vars.spacing['3'],
  color: vars.color.foregroundMuted,
  textAlign: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.spacing['2'],
});

export const spinner = style({
  width: '14px',
  height: '14px',
  border: `2px solid ${vars.color.border}`,
  borderTopColor: vars.color.accent,
  borderRadius: vars.radius.full,
  animation: `${spin} 0.6s linear infinite`,
});
