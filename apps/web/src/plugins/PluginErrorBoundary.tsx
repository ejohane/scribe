/**
 * PluginErrorBoundary
 *
 * React error boundary that wraps plugin components to catch rendering errors.
 * When a plugin crashes, the error boundary shows a fallback UI instead of
 * crashing the entire app.
 *
 * Features:
 * - Isolation: A buggy plugin doesn't crash the app
 * - Recovery: User can retry or still use other features
 * - Debugging: Errors are logged with plugin context
 * - UX: Clean fallback UI instead of white screen
 * - Custom fallbacks: Different contexts can provide appropriate fallbacks
 *
 * @module
 */

import { Component, type ReactNode, type ErrorInfo, useState, useCallback } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Error report structure for logging and potential future error tracking.
 */
export interface PluginErrorReport {
  pluginId: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  componentStack?: string;
  timestamp: string;
}

/**
 * Props passed to custom fallback render functions.
 */
export interface FallbackProps {
  /** ID of the plugin that errored */
  pluginId: string;
  /** The error that was caught */
  error: Error | null;
  /** Reset the error boundary to retry rendering */
  resetErrorBoundary: () => void;
}

/**
 * Props for the PluginErrorBoundary component.
 */
export interface PluginErrorBoundaryProps {
  /** ID of the plugin being wrapped */
  pluginId: string;
  /**
   * Custom fallback UI. Can be a ReactNode or a render function that receives
   * FallbackProps including the resetErrorBoundary function.
   */
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
  /** Children to wrap with error boundary */
  children: ReactNode;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * State for the error boundary.
 */
interface PluginErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary for plugin components.
 *
 * Catches JavaScript errors in child component tree, logs them with
 * plugin context, and displays a fallback UI.
 *
 * @example
 * ```tsx
 * <PluginErrorBoundary pluginId="@scribe/plugin-example">
 *   <TodoPanel />
 * </PluginErrorBoundary>
 * ```
 *
 * @example
 * ```tsx
 * // With custom fallback
 * <PluginErrorBoundary
 *   pluginId={pluginId}
 *   fallback={<SidebarPanelFallback pluginId={pluginId} onRetry={reload} />}
 * >
 *   <PanelComponent />
 * </PluginErrorBoundary>
 * ```
 */
export class PluginErrorBoundary extends Component<
  PluginErrorBoundaryProps,
  PluginErrorBoundaryState
> {
  constructor(props: PluginErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<PluginErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Store errorInfo in state for display
    this.setState({ errorInfo });

    // Log with plugin context
    // eslint-disable-next-line no-console -- Intentional error logging for debugging
    console.error(
      `[plugin:${this.props.pluginId}] Component error:`,
      error,
      errorInfo.componentStack
    );

    // Create error report for potential future tracking
    this.reportError(error, errorInfo);

    // Call optional callback
    this.props.onError?.(error, errorInfo);
  }

  /**
   * Create and log an error report.
   * In the future, this could send to an error tracking service.
   */
  private reportError(error: Error, errorInfo: ErrorInfo) {
    const errorReport: PluginErrorReport = {
      pluginId: this.props.pluginId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack ?? undefined,
      timestamp: new Date().toISOString(),
    };

    // Log the structured error report
    // eslint-disable-next-line no-console -- Intentional logging for debugging
    console.log('[plugin-error-report]', JSON.stringify(errorReport));
  }

  /**
   * Reset the error state to attempt re-rendering.
   */
  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        // Support render function pattern for custom fallbacks
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback({
            pluginId: this.props.pluginId,
            error: this.state.error,
            resetErrorBoundary: this.handleRetry,
          });
        }
        return this.props.fallback;
      }

      // Use default fallback
      return (
        <PluginErrorFallback
          pluginId={this.props.pluginId}
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Props for the default error fallback component.
 */
export interface PluginErrorFallbackProps {
  /** ID of the plugin that errored */
  pluginId: string;
  /** The error that was caught */
  error: Error | null;
  /** Callback to retry rendering */
  onRetry: () => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Default fallback UI shown when a plugin component crashes.
 *
 * Features:
 * - Shows error message and plugin ID
 * - Expandable error details with stack trace
 * - Retry button to attempt recovery
 *
 * @example
 * ```tsx
 * <PluginErrorFallback
 *   pluginId="@scribe/plugin-example"
 *   error={new Error('Something went wrong')}
 *   onRetry={() => setHasError(false)}
 * />
 * ```
 */
export function PluginErrorFallback({
  pluginId,
  error,
  onRetry,
  className,
}: PluginErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);

  const toggleDetails = useCallback(() => {
    setShowDetails((prev) => !prev);
  }, []);

  return (
    <div
      className={cn(
        'p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950 dark:border-red-800',
        className
      )}
      data-testid="plugin-error-fallback"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Plugin Error</h3>
          <p className="mt-1 text-sm text-red-600 dark:text-red-300">
            The plugin &quot;{pluginId}&quot; encountered an error.
          </p>

          <div className="mt-3 flex gap-2">
            <button
              onClick={onRetry}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 text-sm',
                'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
                'rounded hover:bg-red-200 dark:hover:bg-red-800',
                'transition-colors focus:outline-none focus:ring-2 focus:ring-red-500'
              )}
              data-testid="plugin-error-retry"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Try Again
            </button>
            {error && (
              <button
                onClick={toggleDetails}
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1 text-sm',
                  'text-red-600 dark:text-red-400 hover:underline',
                  'focus:outline-none focus:ring-2 focus:ring-red-500 rounded'
                )}
                aria-expanded={showDetails}
                data-testid="plugin-error-toggle-details"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                    Show Details
                  </>
                )}
              </button>
            )}
          </div>

          {showDetails && error && (
            <pre
              className={cn(
                'mt-3 p-2 text-xs bg-red-100 dark:bg-red-900',
                'rounded overflow-auto max-h-32',
                'text-red-800 dark:text-red-200 font-mono'
              )}
              data-testid="plugin-error-details"
            >
              {error.message}
              {error.stack && (
                <>
                  {'\n\n'}
                  {error.stack}
                </>
              )}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Props for the sidebar panel fallback component.
 */
export interface SidebarPanelFallbackProps {
  /** ID of the plugin that errored */
  pluginId: string;
  /** Callback to retry rendering */
  onRetry: () => void;
}

/**
 * Minimal fallback for sidebar panels.
 *
 * A compact fallback designed for the sidebar context where space is limited.
 *
 * @example
 * ```tsx
 * <PluginErrorBoundary
 *   pluginId={pluginId}
 *   fallback={<SidebarPanelFallback pluginId={pluginId} onRetry={reload} />}
 * >
 *   <PanelComponent />
 * </PluginErrorBoundary>
 * ```
 */
export function SidebarPanelFallback({ pluginId, onRetry }: SidebarPanelFallbackProps) {
  return (
    <div
      className="h-full flex flex-col items-center justify-center p-4 text-center"
      data-testid="sidebar-panel-fallback"
    >
      <AlertCircle className="w-8 h-8 text-[var(--text-muted)] mb-2" aria-hidden="true" />
      <p className="text-sm text-[var(--text-secondary)]">Panel unavailable</p>
      <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">{pluginId}</p>
      <button
        onClick={onRetry}
        className={cn(
          'inline-flex items-center gap-1.5 text-sm',
          'text-[var(--accent-blue)] hover:underline',
          'focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] rounded px-2 py-1'
        )}
        data-testid="sidebar-panel-fallback-retry"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}

/**
 * Minimal inline fallback for slash command errors.
 *
 * A very compact fallback designed for inline display where a slash command
 * component fails to render.
 *
 * @example
 * ```tsx
 * <PluginErrorBoundary
 *   pluginId={pluginId}
 *   fallback={<SlashCommandFallback />}
 * >
 *   <CommandComponent />
 * </PluginErrorBoundary>
 * ```
 */
export function SlashCommandFallback() {
  return (
    <span
      className="text-red-500 dark:text-red-400 text-sm inline-flex items-center gap-1"
      data-testid="slash-command-fallback"
    >
      <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
      [Command failed]
    </span>
  );
}
