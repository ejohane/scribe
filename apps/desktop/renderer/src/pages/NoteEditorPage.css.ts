/**
 * NoteEditorPage styles using vanilla-extract and design system tokens.
 */

import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
});

export const loading = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '200px',
  color: vars.color.foregroundMuted,
});

export const error = style({
  padding: vars.spacing[6],
  textAlign: 'center',
  color: vars.color.foreground,
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing[3],
  padding: `${vars.spacing[3]} ${vars.spacing[4]}`,
  borderBottom: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.background,
  // Account for macOS titlebar drag region
  paddingTop: 'env(titlebar-area-height, 40px)',
});

export const backButton = style({
  padding: `${vars.spacing[2]} ${vars.spacing[3]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.background,
  color: vars.color.foreground,
  cursor: 'pointer',
  fontSize: vars.typography.size.sm,
  flexShrink: 0,
  ':hover': {
    backgroundColor: vars.color.surface,
  },
});

export const titleInput = style({
  flex: 1,
  padding: vars.spacing[2],
  border: 'none',
  backgroundColor: 'transparent',
  color: vars.color.foreground,
  fontSize: vars.typography.size.lg,
  fontWeight: vars.typography.weight.medium,
  outline: 'none',
  '::placeholder': {
    color: vars.color.foregroundMuted,
  },
});

export const actions = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing[2],
  flexShrink: 0,
});

export const savingIndicator = style({
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
});

export const actionButton = style({
  padding: `${vars.spacing[2]} ${vars.spacing[3]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.background,
  color: vars.color.foreground,
  cursor: 'pointer',
  fontSize: vars.typography.size.sm,
  ':hover': {
    backgroundColor: vars.color.surface,
  },
});

export const deleteButton = style({
  padding: `${vars.spacing[2]} ${vars.spacing[3]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.background,
  color: vars.color.foreground,
  cursor: 'pointer',
  fontSize: vars.typography.size.sm,
  ':hover': {
    backgroundColor: vars.color.surface,
    borderColor: 'var(--color-destructive, #dc2626)',
    color: 'var(--color-destructive, #dc2626)',
  },
  ':disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
});

export const editorWrapper = style({
  flex: 1,
  overflow: 'auto',
});
