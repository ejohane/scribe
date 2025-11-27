import { globalStyle } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Global styles for Scribe desktop app.
 * Uses design system tokens for consistency.
 *
 * @see features/design-system/spec.md
 */

// Box-sizing reset for all elements
globalStyle('*, *::before, *::after', {
  boxSizing: 'border-box',
  margin: 0,
  padding: 0,
});

// Full height/width for root elements
globalStyle('html, body, #root', {
  height: '100%',
  width: '100%',
  overflow: 'hidden',
});

// Body default styles
globalStyle('body', {
  fontFamily: vars.typography.fontFamily.ui,
  fontSize: vars.typography.size.md,
  lineHeight: vars.typography.lineHeight.normal,
  color: vars.color.foreground,
  backgroundColor: vars.color.background,
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
});

// Code elements use monospace font
globalStyle('code', {
  fontFamily: vars.typography.fontFamily.mono,
});

// Selection highlight using accent color
globalStyle('::selection', {
  backgroundColor: vars.color.accent,
  color: vars.color.accentForeground,
});

// Focus visible styles for accessibility
globalStyle(':focus-visible', {
  outline: `2px solid ${vars.color.accent}`,
  outlineOffset: '2px',
});
