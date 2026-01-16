/**
 * Tests for EditorErrorBoundary component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorErrorBoundary, EditorErrorFallback } from './EditorErrorBoundary';

// Suppress console.error for error boundary tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
});

// Component that throws an error
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }): JSX.Element {
  if (shouldThrow) {
    throw new Error('Test error from component');
  }
  return <div>No error</div>;
}

describe('EditorErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <EditorErrorBoundary>
        <div>Child content</div>
      </EditorErrorBoundary>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders fallback UI when an error occurs', () => {
    render(
      <EditorErrorBoundary>
        <ThrowingComponent />
      </EditorErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Editor Error')).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
  });

  it('displays error details in the fallback', () => {
    render(
      <EditorErrorBoundary>
        <ThrowingComponent />
      </EditorErrorBoundary>
    );

    // Check that error details are present
    expect(screen.getByText('Error details')).toBeInTheDocument();
    expect(screen.getByText('Test error from component')).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const handleError = vi.fn();

    render(
      <EditorErrorBoundary onError={handleError}>
        <ThrowingComponent />
      </EditorErrorBoundary>
    );

    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('logs error to console', () => {
    render(
      <EditorErrorBoundary>
        <ThrowingComponent />
      </EditorErrorBoundary>
    );

    expect(console.error).toHaveBeenCalled();
  });

  it('does not call onError when no error occurs', () => {
    const handleError = vi.fn();

    render(
      <EditorErrorBoundary onError={handleError}>
        <div>Safe content</div>
      </EditorErrorBoundary>
    );

    expect(handleError).not.toHaveBeenCalled();
  });
});

describe('EditorErrorFallback', () => {
  it('renders error message', () => {
    render(<EditorErrorFallback error={null} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Editor Error')).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
  });

  it('displays error details when error is provided', () => {
    const testError = new Error('Specific test error');
    render(<EditorErrorFallback error={testError} />);

    expect(screen.getByText('Error details')).toBeInTheDocument();
    expect(screen.getByText('Specific test error')).toBeInTheDocument();
  });

  it('does not show error details when error is null', () => {
    render(<EditorErrorFallback error={null} />);

    expect(screen.queryByText('Error details')).not.toBeInTheDocument();
  });

  it('has correct role for accessibility', () => {
    render(<EditorErrorFallback error={null} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('applies correct CSS class', () => {
    render(<EditorErrorFallback error={null} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('scribe-editor-error');
  });
});
