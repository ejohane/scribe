import { style, styleVariants, globalStyle } from '@vanilla-extract/css';
import { vars } from '../../tokens/contract.css';

export const base = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

// Make SVG children fill the container
globalStyle(`${base} svg`, {
  width: '100%',
  height: '100%',
});

export const sizes = styleVariants({
  xs: { width: vars.component.icon.xs, height: vars.component.icon.xs }, // 12px
  sm: { width: vars.component.icon.sm, height: vars.component.icon.sm }, // 16px
  md: { width: vars.component.icon.md, height: vars.component.icon.md }, // 20px
  lg: { width: vars.component.icon.lg, height: vars.component.icon.lg }, // 24px
});

export const colors = styleVariants({
  foreground: { color: vars.color.foreground },
  foregroundMuted: { color: vars.color.foregroundMuted },
  accent: { color: vars.color.accent },
  danger: { color: vars.color.danger },
  warning: { color: vars.color.warning },
  info: { color: vars.color.info },
});
