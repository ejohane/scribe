import { style, globalStyle } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * NoteHeader styles
 *
 * Designed to blend seamlessly with the editor content below,
 * appearing as part of a single document while being independently editable.
 */

export const noteHeader = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['2'],
  maxWidth: '800px',
  margin: '0 auto',
  padding: `${vars.spacing['12']} ${vars.spacing['8']} 0`,
  backgroundColor: vars.color.background,
});

export const titleInput = style({
  width: '100%',
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  color: vars.color.foreground,
  fontSize: '2.5rem',
  fontWeight: vars.typography.weight.bold,
  fontFamily: vars.typography.fontFamily.ui,
  lineHeight: vars.typography.lineHeight.tight,
  padding: 0,
  margin: 0,
  '::placeholder': {
    color: vars.color.foregroundMuted,
  },
});

export const metadataRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['4'],
  flexWrap: 'wrap',
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
});

export const metadataItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
});

export const metadataLabel = style({
  color: vars.color.foregroundMuted,
});

export const metadataValue = style({
  color: vars.color.foreground,
});

export const divider = style({
  width: '1px',
  height: '14px',
  backgroundColor: vars.color.border,
});

// Note type selector
export const typeSelector = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  borderRadius: vars.radius.sm,
  border: `1px solid transparent`,
  backgroundColor: 'transparent',
  color: vars.color.foreground,
  fontSize: vars.typography.size.sm,
  fontFamily: vars.typography.fontFamily.ui,
  cursor: 'pointer',
  transition: `background-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  ':hover': {
    backgroundColor: vars.color.surface,
    border: `1px solid ${vars.color.border}`,
  },
  ':focus': {
    outline: 'none',
    border: `1px solid ${vars.color.accent}`,
  },
});

export const typeIcon = style({
  fontSize: vars.typography.size.sm,
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
});

// Type dropdown menu
export const typeMenu = style({
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: vars.spacing['1'],
  backgroundColor: vars.color.background,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.md,
  zIndex: vars.zIndex.popover,
  minWidth: '160px',
  overflow: 'hidden',
});

export const typeMenuWrapper = style({
  position: 'relative',
});

export const typeMenuItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
  cursor: 'pointer',
  fontSize: vars.typography.size.sm,
  color: vars.color.foreground,
  transition: `background-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  ':hover': {
    backgroundColor: vars.color.surface,
  },
});

export const typeMenuItemActive = style({
  backgroundColor: vars.color.surface,
});

globalStyle(`${typeMenuItem}:first-child`, {
  borderTopLeftRadius: vars.radius.md,
  borderTopRightRadius: vars.radius.md,
});

globalStyle(`${typeMenuItem}:last-child`, {
  borderBottomLeftRadius: vars.radius.md,
  borderBottomRightRadius: vars.radius.md,
});
