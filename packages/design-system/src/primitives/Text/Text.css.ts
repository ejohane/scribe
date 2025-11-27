import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../tokens/contract.css';

export const base = style({
  margin: 0,
  fontFamily: vars.typography.fontFamily.ui,
});

export const mono = style({
  fontFamily: vars.typography.fontFamily.mono,
});

export const sizes = styleVariants({
  xs: { fontSize: vars.typography.size.xs, lineHeight: vars.typography.lineHeight.normal },
  sm: { fontSize: vars.typography.size.sm, lineHeight: vars.typography.lineHeight.normal },
  md: { fontSize: vars.typography.size.md, lineHeight: vars.typography.lineHeight.normal },
  lg: { fontSize: vars.typography.size.lg, lineHeight: vars.typography.lineHeight.normal },
  xl: { fontSize: vars.typography.size.xl, lineHeight: vars.typography.lineHeight.tight },
});

export const weights = styleVariants({
  regular: { fontWeight: vars.typography.weight.regular },
  medium: { fontWeight: vars.typography.weight.medium },
  bold: { fontWeight: vars.typography.weight.bold },
});

export const colors = styleVariants({
  foreground: { color: vars.color.foreground },
  foregroundMuted: { color: vars.color.foregroundMuted },
  accent: { color: vars.color.accent },
  danger: { color: vars.color.danger },
  warning: { color: vars.color.warning },
  info: { color: vars.color.info },
});

export const truncate = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
