import { style, styleVariants, keyframes } from '@vanilla-extract/css';
import { vars } from '../../tokens/contract.css';

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

export const overlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: vars.zIndex.overlay,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: `${fadeIn} 150ms ease-out`,
});

export const backdrop = styleVariants({
  none: {},
  transparent: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  blur: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
});

export const content = style({
  position: 'relative',
  zIndex: 1,
});
