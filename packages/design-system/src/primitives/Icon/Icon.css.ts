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
  xs: { width: '0.75rem', height: '0.75rem' }, // 12px
  sm: { width: '1rem', height: '1rem' }, // 16px
  md: { width: '1.25rem', height: '1.25rem' }, // 20px
  lg: { width: '1.5rem', height: '1.5rem' }, // 24px
});

export const colors = styleVariants({
  foreground: { color: vars.color.foreground },
  foregroundMuted: { color: vars.color.foregroundMuted },
  accent: { color: vars.color.accent },
  danger: { color: vars.color.danger },
  warning: { color: vars.color.warning },
  info: { color: vars.color.info },
});
