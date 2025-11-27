/**
 * PersonMentionAutocomplete Styles
 *
 * Vanilla-extract styles for the person mention autocomplete popup.
 * Uses design system tokens for consistent theming.
 */

import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

export const autocompleteContainer = style({
  position: 'absolute',
  width: '280px',
  maxHeight: '300px',
  overflow: 'auto',
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.lg,
  zIndex: 1000, // High z-index for popover
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
