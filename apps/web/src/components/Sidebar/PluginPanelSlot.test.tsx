/**
 * Tests for PluginPanelSlot component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  PluginPanelSlot,
  PanelLoadingSkeleton,
  SidebarPanelFallback,
  type PanelProps,
} from './PluginPanelSlot';

// Mock navigate function
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Test wrapper with router context
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('PanelLoadingSkeleton', () => {
  it('renders loading skeleton', () => {
    render(<PanelLoadingSkeleton />);

    expect(screen.getByTestId('panel-loading-skeleton')).toBeInTheDocument();
    // Should have multiple skeleton elements
    const skeleton = screen.getByTestId('panel-loading-skeleton');
    expect(skeleton.children.length).toBeGreaterThan(0);
  });

  it('has animate-pulse class for animation', () => {
    render(<PanelLoadingSkeleton />);

    const skeleton = screen.getByTestId('panel-loading-skeleton');
    expect(skeleton).toHaveClass('animate-pulse');
  });
});

describe('SidebarPanelFallback', () => {
  it('renders fallback UI', () => {
    const onRetry = vi.fn();
    render(<SidebarPanelFallback pluginId="@test/plugin" onRetry={onRetry} />);

    expect(screen.getByTestId('sidebar-panel-fallback')).toBeInTheDocument();
    expect(screen.getByText('Panel unavailable')).toBeInTheDocument();
    expect(screen.getByText('@test/plugin')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<SidebarPanelFallback pluginId="@test/plugin" onRetry={onRetry} />);

    const retryButton = screen.getByTestId('sidebar-panel-fallback-retry');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('PluginPanelSlot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the panel component', () => {
    const TestPanel = () => <div data-testid="test-panel">Test Panel Content</div>;

    render(
      <TestWrapper>
        <PluginPanelSlot pluginId="@test/plugin" component={TestPanel} />
      </TestWrapper>
    );

    expect(screen.getByTestId('test-panel')).toBeInTheDocument();
    expect(screen.getByText('Test Panel Content')).toBeInTheDocument();
  });

  it('passes panelApi to the component', () => {
    let receivedApi: PanelProps['panelApi'] | undefined;
    const TestPanel = ({ panelApi }: PanelProps) => {
      receivedApi = panelApi;
      return <div data-testid="test-panel">Panel</div>;
    };

    render(
      <TestWrapper>
        <PluginPanelSlot pluginId="@test/plugin" component={TestPanel} />
      </TestWrapper>
    );

    expect(receivedApi).toBeDefined();
    expect(typeof receivedApi?.toast).toBe('function');
    expect(typeof receivedApi?.navigateToNote).toBe('function');
    expect(typeof receivedApi?.closeSidebar).toBe('function');
  });

  it('panelApi.navigateToNote navigates and closes sidebar', () => {
    const onCloseSidebar = vi.fn();
    let receivedApi: PanelProps['panelApi'] | undefined;

    const TestPanel = ({ panelApi }: PanelProps) => {
      receivedApi = panelApi;
      return <div>Panel</div>;
    };

    render(
      <TestWrapper>
        <PluginPanelSlot
          pluginId="@test/plugin"
          component={TestPanel}
          onCloseSidebar={onCloseSidebar}
        />
      </TestWrapper>
    );

    receivedApi?.navigateToNote('note-123');

    expect(mockNavigate).toHaveBeenCalledWith('/note/note-123');
    expect(onCloseSidebar).toHaveBeenCalledTimes(1);
  });

  it('panelApi.closeSidebar calls onCloseSidebar', () => {
    const onCloseSidebar = vi.fn();
    let receivedApi: PanelProps['panelApi'] | undefined;

    const TestPanel = ({ panelApi }: PanelProps) => {
      receivedApi = panelApi;
      return <div>Panel</div>;
    };

    render(
      <TestWrapper>
        <PluginPanelSlot
          pluginId="@test/plugin"
          component={TestPanel}
          onCloseSidebar={onCloseSidebar}
        />
      </TestWrapper>
    );

    receivedApi?.closeSidebar();

    expect(onCloseSidebar).toHaveBeenCalledTimes(1);
  });

  it('panelApi.toast logs to console', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let receivedApi: PanelProps['panelApi'] | undefined;

    const TestPanel = ({ panelApi }: PanelProps) => {
      receivedApi = panelApi;
      return <div>Panel</div>;
    };

    render(
      <TestWrapper>
        <PluginPanelSlot pluginId="@test/plugin" component={TestPanel} />
      </TestWrapper>
    );

    receivedApi?.toast('Info message', 'info');
    expect(consoleSpy).toHaveBeenCalledWith('[INFO] Info message');

    receivedApi?.toast('Success message', 'success');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[SUCCESS] Success message');

    receivedApi?.toast('Error message', 'error');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Error message');

    consoleSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('catches errors in panel component and shows fallback', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const ErrorPanel = () => {
      throw new Error('Panel crashed');
    };

    render(
      <TestWrapper>
        <PluginPanelSlot pluginId="@test/plugin" component={ErrorPanel} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-panel-fallback')).toBeInTheDocument();
    });

    expect(screen.getByText('Panel unavailable')).toBeInTheDocument();
    expect(screen.getByText('@test/plugin')).toBeInTheDocument();

    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('allows retry after error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let shouldError = true;

    const FlakeyPanel = () => {
      if (shouldError) {
        throw new Error('Panel crashed');
      }
      return <div data-testid="recovered-panel">Recovered!</div>;
    };

    render(
      <TestWrapper>
        <PluginPanelSlot pluginId="@test/plugin" component={FlakeyPanel} />
      </TestWrapper>
    );

    // Should show error fallback
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-panel-fallback')).toBeInTheDocument();
    });

    // Fix the error and retry
    shouldError = false;
    fireEvent.click(screen.getByTestId('sidebar-panel-fallback-retry'));

    // Should now render successfully
    await waitFor(() => {
      expect(screen.getByTestId('recovered-panel')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});
