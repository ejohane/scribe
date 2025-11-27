/**
 * WikiLinkAutocomplete Styles
 *
 * Vanilla-extract styles for the wiki-link autocomplete popup.
 * Uses design system tokens for consistent theming.
 */

import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

export const dropdown = style({
  position: 'fixed',
  zIndex: vars.zIndex.popover,
  width: '280px',
  maxHeight: '300px',
  overflow: 'hidden',
});

export const listContainer = style({
  overflowY: 'auto',
  maxHeight: '300px',
});

export const item = style({
  display: 'flex',
  alignItems: 'center',
  padding: `${vars.spacing['3']} ${vars.spacing['3']}`,
  cursor: 'pointer',
  borderBottom: `1px solid ${vars.color.border}`,
  transition: 'background-color 0.1s ease',
  selectors: {
    '&:last-child': {
      borderBottom: 'none',
    },
    '&:hover': {
      backgroundColor: vars.color.backgroundAlt,
    },
  },
});

export const itemSelected = style({
  backgroundColor: vars.color.backgroundAlt,
});

export const title = style({
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: vars.typography.size.sm,
  color: vars.color.foreground,
});

export const loading = style({
  padding: vars.spacing['3'],
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
  textAlign: 'center',
});

export const empty = style({
  padding: vars.spacing['3'],
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
  fontStyle: 'italic',
  textAlign: 'center',
});
