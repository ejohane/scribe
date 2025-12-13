import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../tokens/contract.css';
import { fadeIn } from '../../tokens';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: vars.zIndex.overlay,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: `${fadeIn} ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
});

export const backdrop = styleVariants({
  none: {},
  transparent: {
    backgroundColor: vars.color.backdropDark,
  },
  blur: {
    backgroundColor: vars.color.backdropLight,
    backdropFilter: `blur(${vars.blur.sm})`,
    WebkitBackdropFilter: `blur(${vars.blur.sm})`,
  },
});

export const content = style({
  position: 'relative',
  zIndex: 1,
});
