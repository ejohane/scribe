/**
 * Tests for PluginErrorBoundary and related components
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  PluginErrorBoundary,
  PluginErrorFallback,
  SidebarPanelFallback,
  SlashCommandFallback,
} from './PluginErrorBoundary';

// Suppress console errors during tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Test component that throws an error
function ThrowingComponent({ message = 'Test error' }: { message?: string }): never {
  throw new Error(message);
}

// Test component that may or may not throw
let shouldThrow = true;
function MaybeThrowingComponent() {
  if (shouldThrow) {
    throw new Error('Conditional error');
  }
  return <div data-testid="success-content">Success!</div>;
}

describe('PluginErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
  });

  it('renders children when no error occurs', () => {
    render(
      <PluginErrorBoundary pluginId="test-plugin">
        <div data-testid="child-content">Child content</div>
      </PluginErrorBoundary>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('catches errors and shows default fallback', async () => {
    render(
      <PluginErrorBoundary pluginId="test-plugin">
        <ThrowingComponent />
      </PluginErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('plugin-error-fallback')).toBeInTheDocument();
    });

    expect(screen.getByText('Plugin Error')).toBeInTheDocument();
    expect(screen.getByText(/test-plugin/)).toBeInTheDocument();
  });

  it('logs error with plugin context', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');

    render(
      <PluginErrorBoundary pluginId="my-plugin">
        <ThrowingComponent message="Something went wrong" />
      </PluginErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('plugin-error-fallback')).toBeInTheDocument();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[plugin:my-plugin] Component error:',
      expect.any(Error),
      expect.any(String)
    );
  });

  it('creates error report in JSON format', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log');

    render(
      <PluginErrorBoundary pluginId="report-plugin">
        <ThrowingComponent message="Report test error" />
      </PluginErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('plugin-error-fallback')).toBeInTheDocument();
    });

    // Find the plugin-error-report log call
    const reportCall = consoleLogSpy.mock.calls.find((call) => call[0] === '[plugin-error-report]');

    expect(reportCall).toBeDefined();
    const report = JSON.parse(reportCall![1] as string);
    expect(report.pluginId).toBe('report-plugin');
    expect(report.error.message).toBe('Report test error');
    expect(report.timestamp).toBeDefined();
  });

  it('calls onError callback when error occurs', async () => {
    const onError = vi.fn();

    render(
      <PluginErrorBoundary pluginId="callback-plugin" onError={onError}>
        <ThrowingComponent message="Callback test" />
      </PluginErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('plugin-error-fallback')).toBeInTheDocument();
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Callback test' }),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('uses custom ReactNode fallback when provided', async () => {
    render(
      <PluginErrorBoundary
        pluginId="custom-plugin"
        fallback={<div data-testid="custom-fallback">Custom error UI</div>}
      >
        <ThrowingComponent />
      </PluginErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    });

    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.queryByTestId('plugin-error-fallback')).not.toBeInTheDocument();
  });

  it('uses render function fallback with resetErrorBoundary', async () => {
    render(
      <PluginErrorBoundary
        pluginId="render-fn-plugin"
        fallback={({ pluginId, error, resetErrorBoundary }) => (
          <div data-testid="render-fallback">
            <span>Plugin: {pluginId}</span>
            <span>Error: {error?.message}</span>
            <button onClick={resetErrorBoundary}>Reset</button>
          </div>
        )}
      >
        <MaybeThrowingComponent />
      </PluginErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('render-fallback')).toBeInTheDocument();
    });

    expect(screen.getByText('Plugin: render-fn-plugin')).toBeInTheDocument();
    expect(screen.getByText('Error: Conditional error')).toBeInTheDocument();

    // Test reset functionality
    shouldThrow = false;
    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => {
      expect(screen.getByTestId('success-content')).toBeInTheDocument();
    });
  });

  it('recovers on retry with default fallback', async () => {
    render(
      <PluginErrorBoundary pluginId="retry-plugin">
        <MaybeThrowingComponent />
      </PluginErrorBoundary>
    );

    // Initially shows error
    await waitFor(() => {
      expect(screen.getByTestId('plugin-error-fallback')).toBeInTheDocument();
    });

    // Fix the error and retry
    shouldThrow = false;
    fireEvent.click(screen.getByTestId('plugin-error-retry'));

    // Should recover
    await waitFor(() => {
      expect(screen.getByTestId('success-content')).toBeInTheDocument();
    });
  });
});

describe('PluginErrorFallback', () => {
  it('renders error message with plugin ID', () => {
    const onRetry = vi.fn();
    render(<PluginErrorFallback pluginId="@scribe/test-plugin" error={null} onRetry={onRetry} />);

    expect(screen.getByTestId('plugin-error-fallback')).toBeInTheDocument();
    expect(screen.getByText('Plugin Error')).toBeInTheDocument();
    expect(screen.getByText(/test-plugin/)).toBeInTheDocument();
  });

  it('displays error message', () => {
    const error = new Error('Something went wrong');
    const onRetry = vi.fn();

    render(<PluginErrorFallback pluginId="test-plugin" error={error} onRetry={onRetry} />);

    // Initially details are hidden
    expect(screen.queryByTestId('plugin-error-details')).not.toBeInTheDocument();
  });

  it('toggles error details visibility', () => {
    const error = new Error('Detailed error message');
    error.stack = 'Error: Detailed error message\n    at TestComponent';
    const onRetry = vi.fn();

    render(<PluginErrorFallback pluginId="test-plugin" error={error} onRetry={onRetry} />);

    // Click to show details
    fireEvent.click(screen.getByTestId('plugin-error-toggle-details'));

    expect(screen.getByTestId('plugin-error-details')).toBeInTheDocument();
    expect(screen.getByText(/Detailed error message/)).toBeInTheDocument();

    // Click to hide details
    fireEvent.click(screen.getByTestId('plugin-error-toggle-details'));

    expect(screen.queryByTestId('plugin-error-details')).not.toBeInTheDocument();
  });

  it('calls onRetry when Try Again is clicked', () => {
    const onRetry = vi.fn();

    render(
      <PluginErrorFallback pluginId="test-plugin" error={new Error('Test')} onRetry={onRetry} />
    );

    fireEvent.click(screen.getByTestId('plugin-error-retry'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides details toggle when no error', () => {
    const onRetry = vi.fn();

    render(<PluginErrorFallback pluginId="test-plugin" error={null} onRetry={onRetry} />);

    expect(screen.queryByTestId('plugin-error-toggle-details')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const onRetry = vi.fn();

    render(
      <PluginErrorFallback
        pluginId="test-plugin"
        error={null}
        onRetry={onRetry}
        className="custom-class"
      />
    );

    expect(screen.getByTestId('plugin-error-fallback')).toHaveClass('custom-class');
  });
});

describe('SidebarPanelFallback', () => {
  it('renders minimal fallback UI', () => {
    const onRetry = vi.fn();

    render(<SidebarPanelFallback pluginId="@scribe/sidebar-plugin" onRetry={onRetry} />);

    expect(screen.getByTestId('sidebar-panel-fallback')).toBeInTheDocument();
    expect(screen.getByText('Panel unavailable')).toBeInTheDocument();
    expect(screen.getByText('@scribe/sidebar-plugin')).toBeInTheDocument();
  });

  it('calls onRetry when Retry is clicked', () => {
    const onRetry = vi.fn();

    render(<SidebarPanelFallback pluginId="test-plugin" onRetry={onRetry} />);

    fireEvent.click(screen.getByTestId('sidebar-panel-fallback-retry'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('SlashCommandFallback', () => {
  it('renders inline fallback message', () => {
    render(<SlashCommandFallback />);

    expect(screen.getByTestId('slash-command-fallback')).toBeInTheDocument();
    expect(screen.getByText('[Command failed]')).toBeInTheDocument();
  });

  it('is styled for inline display', () => {
    render(<SlashCommandFallback />);

    const fallback = screen.getByTestId('slash-command-fallback');
    expect(fallback.tagName.toLowerCase()).toBe('span');
  });
});

describe('Error boundary integration', () => {
  beforeEach(() => {
    shouldThrow = true;
  });

  it('works with SidebarPanelFallback as render function', async () => {
    render(
      <PluginErrorBoundary
        pluginId="sidebar-plugin"
        fallback={({ pluginId, resetErrorBoundary }) => (
          <SidebarPanelFallback pluginId={pluginId} onRetry={resetErrorBoundary} />
        )}
      >
        <MaybeThrowingComponent />
      </PluginErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-panel-fallback')).toBeInTheDocument();
    });

    // Reset and verify recovery
    shouldThrow = false;
    fireEvent.click(screen.getByTestId('sidebar-panel-fallback-retry'));

    await waitFor(() => {
      expect(screen.getByTestId('success-content')).toBeInTheDocument();
    });
  });

  it('isolates errors to prevent app crash', async () => {
    render(
      <div data-testid="app-container">
        <div data-testid="other-content">Other app content</div>
        <PluginErrorBoundary pluginId="isolated-plugin">
          <ThrowingComponent />
        </PluginErrorBoundary>
      </div>
    );

    // Error boundary should catch the error
    await waitFor(() => {
      expect(screen.getByTestId('plugin-error-fallback')).toBeInTheDocument();
    });

    // Other content should still be visible
    expect(screen.getByTestId('other-content')).toBeInTheDocument();
    expect(screen.getByText('Other app content')).toBeInTheDocument();
  });
});
