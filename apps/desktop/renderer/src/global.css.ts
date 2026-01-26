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

// Remove focus outline from editor (contenteditable) - not needed for text editing
globalStyle('.scribe-editor-input:focus-visible', {
  outline: 'none',
});

// Note editor page layout - centered content
globalStyle('[data-testid="note-editor-page"]', {
  minHeight: '100vh',
  width: '100%',
  backgroundColor: vars.color.background,
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
});

globalStyle('.note-editor-menu-button', {
  opacity: 0.15,
  transition: 'opacity 0.2s ease',
});

globalStyle(
  "[data-testid='note-editor-page']:hover:not([data-typing='true']) .note-editor-menu-button, .note-editor-menu-button:focus-within",
  {
    opacity: 1,
  }
);

// Note editor content - centered with max width, responsive padding
globalStyle('[data-testid="note-editor-content"]', {
  width: '100%',
  maxWidth: '750px',
  paddingLeft: '1rem',
  paddingRight: '1rem',
  paddingTop: '100px',
  paddingBottom: '200px',
  '@media': {
    '(min-width: 640px)': {
      paddingLeft: '1.5rem',
      paddingRight: '1.5rem',
    },
  },
});

// Push-style sidebar layout for editor
globalStyle('.editor-layout', {
  display: 'flex',
  height: '100vh',
  width: '100vw',
  overflow: 'hidden',
  backgroundColor: 'oklch(0.08 0 0)',
});

globalStyle('.editor-sidebar', {
  width: 0,
  minWidth: 0,
  overflow: 'hidden',
  transition: 'width 0.3s ease, min-width 0.3s ease',
  backgroundColor: 'oklch(0.22 0 0)',
  flexShrink: 0,
});

globalStyle(".editor-layout[data-sidebar-open='true'] .editor-sidebar", {
  width: '280px',
  minWidth: '280px',
});

globalStyle('.editor-canvas', {
  flex: 1,
  minWidth: 0,
  position: 'relative',
  zIndex: 10,
  backgroundColor: vars.color.background,
  overflow: 'auto',
});

globalStyle('.sidebar-toggle-button', {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '32px',
  width: '32px',
  borderRadius: vars.radius.md,
  border: `1px solid color-mix(in srgb, ${vars.color.border} 30%, transparent)`,
  backgroundColor: `color-mix(in srgb, ${vars.color.background} 90%, transparent)`,
  color: `color-mix(in srgb, ${vars.color.foreground} 60%, transparent)`,
  boxShadow: `0 1px 2px color-mix(in srgb, ${vars.color.background} 60%, transparent)`,
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  cursor: 'pointer',
  transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
});

globalStyle('.sidebar-toggle-button:hover', {
  color: vars.color.foreground,
  backgroundColor: vars.color.background,
  borderColor: `color-mix(in srgb, ${vars.color.border} 60%, transparent)`,
});
