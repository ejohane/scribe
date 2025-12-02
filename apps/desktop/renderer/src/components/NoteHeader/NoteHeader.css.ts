import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * NoteHeader styles
 *
 * Designed to blend seamlessly with the editor content below,
 * appearing as part of a single document while being independently editable.
 */

export const noteHeader = style({
  // Match editorContainer layout exactly
  position: 'relative',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  maxWidth: '800px',
  margin: '0 auto',
  // NoteHeader-specific padding (matches editorInput horizontal padding)
  paddingTop: vars.spacing['12'],
  paddingLeft: vars.spacing['8'],
  paddingRight: vars.spacing['8'],
  paddingBottom: 0,
  gap: vars.spacing['2'],
  backgroundColor: vars.color.background,
});

export const titleInput = style({
  display: 'block',
  width: '100%',
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  color: vars.color.foreground,
  fontSize: vars.typography.size['3xl'],
  fontWeight: vars.typography.weight.bold,
  fontFamily: vars.typography.fontFamily.ui,
  lineHeight: vars.typography.lineHeight.tight,
  padding: 0,
  margin: 0,
  textAlign: 'left',
  '::placeholder': {
    color: vars.color.foregroundMuted,
  },
  ':focus': {
    outline: 'none',
  },
  ':focus-visible': {
    outline: 'none',
  },
});

export const metadataRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: vars.spacing['4'],
  flexWrap: 'wrap',
  width: '100%',
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
});

export const metadataItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
});

export const metadataValue = style({
  color: vars.color.foreground,
});

export const divider = style({
  width: '1px',
  height: '14px',
  backgroundColor: vars.color.border,
});

// Tags section
export const tagsContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  flexWrap: 'wrap',
});

export const tag = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
  padding: `${vars.spacing['0']} ${vars.spacing['2']}`,
  backgroundColor: vars.color.surface,
  color: vars.color.foreground,
  fontSize: vars.typography.size.xs,
  borderRadius: vars.radius.full,
  border: `1px solid ${vars.color.border}`,
  cursor: 'default',
  transition: `all ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
});

export const tagRemoveButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '14px',
  height: '14px',
  padding: 0,
  border: 'none',
  backgroundColor: 'transparent',
  color: vars.color.foregroundMuted,
  cursor: 'pointer',
  borderRadius: vars.radius.full,
  fontSize: '10px',
  lineHeight: 1,
  ':hover': {
    backgroundColor: vars.color.border,
    color: vars.color.foreground,
  },
});

export const addTagButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: `${vars.spacing['0']} ${vars.spacing['2']}`,
  backgroundColor: 'transparent',
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.xs,
  border: `1px dashed ${vars.color.border}`,
  borderRadius: vars.radius.full,
  cursor: 'pointer',
  transition: `all ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  ':hover': {
    backgroundColor: vars.color.surface,
    color: vars.color.foreground,
    borderStyle: 'solid',
  },
});

export const tagInput = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: `${vars.spacing['0']} ${vars.spacing['2']}`,
  backgroundColor: vars.color.surface,
  color: vars.color.foreground,
  fontSize: vars.typography.size.xs,
  border: `1px solid ${vars.color.accent}`,
  borderRadius: vars.radius.full,
  outline: 'none',
  minWidth: '60px',
  fontFamily: vars.typography.fontFamily.ui,
  ':focus': {
    outline: 'none',
  },
  ':focus-visible': {
    outline: 'none',
  },
});
