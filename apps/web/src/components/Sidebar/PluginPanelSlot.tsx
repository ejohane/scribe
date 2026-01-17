/**
 * PluginPanelSlot
 *
 * Wraps plugin panels with error boundary and provides the Panel API.
 * Handles loading states and errors gracefully to prevent plugin issues
 * from crashing the entire sidebar.
 *
 * @module
 */

import { Suspense, type ComponentType, type ReactNode, Component } from 'react';
import { useNavigate } from 'react-router-dom';

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
 * Fallback UI shown when a plugin panel crashes.
 */
interface PanelErrorFallbackProps {
  pluginId: string;
  error?: Error;
  onRetry?: () => void;
}

function PanelErrorFallback({ pluginId, error, onRetry }: PanelErrorFallbackProps) {
  return (
    <div className="p-4 text-center" data-testid="panel-error-fallback">
      <p className="text-red-400 text-sm mb-2">This panel encountered an error.</p>
      {error && (
        <p className="text-[var(--text-muted)] text-xs mb-3 font-mono break-all">{error.message}</p>
      )}
      <p className="text-[var(--text-muted)] text-xs mb-3">Plugin: {pluginId}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-[var(--accent-green)] text-sm hover:underline">
          Try Again
        </button>
      )}
    </div>
  );
}

/**
 * Error boundary state.
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary props.
 */
interface PluginErrorBoundaryProps {
  pluginId: string;
  children: ReactNode;
  onError?: (error: Error, pluginId: string) => void;
}

/**
 * Error boundary for plugin panels.
 *
 * Catches errors in plugin components and displays a fallback UI.
 */
class PluginErrorBoundary extends Component<PluginErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: PluginErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console -- Intentional error logging for debugging
    console.error(`[PluginPanelSlot] Plugin ${this.props.pluginId} panel error:`, error);
    this.props.onError?.(error, this.props.pluginId);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <PanelErrorFallback
          pluginId={this.props.pluginId}
          error={this.state.error ?? undefined}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
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
 *   pluginId="@scribe/plugin-todo"
 *   component={TodoPanel}
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
    <PluginErrorBoundary pluginId={pluginId}>
      <Suspense fallback={<PanelLoadingSkeleton />}>
        <PanelComponent panelApi={panelApi} />
      </Suspense>
    </PluginErrorBoundary>
  );
}

export { PanelLoadingSkeleton, PanelErrorFallback, PluginErrorBoundary };
