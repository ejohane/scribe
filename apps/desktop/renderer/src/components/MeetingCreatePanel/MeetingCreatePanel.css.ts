/**
 * MeetingCreatePanel Styles
 *
 * Styles for the meeting creation panel, using the same design system tokens
 * as CommandPalette for visual consistency.
 */

import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

export const container = style({
  padding: vars.spacing['6'],
  animation: `${fadeIn} 150ms ease-out`,
});

export const header = style({
  fontSize: vars.typography.size.md,
  fontWeight: vars.typography.weight.bold,
  marginBottom: vars.spacing['4'],
  color: vars.color.foreground,
  textAlign: 'center',
});

export const field = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['2'],
  marginBottom: vars.spacing['4'],
});

export const label = style({
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foregroundMuted,
});

export const input = style({
  width: '100%',
  padding: `${vars.spacing['3']} ${vars.spacing['4']}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  fontSize: vars.typography.size.md,
  fontFamily: vars.typography.fontFamily.ui,
  color: vars.color.foreground,
  backgroundColor: vars.color.background,
  ':focus': {
    outline: 'none',
    borderColor: vars.color.accent,
    boxShadow: `0 0 0 2px ${vars.color.accent}20`,
  },
  '::placeholder': {
    color: vars.color.foregroundMuted,
  },
});

export const actions = style({
  display: 'flex',
  justifyContent: 'center',
  gap: vars.spacing['2'],
  marginTop: vars.spacing['4'],
});

// Reuse button styles from CommandPalette.css.ts patterns
export const cancelButton = style({
  padding: `${vars.spacing['2']} ${vars.spacing['4']}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.background,
  color: vars.color.foreground,
  cursor: 'pointer',
  fontSize: vars.typography.size.sm,
  fontFamily: vars.typography.fontFamily.ui,
  ':hover': {
    backgroundColor: vars.color.surface,
  },
  ':focus': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },
});

export const primaryButton = style({
  padding: `${vars.spacing['2']} ${vars.spacing['4']}`,
  border: 'none',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.accent,
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: vars.typography.size.sm,
  fontFamily: vars.typography.fontFamily.ui,
  ':hover': {
    filter: 'brightness(0.9)',
  },
  ':focus': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});
