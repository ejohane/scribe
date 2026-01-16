/**
 * EditorErrorBoundary - Error boundary for Lexical editor.
 *
 * Catches errors that occur during editor rendering and
 * displays a fallback UI instead of crashing the entire app.
 *
 * @module
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Props for EditorErrorBoundary component.
 */
export interface EditorErrorBoundaryProps {
  /** Children to render */
  children: ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * State for EditorErrorBoundary.
 */
interface EditorErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Default fallback component shown when an error occurs.
 */
export function EditorErrorFallback({ error }: { error: Error | null }): JSX.Element {
  return (
    <div className="scribe-editor-error" role="alert">
      <strong>Editor Error</strong>
      <p>Something went wrong with the editor. Please try refreshing the page.</p>
      {error && (
        <details>
          <summary>Error details</summary>
          <pre>{error.message}</pre>
        </details>
      )}
    </div>
  );
}

/**
 * EditorErrorBoundary - React error boundary for the Lexical editor.
 *
 * This component catches JavaScript errors in its child component tree,
 * logs them, and displays a fallback UI.
 *
 * @example
 * ```tsx
 * <EditorErrorBoundary onError={(error) => logError(error)}>
 *   <LexicalEditor />
 * </EditorErrorBoundary>
 * ```
 */
export class EditorErrorBoundary extends Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  constructor(props: EditorErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): EditorErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    console.error('EditorErrorBoundary caught an error:', error, errorInfo);

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <EditorErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}
