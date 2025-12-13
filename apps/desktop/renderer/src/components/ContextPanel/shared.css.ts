/**
 * Shared styles for ContextPanel widget components
 *
 * Common card styles used across ReferencesWidget, AttendeesWidget, and
 * other context panel widgets to ensure visual consistency.
 */

import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Widget card container
 * Standard card styling for all context panel widgets
 */
export const widgetCard = style({
  backgroundColor: vars.color.background,
  borderRadius: vars.radius.xl,
  padding: vars.spacing['4'],
  marginBottom: vars.spacing['3'],
  boxShadow: vars.shadow.sm,
  border: `1px solid ${vars.color.border}`,
  transition: `background-color ${vars.animation.duration.normal} ${vars.animation.easing.default}`,
});

/**
 * Widget card header
 * Flex container for icon and title
 */
export const widgetCardHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  marginBottom: vars.spacing['3'],
  color: vars.color.foreground,
  fontWeight: vars.typography.weight.medium,
});

/**
 * Widget card icon
 * Standard icon sizing for card headers
 */
export const widgetCardIcon = style({
  width: '14px',
  height: '14px',
  flexShrink: 0,
});

/**
 * Widget card title
 * Standard title typography for card headers
 */
export const widgetCardTitle = style({
  fontSize: vars.typography.size.xs,
});
