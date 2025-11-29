/**
 * WikiLinkAutocomplete Styles
 *
 * Vanilla-extract styles for the wiki-link autocomplete popup.
 * Uses design system tokens for consistent theming.
 * Matches the SlashMenu floating menu design.
 */

import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(-4px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

export const dropdown = style({
  position: 'fixed',
  zIndex: vars.zIndex.popover,
  minWidth: '200px',
  maxWidth: '320px',
  maxHeight: '300px',
  overflow: 'auto',

  backgroundColor: vars.color.background,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.lg,
  border: `1px solid ${vars.color.border}`,

  animation: `${fadeIn} ${vars.animation.duration.normal} ${vars.animation.easing.default}`,
});

export const listContainer = style({
  overflowY: 'auto',
  maxHeight: '300px',
});

export const item = style({
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

export const itemSelected = style({
  backgroundColor: vars.color.surface,
});

export const itemIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.md,
  flexShrink: 0,
});

export const itemText = style({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: vars.typography.size.sm,
  color: vars.color.foreground,
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
  padding: `${vars.spacing['4']} ${vars.spacing['3']}`,
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
  textAlign: 'center',
});

export const empty = style({
  padding: `${vars.spacing['4']} ${vars.spacing['3']}`,
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
  textAlign: 'center',
});
