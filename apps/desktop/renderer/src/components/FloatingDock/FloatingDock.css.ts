/**
 * FloatingDock Styles
 *
 * Vanilla-extract styles for the floating dock component.
 * The dock is a bottom-centered toolbar with glassmorphism effect.
 */

import { style, globalStyle } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Main dock container
 * Fixed position at bottom center with glassmorphism effect
 */
export const dock = style({
  position: 'fixed',
  bottom: vars.spacing['6'],
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
  padding: vars.spacing['2'],
  borderRadius: vars.radius.full,
  border: `1px solid ${vars.color.border}`,
  boxShadow: vars.shadow.lg,
  zIndex: vars.zIndex.overlay,
  transition: `all ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  // Glassmorphism effect - light mode
  background: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',

  ':hover': {
    transform: 'translateX(-50%) scale(1.02)',
    boxShadow: vars.shadow.xl,
  },
});

/**
 * Dark mode glassmorphism background
 * Applied via data-theme attribute on a parent element
 */
globalStyle('[data-theme="dark"] ' + dock, {
  background: 'rgba(24, 24, 27, 0.9)',
});

/**
 * Dock button - individual action button in the dock
 */
export const dockButton = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: vars.spacing['2'],
  borderRadius: vars.radius.md,
  border: 'none',
  background: 'transparent',
  color: vars.color.foregroundMuted,
  cursor: 'pointer',
  transition: `all ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  ':hover': {
    backgroundColor: vars.color.surface,
    color: vars.color.foreground,
  },

  ':focus': {
    outline: 'none',
  },

  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },
});

/**
 * Active state for dock button (e.g., when sidebar is open)
 */
export const dockButtonActive = style({
  color: vars.color.accent,
});

/**
 * Icon wrapper for consistent sizing
 */
export const icon = style({
  width: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

/**
 * Vertical divider between button sections
 */
export const divider = style({
  width: '1px',
  height: '24px',
  backgroundColor: vars.color.border,
  margin: `0 ${vars.spacing['1']}`,
  flexShrink: 0,
});

/**
 * Search button container - holds both icon and keyboard shortcut badge
 */
export const searchButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
});

/**
 * Keyboard shortcut badge (e.g., "Cmd+K")
 */
export const keyboardShortcut = style({
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  backgroundColor: vars.color.surface,
  borderRadius: vars.radius.sm,
  fontSize: vars.typography.size.xs,
  fontFamily: vars.typography.fontFamily.ui,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foregroundMuted,
  lineHeight: 1,
});
