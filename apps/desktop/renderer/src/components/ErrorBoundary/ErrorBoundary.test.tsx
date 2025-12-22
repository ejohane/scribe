/**
 * ErrorBoundary Component Tests
 *
 * Tests for the React error boundary that catches JavaScript errors in child components,
 * logs them, and displays a fallback UI.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import * as styles from './ErrorBoundary.css';

// Component that throws an error on demand
const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Child content</div>;
};

// Component that throws an error with a custom message
const ThrowCustomError = ({ message }: { message: string }) => {
  throw new Error(message);
};

// Wrapper component to test retry functionality with controlled state
const RetryTestWrapper = ({ initialShouldThrow = true }: { initialShouldThrow?: boolean }) => {
  const [shouldThrow, setShouldThrow] = useState(initialShouldThrow);

  return (
    <div>
      <button onClick={() => setShouldThrow(false)} data-testid="fix-error">
        Fix Error
      </button>
      <ErrorBoundary>
        <ThrowError shouldThrow={shouldThrow} />
      </ErrorBoundary>
    </div>
  );
};

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress console.error in tests to keep output clean
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('child rendering when no error', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child">Hello World</div>
        </ErrorBoundary>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('renders multiple children correctly', () => {
      render(
        <ErrorBoundary>
          <div>First child</div>
          <div>Second child</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('First child')).toBeInTheDocument();
      expect(screen.getByText('Second child')).toBeInTheDocument();
    });

    it('renders nested components correctly', () => {
      const NestedComponent = () => (
        <div>
          <span>Nested content</span>
        </div>
      );

      render(
        <ErrorBoundary>
          <NestedComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Nested content')).toBeInTheDocument();
    });
  });

  describe('error catching and display', () => {
    it('catches error and displays default error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('displays error UI with container styling', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      const container = screen.getByText('Something went wrong').closest(`.${styles.container}`);
      expect(container).toBeInTheDocument();
    });

    it('displays error icon', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(screen.getByText('!')).toBeInTheDocument();
    });

    it('displays Try Again button', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });
  });

  describe('error message formatting', () => {
    it('displays error message in UI', () => {
      render(
        <ErrorBoundary>
          <ThrowCustomError message="Custom error occurred" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error occurred')).toBeInTheDocument();
    });

    it('displays fallback message when error has no message', () => {
      const ThrowEmptyError = () => {
        throw new Error();
      };

      render(
        <ErrorBoundary>
          <ThrowEmptyError />
        </ErrorBoundary>
      );

      expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
    });

    it('displays named section error title when name prop is provided', () => {
      render(
        <ErrorBoundary name="Editor">
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(screen.getByText('Editor Error')).toBeInTheDocument();
    });

    it('displays generic title when name prop is not provided', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('recovery/retry functionality', () => {
    it('resets error state when Try Again is clicked and child no longer throws', () => {
      render(<RetryTestWrapper initialShouldThrow={true} />);

      // Verify error UI is shown
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Fix the underlying issue (simulate fixing the bug that caused the error)
      fireEvent.click(screen.getByTestId('fix-error'));

      // Now click Try Again
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

      // Error UI should be gone and children should render
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('shows error again if child still throws after retry', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      // Verify error UI is shown
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Click Try Again - but the child will still throw
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

      // Error UI should still be shown (the child threw again during re-render)
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('Try Again button clears error state internally', () => {
      // This tests that handleRetry sets state correctly
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      // Error caught once
      expect(onError).toHaveBeenCalledTimes(1);

      // Click Try Again - child will throw again, so onError called again
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

      // Error caught twice (once initially, once after retry)
      expect(onError).toHaveBeenCalledTimes(2);
    });
  });

  describe('custom fallback rendering', () => {
    it('renders custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom error UI</div>}>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('does not render custom fallback when no error', () => {
      render(
        <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom error UI</div>}>
          <div>Normal content</div>
        </ErrorBoundary>
      );

      expect(screen.queryByTestId('custom-fallback')).not.toBeInTheDocument();
      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('renders complex custom fallback component', () => {
      const CustomFallback = () => (
        <div>
          <h1>Oops!</h1>
          <p>Something bad happened</p>
          <button>Report Issue</button>
        </div>
      );

      render(
        <ErrorBoundary fallback={<CustomFallback />}>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(screen.getByText('Oops!')).toBeInTheDocument();
      expect(screen.getByText('Something bad happened')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Report Issue' })).toBeInTheDocument();
    });
  });

  describe('error logging behavior', () => {
    it('logs error to console when error is caught', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalled();

      // Find the call from our ErrorBoundary (logger outputs structured format)
      const errorBoundaryCall = consoleErrorSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('[ErrorBoundary]')
      );

      expect(errorBoundaryCall).toBeDefined();
      expect(errorBoundaryCall![0]).toContain('Caught error');
    });

    it('logs error with name in prefix when name prop is provided', () => {
      render(
        <ErrorBoundary name="Sidebar">
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalled();

      // Find the call from our ErrorBoundary - logger outputs name in context
      const errorBoundaryCall = consoleErrorSpy.mock.calls.find(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('[ErrorBoundary]') &&
          call[0].includes('Sidebar')
      );

      expect(errorBoundaryCall).toBeDefined();
    });

    it('logs the actual error object', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalled();

      // Find the call from our ErrorBoundary (logger outputs structured JSON with error message)
      const errorBoundaryCall = consoleErrorSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('[ErrorBoundary]')
      );

      expect(errorBoundaryCall).toBeDefined();
      // Logger serializes error to JSON - check the message is in the output
      expect(errorBoundaryCall![0]).toContain('Test error message');
    });

    it('logs error info (component stack)', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalled();

      // Find the call from our ErrorBoundary
      const errorBoundaryCall = consoleErrorSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('[ErrorBoundary]')
      );

      expect(errorBoundaryCall).toBeDefined();
      // Logger includes componentStack in the JSON context
      expect(errorBoundaryCall![0]).toContain('componentStack');
    });
  });

  describe('onError callback', () => {
    it('calls onError callback when error is caught', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('passes error object to onError callback', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(onError.mock.calls[0][0].message).toBe('Test error message');
    });

    it('passes errorInfo to onError callback', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(onError.mock.calls[0][1]).toHaveProperty('componentStack');
    });

    it('does not call onError when no error occurs', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <div>Normal content</div>
        </ErrorBoundary>
      );

      expect(onError).not.toHaveBeenCalled();
    });

    it('works without onError callback (optional prop)', () => {
      // Should not throw when onError is not provided
      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError shouldThrow />
          </ErrorBoundary>
        );
      }).not.toThrow();

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('multiple error boundaries', () => {
    it('each boundary handles its own errors independently', () => {
      render(
        <div>
          <ErrorBoundary name="Section A">
            <ThrowError shouldThrow />
          </ErrorBoundary>
          <ErrorBoundary name="Section B">
            <div>Section B content</div>
          </ErrorBoundary>
        </div>
      );

      // Section A should show error
      expect(screen.getByText('Section A Error')).toBeInTheDocument();

      // Section B should render normally
      expect(screen.getByText('Section B content')).toBeInTheDocument();
    });

    it('nested error boundaries: inner catches before outer', () => {
      render(
        <ErrorBoundary name="Outer">
          <div>Outer content</div>
          <ErrorBoundary name="Inner">
            <ThrowError shouldThrow />
          </ErrorBoundary>
        </ErrorBoundary>
      );

      // Inner boundary should catch the error
      expect(screen.getByText('Inner Error')).toBeInTheDocument();

      // Outer content should still render
      expect(screen.getByText('Outer content')).toBeInTheDocument();

      // Outer should not show error
      expect(screen.queryByText('Outer Error')).not.toBeInTheDocument();
    });
  });
});
