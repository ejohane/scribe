/**
 * PersonMentionAutocomplete Styles
 *
 * Vanilla-extract styles for the person mention autocomplete popup.
 * Uses design system tokens for consistent theming.
 * Matches the SlashMenu floating menu design.
 */

import { style, keyframes } from '@vanilla-extract/css';
import { vars, emptyStateCentered } from '@scribe/design-system';

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(-4px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

export const autocompleteContainer = style({
  position: 'absolute',
  zIndex: vars.zIndex.popover,
  minWidth: '200px',
  maxWidth: '280px',
  maxHeight: '300px',
  overflow: 'auto',

  backgroundColor: vars.color.background,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.lg,
  border: `1px solid ${vars.color.border}`,

  animation: `${fadeIn} ${vars.animation.duration.normal} ${vars.animation.easing.default}`,
});

export const autocompleteItem = style({
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

export const autocompleteItemSelected = style({
  backgroundColor: vars.color.surface,
});

export const itemIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.accent,
  color: vars.color.accentForeground,
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
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

export const createOption = style({
  borderTop: `1px solid ${vars.color.border}`,
  marginTop: vars.spacing['2'],
  paddingTop: vars.spacing['2'],
});

export const createIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surface,
  color: vars.color.accent,
  fontSize: vars.typography.size.lg,
  flexShrink: 0,
});

/**
 * Empty state - re-exported from design system
 */
export const emptyState = emptyStateCentered;

export const loadingState = style({
  padding: `${vars.spacing['4']} ${vars.spacing['3']}`,
  color: vars.color.foregroundMuted,
  textAlign: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.spacing['2'],
  fontSize: vars.typography.size.sm,
});

export const spinner = style({
  width: '14px',
  height: '14px',
  border: `2px solid ${vars.color.border}`,
  borderTopColor: vars.color.accent,
  borderRadius: vars.radius.full,
  animation: `${spin} 0.6s linear infinite`,
});
