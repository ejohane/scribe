/**
 * Error Boundary Component
 *
 * A React error boundary that catches JavaScript errors in child components,
 * logs them, and displays a fallback UI instead of crashing the whole app.
 *
 * @see https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */

import { Component, ReactNode } from 'react';
import { Surface, Text, Button } from '@scribe/design-system';
import * as styles from './ErrorBoundary.css';

interface ErrorBoundaryProps {
  /** The child components to render */
  children: ReactNode;
  /** Optional name to identify which section crashed (for error messages) */
  name?: string;
  /** Optional fallback component to render on error */
  fallback?: ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log the error for debugging
    console.error(
      `[ErrorBoundary${this.props.name ? `: ${this.props.name}` : ''}] Caught error:`,
      error,
      errorInfo
    );

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Render default error UI
      return (
        <div className={styles.container}>
          <Surface elevation="sm" padding="6" radius="md" bordered className={styles.content}>
            <div className={styles.iconWrapper}>
              <span className={styles.icon}>!</span>
            </div>
            <Text as="h3" size="md" weight="bold" className={styles.title}>
              {this.props.name ? `${this.props.name} Error` : 'Something went wrong'}
            </Text>
            <Text size="sm" color="foregroundMuted" className={styles.message}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
            <Button variant="subtle" size="sm" onClick={this.handleRetry} className={styles.button}>
              Try Again
            </Button>
          </Surface>
        </div>
      );
    }

    return this.props.children;
  }
}
