/**
 * Sidebar Components
 *
 * Exports for the sidebar module including the main Sidebar component,
 * PluginPanelSlot for rendering plugin panels, and related utilities.
 *
 * @module
 */

export { Sidebar, SidebarTab, SidebarTabSkeleton } from './Sidebar';
export type { SidebarProps, CorePanelDefinition } from './Sidebar';

export {
  PluginPanelSlot,
  PanelLoadingSkeleton,
  PluginErrorBoundary,
  SidebarPanelFallback,
} from './PluginPanelSlot';
export type { PluginPanelSlotProps, PanelProps, PanelApi } from './PluginPanelSlot';
