/**
 * CollapsiblePanel Styles
 *
 * Vanilla-extract styles for collapsible panel UI patterns.
 * Provides consistent styling for sidebars and context panels that
 * can collapse/expand with smooth animations.
 *
 * Two position variants:
 * - `left`: For left-side panels (border-right, translateX negative when closed)
 * - `right`: For right-side panels (border-left, translateX positive when closed)
 *
 * Usage:
 * Compose these styles with your component's width variable using style():
 *
 * @example
 * import { style, createVar } from '@vanilla-extract/css';
 * import {
 *   panelBase,
 *   panelTransition,
 *   panelBorderRight,
 *   panelOpenLeft,
 *   panelClosedLeft,
 *   panelInnerBase,
 * } from '@scribe/design-system';
 *
 * const sidebarWidth = createVar();
 *
 * export const sidebar = style([
 *   panelBase,
 *   panelTransition,
 *   panelBorderRight,
 *   { vars: { [sidebarWidth]: vars.component.panel.defaultWidth } }, // or use custom value
 * ]);
 *
 * export const sidebarOpen = style([
 *   panelOpenLeft,
 *   { width: sidebarWidth },
 * ]);
 *
 * export const sidebarClosed = panelClosedLeft;
 *
 * export const sidebarInner = style([
 *   panelInnerBase,
 *   { width: sidebarWidth },
 * ]);
 */

import { style } from '@vanilla-extract/css';
import { vars } from '../../tokens/contract.css';

/**
 * Base panel container styles
 * These are the shared styles between all collapsible panels
 */
export const panelBase = style({
  height: '100%',
  backgroundColor: vars.color.backgroundAlt,
  flexShrink: 0,
  overflow: 'visible',
  position: 'relative', // For resize handle positioning
  zIndex: 1, // Ensure resize handle is above main content
});

/**
 * Panel transition styles
 * Separated to allow conditional application
 */
export const panelTransition = style({
  transition: `all ${vars.animation.duration.slower} ${vars.animation.easing.smooth}`,
});

/**
 * Left-side panel border (for sidebars)
 */
export const panelBorderRight = style({
  borderRight: `1px solid ${vars.color.border}`,
});

/**
 * Right-side panel border (for context panels)
 */
export const panelBorderLeft = style({
  borderLeft: `1px solid ${vars.color.border}`,
});

/**
 * Open state for left-side panels
 * Combine with { width: yourWidthVar } in style()
 */
export const panelOpenLeft = style({
  opacity: 1,
  transform: 'translateX(0)',
});

/**
 * Open state for right-side panels
 * Combine with { width: yourWidthVar } in style()
 */
export const panelOpenRight = style({
  opacity: 1,
  transform: 'translateX(0)',
});

/**
 * Closed state for left-side panels
 * Slides out to the left
 */
export const panelClosedLeft = style({
  width: 0,
  opacity: 0,
  transform: `translateX(calc(-1 * ${vars.component.panel.slideOffset}))`,
  overflow: 'hidden', // Hide content when closed
});

/**
 * Closed state for right-side panels
 * Slides out to the right
 */
export const panelClosedRight = style({
  width: 0,
  opacity: 0,
  transform: `translateX(${vars.component.panel.slideOffset})`,
  overflow: 'hidden', // Hide content when closed
});

/**
 * Inner container base styles
 * Maintains width during collapse animation
 * Combine with { width: yourWidthVar } in style()
 */
export const panelInnerBase = style({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden', // Hide content during collapse animation
});
