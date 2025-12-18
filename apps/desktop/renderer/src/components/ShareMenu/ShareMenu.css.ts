/**
 * ShareMenu Styles
 *
 * Vanilla-extract styles for the share menu dropdown component.
 * Uses design system tokens for consistent styling.
 *
 * Accessibility Features:
 * - Visible focus indicators (2px solid outline with offset)
 * - Reduced motion support (@media prefers-reduced-motion)
 * - Sufficient color contrast for text and icons
 * - Focus/hover states for keyboard and mouse navigation
 */

import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Main container - relative positioning for dropdown
 * Fixed dimensions to prevent layout shift when dropdown opens
 */
export const container = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
});

/**
 * Share button - matches toolbar button size (32x32px)
 * Accessible focus indicator with 2px outline and offset
 */
export const shareButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: 0,
  border: 'none',
  borderRadius: vars.radius.md,
  background: 'transparent',
  color: vars.color.foregroundMuted,
  cursor: 'pointer',
  transition: `background ${vars.animation.duration.fast} ${vars.animation.easing.default}, color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  ':hover': {
    backgroundColor: vars.color.surface,
    color: vars.color.foreground,
  },

  ':focus': {
    outline: 'none',
  },

  // Visible focus indicator for keyboard navigation (WCAG 2.1 AA)
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },

  ':disabled': {
    opacity: 0.3,
    cursor: 'not-allowed',
  },

  selectors: {
    '&:disabled:hover': {
      backgroundColor: 'transparent',
      color: vars.color.foregroundMuted,
    },
  },

  // Respect user's reduced motion preference
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
});

/**
 * Dropdown menu container
 * Positioned below the button, shifted left to avoid being cut off at viewport edge
 */
export const dropdown = style({
  position: 'absolute',
  top: '100%',
  right: 0,
  marginTop: '4px',
  minWidth: '180px',
  padding: `${vars.spacing['1']} 0`,
  background: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.md,
  zIndex: vars.zIndex.popover,

  // Respect user's reduced motion preference
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
      transition: 'none',
    },
  },
});

/**
 * Menu item - interactive row in the dropdown
 * Supports both mouse hover and keyboard focus states
 */
export const menuItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
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

  // Focus state for keyboard navigation (roving tabindex)
  ':focus': {
    outline: 'none',
    background: vars.color.backgroundAlt,
  },

  // Visible focus indicator for keyboard navigation (WCAG 2.1 AA)
  // Using inset outline to stay within menu bounds
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '-2px',
    background: vars.color.backgroundAlt,
  },

  // Respect user's reduced motion preference
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
});

/**
 * Icon within menu item
 * Uses muted color for visual hierarchy
 */
export const menuItemIcon = style({
  flexShrink: 0,
  color: vars.color.foregroundMuted,
});
