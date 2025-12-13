/**
 * CollapsiblePanel primitive exports
 *
 * Provides consistent collapsible panel styles across the application.
 *
 * Usage:
 * - `panelBase` - Base panel container styles (height, background, position)
 * - `panelTransition` - Transition animation styles
 * - `panelBorderRight` / `panelBorderLeft` - Border styles for left/right panels
 * - `panelOpenLeft` / `panelOpenRight` - Open state styles (combine with { width: yourWidthVar })
 * - `panelClosedLeft` / `panelClosedRight` - Closed state styles
 * - `panelInnerBase` - Inner container base styles (combine with { width: yourWidthVar })
 *
 * @example
 * // In your component's .css.ts file:
 * import { createVar, style } from '@vanilla-extract/css';
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
 *   { vars: { [sidebarWidth]: '280px' } },
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
export {
  panelBase,
  panelTransition,
  panelBorderRight,
  panelBorderLeft,
  panelOpenLeft,
  panelOpenRight,
  panelClosedLeft,
  panelClosedRight,
  panelInnerBase,
} from './CollapsiblePanel.css';
