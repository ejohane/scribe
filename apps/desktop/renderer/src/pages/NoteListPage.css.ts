/**
 * NoteListPage styles using vanilla-extract and design system tokens.
 */

import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

export const container = style({
  padding: vars.spacing[6],
  maxWidth: '800px',
  margin: '0 auto',
});

export const loading = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '200px',
  color: vars.color.foregroundMuted,
});

export const error = style({
  padding: vars.spacing[4],
  backgroundColor: vars.color.surface,
  borderRadius: vars.radius.md,
  color: vars.color.foreground,
  textAlign: 'center',
});

export const retryButton = style({
  marginTop: vars.spacing[3],
  padding: `${vars.spacing[2]} ${vars.spacing[4]}`,
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

export const header = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: vars.spacing[6],
});

export const title = style({
  margin: 0,
  fontSize: vars.typography.size['2xl'],
  fontWeight: vars.typography.weight.bold,
  color: vars.color.foreground,
});

export const newButton = style({
  padding: `${vars.spacing[2]} ${vars.spacing[4]}`,
  backgroundColor: vars.color.accent,
  color: vars.color.accentForeground,
  border: 'none',
  borderRadius: vars.radius.md,
  cursor: 'pointer',
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  ':hover': {
    opacity: 0.9,
  },
  ':disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
});

export const emptyState = style({
  color: vars.color.foregroundMuted,
  textAlign: 'center',
  padding: vars.spacing[8],
});

export const noteList = style({
  listStyle: 'none',
  padding: 0,
  margin: 0,
});

export const noteItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing[2],
  padding: vars.spacing[3],
  borderBottom: `1px solid ${vars.color.border}`,
  ':hover': {
    backgroundColor: vars.color.surface,
  },
});

export const noteButton = style({
  flex: 1,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: vars.spacing[2],
  border: 'none',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  borderRadius: vars.radius.sm,
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});

export const noteTitle = style({
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
  fontSize: vars.typography.size.md,
});

export const noteDate = style({
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
});

export const noteActions = style({
  display: 'flex',
  gap: vars.spacing[1],
});

export const actionButton = style({
  padding: vars.spacing[2],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.background,
  color: vars.color.foregroundMuted,
  cursor: 'pointer',
  fontSize: vars.typography.size.md,
  lineHeight: 1,
  ':hover': {
    backgroundColor: vars.color.surface,
    color: vars.color.foreground,
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});
