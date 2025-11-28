import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * NoteListItem component styles
 */

export const noteItem = style({
  position: 'relative',
  padding: vars.spacing['3'],
  borderRadius: vars.radius.lg,
  cursor: 'pointer',
  transition: `all ${vars.animation.duration.normal} ${vars.animation.easing.default}`,

  ':hover': {
    backgroundColor: vars.color.surface,
  },
});

export const noteItemActive = style({
  backgroundColor: vars.color.background,
  boxShadow: `inset 0 0 0 1px ${vars.color.accent}10, ${vars.shadow.sm}`,
});

export const noteItemInactive = style({
  color: vars.color.foregroundMuted,
});

export const noteTitle = style({
  fontWeight: vars.typography.weight.medium,
  fontSize: vars.typography.size.sm,
  marginBottom: vars.spacing['1'],
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  paddingRight: vars.spacing['6'],
  color: vars.color.foreground,
});

export const noteTitleInactive = style({
  color: vars.color.foreground,
});

export const noteTimestamp = style({
  fontSize: '10px',
  color: vars.color.foregroundMuted,
  fontWeight: vars.typography.weight.medium,
});

/**
 * Delete button - appears on hover with fade transition
 */
export const deleteButton = style({
  position: 'absolute',
  top: vars.spacing['3'],
  right: vars.spacing['3'],
  padding: vars.spacing['1'],
  borderRadius: vars.radius.md,
  border: 'none',
  backgroundColor: 'transparent',
  color: vars.color.foregroundMuted,
  cursor: 'pointer',
  opacity: 0,
  transition: `all ${vars.animation.duration.normal} ${vars.animation.easing.default}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',

  ':hover': {
    backgroundColor: `${vars.color.danger}10`,
    color: vars.color.danger,
  },

  selectors: {
    [`${noteItem}:hover &`]: {
      opacity: 1,
    },
  },
});
