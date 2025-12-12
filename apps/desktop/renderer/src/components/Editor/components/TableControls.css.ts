/**
 * TableControls styles
 *
 * Styles for table add/remove row/column buttons.
 */

import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

// Fade in animation for controls
const fadeIn = keyframes({
  '0%': { opacity: 0 },
  '100%': { opacity: 1 },
});

// Base button style shared by all control buttons
const baseButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  cursor: 'pointer',
  fontFamily: vars.typography.fontFamily.ui,
  fontWeight: vars.typography.weight.medium,
  transition: `all ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  animation: `${fadeIn} ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
});

// Add button (+) - shown on table hover
export const addButton = style([
  baseButton,
  {
    width: '24px',
    height: '24px',
    borderRadius: vars.radius.sm,
    backgroundColor: vars.color.surface,
    color: vars.color.foregroundMuted,
    fontSize: vars.typography.size.lg,
    boxShadow: vars.shadow.sm,
    border: `1px solid ${vars.color.border}`,
    ':hover': {
      backgroundColor: vars.color.accent,
      color: vars.color.accentForeground,
      transform: 'scale(1.1)',
    },
    ':active': {
      transform: 'scale(0.95)',
    },
  },
]);

// Remove button (x) - shown on row/column hover
export const removeButton = style([
  baseButton,
  {
    width: '18px',
    height: '18px',
    borderRadius: vars.radius.full,
    backgroundColor: vars.color.surface,
    color: vars.color.foregroundMuted,
    fontSize: vars.typography.size.xs,
    boxShadow: vars.shadow.sm,
    border: `1px solid ${vars.color.border}`,
    ':hover': {
      backgroundColor: vars.color.danger,
      color: vars.color.dangerForeground,
      transform: 'scale(1.1)',
    },
    ':active': {
      transform: 'scale(0.95)',
    },
  },
]);

// Container for add column button (right edge of table)
export const addColumnContainer = style({
  zIndex: 10,
  pointerEvents: 'auto',
});

// Container for add row button (below table)
export const addRowContainer = style({
  zIndex: 10,
  pointerEvents: 'auto',
});

// Container for remove column button (top-right of header cell)
export const removeColumnContainer = style({
  position: 'absolute',
  top: '-9px',
  right: '-9px',
  zIndex: 11,
});

// Container for remove row button (left edge of row)
export const removeRowContainer = style({
  position: 'absolute',
  left: '-26px',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 11,
});

// Wrapper for the entire table controls overlay
export const tableControlsWrapper = style({
  position: 'absolute',
  pointerEvents: 'none',
  zIndex: 10,
});

// Enable pointer events only on interactive elements
export const interactive = style({
  pointerEvents: 'auto',
});
