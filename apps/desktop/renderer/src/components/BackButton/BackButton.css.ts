import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Positioning styles for the BackButton component.
 * The button itself uses the Button primitive from the design system.
 *
 * Positioned to align with the left edge of the editor content:
 * - Editor has maxWidth: 800px, centered with margin: 0 auto
 * - Editor content has padding-left: 2rem (32px)
 * - Back button sits just to the left of where text content starts
 */
export const container = style({
  position: 'absolute',
  // Vertically center with H1 heading
  top: '28px',
  // Position relative to centered 800px editor:
  // max() ensures we don't go off-screen on narrow viewports
  // - When viewport >= 800px: calc(50% - 400px - 8px) = 8px left of editor container
  // - When viewport < 800px: 8px from left edge
  left: 'max(8px, calc(50% - 400px - 8px))',
  zIndex: vars.zIndex.overlay,
});
