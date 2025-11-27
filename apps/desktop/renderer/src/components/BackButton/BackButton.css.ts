import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Positioning styles for the BackButton component.
 * The button itself uses the Button primitive from the design system.
 */
export const container = style({
  position: 'absolute',
  top: vars.spacing['4'],
  left: vars.spacing['4'],
  zIndex: vars.zIndex.overlay,
});
