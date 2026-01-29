/**
 * PluginPanelSlot
 *
 * Wraps plugin panels with error boundary and provides the Panel API.
 * Handles loading states and errors gracefully to prevent plugin issues
 * from crashing the entire sidebar.
 *
 * @module
 */

import { Suspense, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { PluginErrorBoundary, SidebarPanelFallback } from '../../plugins/PluginErrorBoundary';

/**
 * Props passed to plugin panel components.
 */
export interface PanelProps {
  /** Panel API for common operations */
  panelApi: PanelApi;
}

/**
 * API provided to plugin panels for common operations.
 */
export interface PanelApi {
  /** Show a toast notification */
  toast: (message: string, type?: 'info' | 'success' | 'error') => void;
  /** Navigate to a note by ID */
  navigateToNote: (noteId: string) => void;
  /** Close the sidebar */
  closeSidebar: () => void;
}

/**
 * Props for the PluginPanelSlot component.
 */
export interface PluginPanelSlotProps {
  /** ID of the plugin providing this panel */
  pluginId: string;
  /** The panel component to render */
  component: ComponentType<PanelProps> | ComponentType;
  /** Callback to close the sidebar */
  onCloseSidebar?: () => void;
}

/**
 * Loading skeleton shown while a plugin panel loads.
 */
function PanelLoadingSkeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse" data-testid="panel-loading-skeleton">
      <div className="h-4 bg-[var(--bg-tertiary)] rounded w-3/4" />
      <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/2" />
      <div className="h-4 bg-[var(--bg-tertiary)] rounded w-2/3" />
      <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/3" />
    </div>
  );
}

/**
 * Wraps a plugin panel component with error boundary and loading state.
 *
 * Provides the Panel API to the plugin component for common operations
 * like showing toasts, navigating to notes, and closing the sidebar.
 *
 * @example
 * ```tsx
 * <PluginPanelSlot
 *   pluginId="@scribe/plugin-example"
 *   component={ExamplePanel}
 *   onCloseSidebar={() => setSheetOpen(false)}
 * />
 * ```
 */
export function PluginPanelSlot({
  pluginId,
  component: PanelComponent,
  onCloseSidebar,
}: PluginPanelSlotProps) {
  const navigate = useNavigate();

  // Create the panel API
  const panelApi: PanelApi = {
    toast: (message, type = 'info') => {
      // For v1, we use console log since there's no toast system yet
      // This can be upgraded when a toast system is added
      // eslint-disable-next-line no-console -- Fallback toast implementation
      console[type === 'error' ? 'error' : type === 'success' ? 'info' : 'log'](
        `[${type.toUpperCase()}] ${message}`
      );
    },
    navigateToNote: (noteId) => {
      navigate(`/note/${noteId}`);
      onCloseSidebar?.();
    },
    closeSidebar: () => {
      onCloseSidebar?.();
    },
  };

  return (
    <PluginErrorBoundary
      pluginId={pluginId}
      fallback={({ pluginId: pId, resetErrorBoundary }) => (
        <SidebarPanelFallback pluginId={pId} onRetry={resetErrorBoundary} />
      )}
    >
      <Suspense fallback={<PanelLoadingSkeleton />}>
        <PanelComponent panelApi={panelApi} />
      </Suspense>
    </PluginErrorBoundary>
  );
}

export { PanelLoadingSkeleton };
// Re-export from the centralized error boundary module
export { PluginErrorBoundary, SidebarPanelFallback } from '../../plugins/PluginErrorBoundary';
