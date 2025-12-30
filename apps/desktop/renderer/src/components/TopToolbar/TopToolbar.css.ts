/**
 * TopToolbar Styles
 *
 * Vanilla-extract styles for the top toolbar component.
 * Browser-style toolbar with flat design (no shadows or 3D effects).
 */

import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Main toolbar container
 * Positioned at top, spanning full width with items at edges
 */
export const toolbar = style({
  position: 'absolute',
  top: '48px', // Below titlebar drag region
  left: 0,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `0 ${vars.spacing['4']}`,
  zIndex: vars.zIndex.overlay,
  height: '40px',
  overflow: 'visible', // Allow dropdown to extend beyond toolbar
});

/**
 * Left section - hamburger, search, divider, back/forward
 */
export const leftSection = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
});

/**
 * Right section - share menu and context panel toggle
 */
export const rightSection = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
});

/**
 * Container for share menu - hidden at narrow widths
 * At narrow viewports, only show the panel toggle button to avoid crowding
 */
export const shareMenuContainer = style({
  display: 'flex',
  alignItems: 'center',

  '@media': {
    '(max-width: 640px)': {
      display: 'none',
    },
  },
});

/**
 * Container for sync status indicator in toolbar
 * Positioned before share menu, hidden at very narrow viewports
 */
export const syncStatusContainer = style({
  display: 'flex',
  alignItems: 'center',
  marginRight: vars.spacing['1'],

  '@media': {
    '(max-width: 480px)': {
      display: 'none',
    },
  },
});

/**
 * Toolbar button - flat design, no shadows, no animations
 */
export const toolbarButton = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: 0,
  borderRadius: vars.radius.md,
  border: 'none',
  background: 'transparent',
  color: vars.color.foregroundMuted,
  cursor: 'pointer',

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
});

/**
 * Active state for toolbar button (e.g., when panel is open)
 */
export const toolbarButtonActive = style({
  color: vars.color.accent,
});

/**
 * Icon wrapper for consistent sizing
 */
export const icon = style({
  width: '18px',
  height: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

/**
 * Vertical divider between button groups
 */
export const divider = style({
  width: '1px',
  height: '20px',
  backgroundColor: vars.color.border,
  margin: `0 ${vars.spacing['2']}`,
  flexShrink: 0,
});

/**
 * Button group container for use in panel headers
 */
export const buttonGroup = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
});

/**
 * Base styles for fade animation on sections
 */
const sectionFadeBase = style({
  transition: `opacity ${vars.animation.duration.normal} ${vars.animation.easing.smooth}`,
});

/**
 * Visibility variants for left/right sections when panels are closed
 * Controls fade in/out based on mouse activity
 */
export const sectionVisibility = styleVariants({
  visible: [sectionFadeBase, { opacity: 1, pointerEvents: 'auto' }],
  hidden: [sectionFadeBase, { opacity: 0, pointerEvents: 'none' }],
});
