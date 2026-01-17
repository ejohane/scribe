/**
 * Tests for ElectronProvider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ScribeAPI } from '@scribe/shared';

// Create a mock API client
const mockApiClient = {
  notes: {
    list: { query: vi.fn().mockResolvedValue([]) },
    get: { query: vi.fn() },
    create: { mutate: vi.fn() },
  },
  search: {
    query: { query: vi.fn() },
  },
  graph: {
    backlinks: { query: vi.fn() },
  },
};

// Mock the client-sdk module
vi.mock('@scribe/client-sdk', () => {
  return {
    createApiClient: vi.fn().mockImplementation(() => mockApiClient),
  };
});

// Create a mock ScribeAPI
function createMockScribeAPI(overrides: Partial<{ getDaemonPort: () => Promise<number> }> = {}) {
  return {
    ping: vi.fn().mockResolvedValue({ message: 'pong', timestamp: Date.now() }),
    shell: {
      openExternal: vi.fn().mockResolvedValue({ success: true }),
      showItemInFolder: vi.fn().mockResolvedValue({ success: true }),
    },
    app: {
      openDevTools: vi.fn().mockResolvedValue({ success: true }),
      getLastOpenedNote: vi.fn().mockResolvedValue(null),
      setLastOpenedNote: vi.fn().mockResolvedValue({ success: true }),
      getConfig: vi.fn().mockResolvedValue({}),
      setConfig: vi.fn().mockResolvedValue({ success: true }),
      relaunch: vi.fn().mockResolvedValue(undefined),
    },
    update: {
      check: vi.fn().mockResolvedValue(undefined),
      install: vi.fn(),
      onChecking: vi.fn().mockReturnValue(vi.fn()),
      onAvailable: vi.fn().mockReturnValue(vi.fn()),
      onNotAvailable: vi.fn().mockReturnValue(vi.fn()),
      onDownloaded: vi.fn().mockReturnValue(vi.fn()),
      onError: vi.fn().mockReturnValue(vi.fn()),
    },
    dialog: {
      selectFolder: vi.fn().mockResolvedValue(null),
    },
    vault: {
      getPath: vi.fn().mockResolvedValue('/test/vault'),
      setPath: vi.fn().mockResolvedValue({ success: true, path: '/test/vault' }),
      create: vi.fn().mockResolvedValue({ success: true, path: '/test/vault' }),
      validate: vi.fn().mockResolvedValue({ valid: true }),
    },
    deepLink: {
      onDeepLink: vi.fn().mockReturnValue(vi.fn()),
    },
    assets: {
      save: vi.fn().mockResolvedValue({ success: true, assetId: 'test-id', ext: 'png' }),
      load: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(true),
      getPath: vi.fn().mockResolvedValue(null),
    },
    window: {
      new: vi.fn().mockResolvedValue(undefined),
      openNote: vi.fn().mockResolvedValue(undefined),
      getId: vi.fn().mockResolvedValue(1),
      close: vi.fn().mockResolvedValue(undefined),
      focus: vi.fn().mockResolvedValue(undefined),
      reportCurrentNote: vi.fn().mockResolvedValue({ success: true }),
    },
    scribe: {
      getDaemonPort: overrides.getDaemonPort ?? vi.fn().mockResolvedValue(47832),
    },
  } as unknown as ScribeAPI;
}

// Import after mocks
import { ElectronProvider, useElectron, useTrpc, useElectronAPI } from './ElectronProvider';
import { createApiClient } from '@scribe/client-sdk';

describe('ElectronProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock
    window.scribe = createMockScribeAPI();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders children when ready', async () => {
    render(
      <ElectronProvider>
        <div data-testid="child">Test Child</div>
      </ElectronProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    render(
      <ElectronProvider>
        <div data-testid="child">Test Child</div>
      </ElectronProvider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows custom loading component', () => {
    render(
      <ElectronProvider loadingComponent={<div data-testid="custom-loading">Custom Loading</div>}>
        <div data-testid="child">Test Child</div>
      </ElectronProvider>
    );

    expect(screen.getByTestId('custom-loading')).toBeInTheDocument();
  });

  it('calls getDaemonPort on mount', async () => {
    render(
      <ElectronProvider>
        <div>Test</div>
      </ElectronProvider>
    );

    await waitFor(() => {
      expect(window.scribe.scribe.getDaemonPort).toHaveBeenCalled();
    });
  });

  it('creates API client with correct port', async () => {
    render(
      <ElectronProvider>
        <div>Test</div>
      </ElectronProvider>
    );

    await waitFor(() => {
      expect(createApiClient).toHaveBeenCalledWith({ port: 47832 });
    });
  });

  it('provides context value with daemon port', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ElectronProvider>{children}</ElectronProvider>
    );

    const { result } = renderHook(() => useElectron(), { wrapper });

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
      expect(result.current.daemonPort).toBe(47832);
    });
  });

  it('handles getDaemonPort error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorMessage = 'Failed to get daemon port';

    window.scribe = createMockScribeAPI({
      getDaemonPort: vi.fn().mockRejectedValue(new Error(errorMessage)),
    });

    render(
      <ElectronProvider>
        <div data-testid="child">Test Child</div>
      </ElectronProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Connection Error/)).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('shows custom error component', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    window.scribe = createMockScribeAPI({
      getDaemonPort: vi.fn().mockRejectedValue(new Error('Test error')),
    });

    render(
      <ElectronProvider
        errorComponent={(error) => <div data-testid="custom-error">{error.message}</div>}
      >
        <div data-testid="child">Test Child</div>
      </ElectronProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('custom-error')).toBeInTheDocument();
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('provides electron API via context', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ElectronProvider>{children}</ElectronProvider>
    );

    const { result } = renderHook(() => useElectron(), { wrapper });

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.electron).toBe(window.scribe);
  });
});

describe('useElectron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scribe = createMockScribeAPI();
  });

  it('throws error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useElectron());
    }).toThrow('useElectron must be used within ElectronProvider');

    consoleSpy.mockRestore();
  });

  it('returns context value when used within provider', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ElectronProvider>{children}</ElectronProvider>
    );

    const { result } = renderHook(() => useElectron(), { wrapper });

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current).toHaveProperty('electron');
    expect(result.current).toHaveProperty('trpc');
    expect(result.current).toHaveProperty('isReady');
    expect(result.current).toHaveProperty('daemonPort');
    expect(result.current).toHaveProperty('error');
  });
});

describe('useTrpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scribe = createMockScribeAPI();
  });

  it('throws error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTrpc());
    }).toThrow('useElectron must be used within ElectronProvider');

    consoleSpy.mockRestore();
  });

  it('creates API client with correct port', async () => {
    render(
      <ElectronProvider>
        <div data-testid="child">Test</div>
      </ElectronProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    // Verify createApiClient was called with correct port
    expect(createApiClient).toHaveBeenCalledWith({ port: 47832 });
  });
});

describe('useElectronAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scribe = createMockScribeAPI();
  });

  it('throws error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useElectronAPI());
    }).toThrow('useElectron must be used within ElectronProvider');

    consoleSpy.mockRestore();
  });

  it('returns electron API when used within provider', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ElectronProvider>{children}</ElectronProvider>
    );

    const { result } = renderHook(() => useElectronAPI(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe(window.scribe);
    });

    // Verify API methods are accessible
    expect(result.current.shell.openExternal).toBeDefined();
    expect(result.current.app.getConfig).toBeDefined();
    expect(result.current.window.new).toBeDefined();
  });
});
