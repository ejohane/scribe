import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

export const container = style({
  padding: vars.spacing['4'],
});

export const header = style({
  marginBottom: vars.spacing['4'],
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
});

export const versionList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['2'],
});

export const versionCard = style({
  borderRadius: vars.radius.md,
  overflow: 'hidden',
  selectors: {
    '&[data-current="true"]': {
      borderLeft: `3px solid ${vars.color.accent}`,
    },
  },
});

export const versionHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: vars.spacing['3'],
  width: '100%',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  color: vars.color.foreground,
  ':hover': {
    background: vars.color.backgroundAlt,
  },
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '-2px',
  },
});

export const versionTitle = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
});

export const currentBadge = style({
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.accent,
  background: vars.color.backgroundAlt,
  borderRadius: vars.radius.sm,
});

export const expandIcon = style({
  transition: `transform ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  color: vars.color.foregroundMuted,
  selectors: {
    '&[data-expanded="true"]': {
      transform: 'rotate(90deg)',
    },
  },
});

export const versionContent = style({
  padding: `0 ${vars.spacing['3']} ${vars.spacing['3']}`,
});

export const section = style({
  marginBottom: vars.spacing['3'],
  selectors: {
    '&:last-child': {
      marginBottom: '0',
    },
  },
});

export const itemList = style({
  listStyle: 'none',
  padding: 0,
  margin: 0,
  marginTop: vars.spacing['2'],
});

export const item = style({
  position: 'relative',
  paddingLeft: vars.spacing['4'],
  marginBottom: vars.spacing['1'],
  selectors: {
    '&::before': {
      content: '"•"',
      position: 'absolute',
      left: vars.spacing['1'],
      color: vars.color.foregroundMuted,
    },
  },
});
