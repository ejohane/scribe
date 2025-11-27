import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../tokens/contract.css';

export const wrapper = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  backgroundColor: vars.color.background,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  transition: 'border-color 0.15s, box-shadow 0.15s',
  ':focus-within': {
    borderColor: vars.color.accent,
    boxShadow: `0 0 0 2px ${vars.color.background}, 0 0 0 4px ${vars.color.accent}`,
  },
});

export const wrapperError = style({
  borderColor: vars.color.danger,
  ':focus-within': {
    borderColor: vars.color.danger,
    boxShadow: `0 0 0 2px ${vars.color.background}, 0 0 0 4px ${vars.color.danger}`,
  },
});

export const sizes = styleVariants({
  sm: {
    padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
    minHeight: '1.75rem',
  },
  md: {
    padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
    minHeight: '2.25rem',
  },
});

export const input = style({
  flex: 1,
  border: 'none',
  background: 'transparent',
  color: vars.color.foreground,
  fontFamily: vars.typography.fontFamily.ui,
  fontSize: vars.typography.size.md,
  outline: 'none',
  '::placeholder': {
    color: vars.color.foregroundMuted,
  },
});

export const inputSm = style({
  fontSize: vars.typography.size.sm,
});

export const iconWrapper = style({
  display: 'flex',
  alignItems: 'center',
  color: vars.color.foregroundMuted,
  flexShrink: 0,
});
