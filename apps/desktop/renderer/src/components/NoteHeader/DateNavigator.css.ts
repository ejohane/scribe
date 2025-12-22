import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * DateNavigator styles
 *
 * Provides styling for the date navigation component with:
 * - Hover-reveal chevron buttons
 * - Clickable date button with calendar popover
 * - Smooth transitions and accessibility focus states
 */

/** Container for the date navigator */
export const dateNavigator = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
  position: 'relative',
});

/** Chevron button (prev/next navigation) */
export const chevronButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 0,
  height: '24px',
  padding: 0,
  border: 'none',
  background: 'transparent',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  opacity: 0,
  overflow: 'hidden',
  transition: `opacity ${vars.animation.duration.fast} ${vars.animation.easing.default}, width ${vars.animation.duration.fast} ${vars.animation.easing.default}, background-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  color: vars.color.foregroundMuted,
  ':hover': {
    color: vars.color.foreground,
    backgroundColor: vars.color.surface,
  },
  ':focus': {
    outline: 'none',
  },
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
    opacity: 1,
    width: '24px',
  },
});

/** Visible state for chevron buttons */
export const chevronVisible = style({
  opacity: 1,
  width: '24px',
});

/** Date button that triggers calendar popover */
export const dateButton = style({
  padding: `${vars.spacing['0']} ${vars.spacing['2']} ${vars.spacing['0']} 0`,
  border: 'none',
  background: 'transparent',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  fontSize: vars.typography.size.sm,
  color: vars.color.foreground,
  fontFamily: vars.typography.fontFamily.ui,
  transition: `all ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  ':hover': {
    color: vars.color.accent,
  },
  ':focus': {
    outline: 'none',
  },
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },
});

/** Calendar popover container - positioning handled by @floating-ui/react */
export const calendarPopover = style({
  // Position is managed by Floating UI (useFloating hook provides floatingStyles)
  // The inline styles from floatingStyles handle: position, top, left, transform
  zIndex: 100,
  backgroundColor: vars.color.background,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.lg,
  padding: vars.spacing['2'],
});

/** Screen reader only content */
export const srOnly = style({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
});
