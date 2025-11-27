import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../tokens/contract.css';

export const base = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.spacing['2'],
  border: 'none',
  cursor: 'pointer',
  fontFamily: vars.typography.fontFamily.ui,
  fontWeight: vars.typography.weight.medium,
  borderRadius: vars.radius.md,
  transition: 'background-color 0.15s, color 0.15s, box-shadow 0.15s',
  ':focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 2px ${vars.color.background}, 0 0 0 4px ${vars.color.accent}`,
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});

export const sizes = styleVariants({
  sm: {
    fontSize: vars.typography.size.sm,
    padding: `${vars.spacing['1']} ${vars.spacing['3']}`,
    height: '1.75rem',
  },
  md: {
    fontSize: vars.typography.size.md,
    padding: `${vars.spacing['2']} ${vars.spacing['4']}`,
    height: '2.25rem',
  },
});

// Solid variants
export const solidAccent = style({
  backgroundColor: vars.color.accent,
  color: vars.color.accentForeground,
  selectors: {
    '&:hover:not(:disabled)': {
      filter: 'brightness(0.95)',
    },
  },
});

export const solidNeutral = style({
  backgroundColor: vars.color.surface,
  color: vars.color.foreground,
  selectors: {
    '&:hover:not(:disabled)': {
      backgroundColor: vars.color.border,
    },
  },
});

export const solidDanger = style({
  backgroundColor: vars.color.danger,
  color: '#ffffff',
  selectors: {
    '&:hover:not(:disabled)': {
      filter: 'brightness(0.95)',
    },
  },
});

// Ghost variants
export const ghostAccent = style({
  backgroundColor: 'transparent',
  color: vars.color.accent,
  selectors: {
    '&:hover:not(:disabled)': {
      backgroundColor: vars.color.backgroundAlt,
    },
  },
});

export const ghostNeutral = style({
  backgroundColor: 'transparent',
  color: vars.color.foreground,
  selectors: {
    '&:hover:not(:disabled)': {
      backgroundColor: vars.color.backgroundAlt,
    },
  },
});

export const ghostDanger = style({
  backgroundColor: 'transparent',
  color: vars.color.danger,
  selectors: {
    '&:hover:not(:disabled)': {
      backgroundColor: vars.color.backgroundAlt,
    },
  },
});

// Subtle variants
export const subtleAccent = style({
  backgroundColor: vars.color.backgroundAlt,
  color: vars.color.accent,
  selectors: {
    '&:hover:not(:disabled)': {
      backgroundColor: vars.color.surface,
    },
  },
});

export const subtleNeutral = style({
  backgroundColor: vars.color.backgroundAlt,
  color: vars.color.foreground,
  selectors: {
    '&:hover:not(:disabled)': {
      backgroundColor: vars.color.surface,
    },
  },
});

export const subtleDanger = style({
  backgroundColor: vars.color.backgroundAlt,
  color: vars.color.danger,
  selectors: {
    '&:hover:not(:disabled)': {
      backgroundColor: vars.color.surface,
    },
  },
});
