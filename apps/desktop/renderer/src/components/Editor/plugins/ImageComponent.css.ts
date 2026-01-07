/**
 * ImageComponent Styles
 *
 * Vanilla-extract styles for the image component in the editor.
 * Uses design system tokens for consistent theming.
 */

import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

export const imageContainer = style({
  display: 'block',
  margin: `${vars.spacing['4']} 0`,
  maxWidth: '100%',
});

export const image = style({
  display: 'block',
  maxWidth: '100%',
  height: 'auto',
  borderRadius: vars.radius.md,
});

export const imagePlaceholder = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '120px',
  backgroundColor: vars.color.surface,
  border: `2px dashed ${vars.color.border}`,
  borderRadius: vars.radius.md,
  padding: vars.spacing['4'],
});

export const loadingText = style({
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
});

export const imageError = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '120px',
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.danger}`,
  borderRadius: vars.radius.md,
  padding: vars.spacing['4'],
  gap: vars.spacing['2'],
});

export const errorIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.danger,
  color: '#fff',
  fontSize: vars.typography.size.md,
  fontWeight: vars.typography.weight.bold,
});

export const errorText = style({
  color: vars.color.danger,
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
});

export const errorDetail = style({
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.xs,
  fontFamily: vars.typography.fontFamily.mono,
  wordBreak: 'break-all',
  maxWidth: '200px',
  textAlign: 'center',
});

export const resizeHandle = style({
  position: 'absolute',
  bottom: -6,
  right: -6,
  width: 12,
  height: 12,
  backgroundColor: vars.color.accent,
  borderRadius: vars.radius.full,
  cursor: 'nwse-resize',
  opacity: 0,
  transition: 'opacity 0.2s',
  selectors: {
    [`${imageContainer}:hover &`]: {
      opacity: 1,
    },
  },
});

export const clickableImage = style({
  cursor: 'zoom-in',
});

export const lightboxOverlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: vars.zIndex.modal,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
  cursor: 'zoom-out',
});

export const lightboxImage = style({
  maxWidth: '90vw',
  maxHeight: '90vh',
  objectFit: 'contain',
  borderRadius: vars.radius.md,
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
});

export const lightboxCloseHint = style({
  position: 'absolute',
  top: vars.spacing['4'],
  right: vars.spacing['4'],
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: vars.typography.size.sm,
  pointerEvents: 'none',
});

/**
 * Context menu styles for image right-click actions
 */
export const contextMenu = style({
  position: 'fixed',
  minWidth: '160px',
  padding: `${vars.spacing['1']} 0`,
  background: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.md,
  zIndex: vars.zIndex.popover,
});

export const contextMenuItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  width: '100%',
  padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
  border: 'none',
  background: 'transparent',
  color: vars.color.foreground,
  fontSize: vars.typography.size.sm,
  textAlign: 'left',
  cursor: 'pointer',
  transition: `background ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  ':hover': {
    background: vars.color.backgroundAlt,
  },

  ':focus': {
    outline: 'none',
    background: vars.color.backgroundAlt,
  },

  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '-2px',
    background: vars.color.backgroundAlt,
  },

  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
});

export const contextMenuIcon = style({
  flexShrink: 0,
  width: '16px',
  height: '16px',
  color: vars.color.foregroundMuted,
});
