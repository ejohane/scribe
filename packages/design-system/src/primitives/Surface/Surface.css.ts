import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../tokens/contract.css';

export const base = style({
  boxSizing: 'border-box',
});

export const variants = styleVariants({
  surface: { backgroundColor: vars.color.surface },
  background: { backgroundColor: vars.color.background },
  backgroundAlt: { backgroundColor: vars.color.backgroundAlt },
});

export const elevations = styleVariants({
  none: { boxShadow: 'none' },
  sm: { boxShadow: vars.shadow.sm },
  md: { boxShadow: vars.shadow.md },
  lg: { boxShadow: vars.shadow.lg },
});

export const radii = styleVariants({
  none: { borderRadius: vars.radius.none },
  sm: { borderRadius: vars.radius.sm },
  md: { borderRadius: vars.radius.md },
  lg: { borderRadius: vars.radius.lg },
  full: { borderRadius: vars.radius.full },
});

export const bordered = style({
  border: `1px solid ${vars.color.border}`,
});
