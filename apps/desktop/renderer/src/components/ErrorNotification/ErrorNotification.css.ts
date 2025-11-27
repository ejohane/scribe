import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

const slideIn = keyframes({
  from: {
    transform: 'translateX(100%)',
    opacity: 0,
  },
  to: {
    transform: 'translateX(0)',
    opacity: 1,
  },
});

export const container = style({
  position: 'fixed',
  top: vars.spacing['6'],
  right: vars.spacing['6'],
  zIndex: vars.zIndex.tooltip,
  animation: `${slideIn} 0.3s ease-out`,
});

export const content = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
  maxWidth: '400px',
});

export const icon = style({
  flexShrink: 0,
});

export const message = style({
  flex: 1,
});

export const closeButton = style({
  flexShrink: 0,
});
