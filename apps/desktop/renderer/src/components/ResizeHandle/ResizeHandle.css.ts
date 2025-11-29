import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * ResizeHandle component styles
 * A draggable handle for resizing panels
 */

export const resizeHandle = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '8px',
  cursor: 'col-resize',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: `background-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  ':hover': {
    backgroundColor: `color-mix(in srgb, ${vars.color.accent} 20%, transparent)`,
  },
});

export const resizeHandleLeft = style({
  right: '-4px',
});

export const resizeHandleRight = style({
  left: '-4px',
});

export const resizeHandleActive = style({
  backgroundColor: `color-mix(in srgb, ${vars.color.accent} 30%, transparent)`,
});

export const resizeHandleLine = style({
  width: '2px',
  height: '32px',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.border,
  opacity: 0,
  transition: `opacity ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  selectors: {
    [`${resizeHandle}:hover &`]: {
      opacity: 1,
    },
    [`${resizeHandleActive} &`]: {
      opacity: 1,
      backgroundColor: vars.color.accent,
    },
  },
});
