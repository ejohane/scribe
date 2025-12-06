import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

export const container = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
});

export const versionButton = style({
  background: 'none',
  border: 'none',
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  cursor: 'default',
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
  borderRadius: vars.radius.sm,
  transition: `background-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  selectors: {
    '&:not(:disabled)': {
      cursor: 'pointer',
    },
    '&:not(:disabled):hover': {
      backgroundColor: vars.color.surface,
    },
  },
});

export const versionText = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
  fontFamily: 'inherit',
});

const pulse = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.5 },
});

export const updateBadge = style({
  width: '6px',
  height: '6px',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.accent,
  animation: `${pulse} 2s ease-in-out infinite`,
});
