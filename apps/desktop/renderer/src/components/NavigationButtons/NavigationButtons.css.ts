import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Styles for NavigationButtons component.
 *
 * Container for back/forward navigation buttons, positioned in the
 * upper-left of the editor area below the titlebar drag region.
 */
export const container = style({
  position: 'absolute',
  top: '48px', // Below titlebar drag region
  left: '16px',
  zIndex: vars.zIndex.overlay,
  display: 'flex',
  gap: '4px',
});

/**
 * Disabled state styling for navigation buttons.
 * Applied via selectors on the button elements within the container.
 */
export const button = style({
  selectors: {
    '&:disabled': {
      opacity: 0.3,
      cursor: 'not-allowed',
    },
    '&:not(:disabled)': {
      opacity: 1,
    },
  },
});
