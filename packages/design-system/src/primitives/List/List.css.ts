import { style } from '@vanilla-extract/css';
import { vars } from '../../tokens/contract.css';

export const list = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
});

export const listItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
  padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
  cursor: 'pointer',
  color: vars.color.foreground,
  transition: 'background-color 0.1s',
  borderRadius: vars.radius.sm,
  selectors: {
    '&:hover:not([aria-disabled="true"])': {
      backgroundColor: vars.color.backgroundAlt,
    },
  },
});

export const listItemActive = style({
  backgroundColor: vars.color.backgroundAlt,
});

export const listItemSelected = style({
  backgroundColor: vars.color.surface,
  borderLeft: `3px solid ${vars.color.accent}`,
  paddingLeft: `calc(${vars.spacing['3']} - 3px)`,
});

export const listItemDisabled = style({
  opacity: 0.5,
  cursor: 'not-allowed',
});

export const iconWrapper = style({
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  color: vars.color.foregroundMuted,
});

export const content = style({
  flex: 1,
  minWidth: 0,
});

export const iconRight = style({
  marginLeft: 'auto',
});
