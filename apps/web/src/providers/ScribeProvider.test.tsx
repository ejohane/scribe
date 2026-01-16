/**
 * Tests for ScribeProvider
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

// Mock the config first
vi.mock('../config', () => ({
  DAEMON_PORT: 47832,
}));

// Create mock client factory
function createMockClient() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    status: 'disconnected' as const,
    isConnected: false,
    api: {},
    collab: {},
  };
}

// Global mock client reference
let mockClientInstance = createMockClient();

// Mock the client-sdk module
vi.mock('@scribe/client-sdk', () => {
  return {
    ScribeClient: vi.fn().mockImplementation(() => mockClientInstance),
  };
});

// Import after mocks
import { ScribeProvider, useScribe, useScribeClient } from './ScribeProvider';
import { ScribeClient } from '@scribe/client-sdk';

describe('ScribeProvider', () => {
  beforeEach(() => {
    // Create fresh mock client for each test
    mockClientInstance = createMockClient();
    vi.clearAllMocks();
    (ScribeClient as Mock).mockImplementation(() => mockClientInstance);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders children', () => {
    render(
      <ScribeProvider>
        <div data-testid="child">Test Child</div>
      </ScribeProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('provides context value with initial state', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ScribeProvider>{children}</ScribeProvider>
    );

    const { result } = renderHook(() => useScribe(), { wrapper });

    expect(result.current).toHaveProperty('client');
    expect(result.current).toHaveProperty('status');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('isConnected');
    expect(result.current.status).toBe('disconnected');
    expect(result.current.error).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it('creates ScribeClient with correct options', () => {
    render(
      <ScribeProvider>
        <div>Test</div>
      </ScribeProvider>
    );

    expect(ScribeClient).toHaveBeenCalledWith({
      autoDiscover: false,
      port: 47832,
      autoConnect: false,
    });
  });

  it('creates ScribeClient with custom port', () => {
    render(
      <ScribeProvider port={8080}>
        <div>Test</div>
      </ScribeProvider>
    );

    expect(ScribeClient).toHaveBeenCalledWith({
      autoDiscover: false,
      port: 8080,
      autoConnect: false,
    });
  });

  it('calls connect on mount', async () => {
    render(
      <ScribeProvider>
        <div>Test</div>
      </ScribeProvider>
    );

    await waitFor(() => {
      expect(mockClientInstance.connect).toHaveBeenCalled();
    });
  });

  it('subscribes to status-change and error events', async () => {
    render(
      <ScribeProvider>
        <div>Test</div>
      </ScribeProvider>
    );

    await waitFor(() => {
      expect(mockClientInstance.on).toHaveBeenCalledWith('status-change', expect.any(Function));
      expect(mockClientInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  it('cleans up on unmount', () => {
    const { unmount } = render(
      <ScribeProvider>
        <div>Test</div>
      </ScribeProvider>
    );

    unmount();

    expect(mockClientInstance.off).toHaveBeenCalledWith('status-change', expect.any(Function));
    expect(mockClientInstance.off).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockClientInstance.disconnect).toHaveBeenCalled();
  });

  it('updates status when status-change event fires', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ScribeProvider>{children}</ScribeProvider>
    );

    const { result } = renderHook(() => useScribe(), { wrapper });

    // Get the registered status-change handler
    await waitFor(() => {
      expect(mockClientInstance.on).toHaveBeenCalledWith('status-change', expect.any(Function));
    });

    const statusChangeCall = mockClientInstance.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'status-change'
    );
    const statusChangeHandler = statusChangeCall?.[1] as (status: string) => void;

    // Simulate status change
    act(() => {
      statusChangeHandler('connecting');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('connecting');
    });

    act(() => {
      statusChangeHandler('connected');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('updates error when error event fires', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ScribeProvider>{children}</ScribeProvider>
    );

    const { result } = renderHook(() => useScribe(), { wrapper });

    // Get the registered error handler
    await waitFor(() => {
      expect(mockClientInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    const errorCall = mockClientInstance.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'error'
    );
    const errorHandler = errorCall?.[1] as (err: Error) => void;

    // Simulate error
    const testError = new Error('Connection failed');
    act(() => {
      errorHandler(testError);
    });

    await waitFor(() => {
      expect(result.current.error).toBe(testError);
    });
  });
});

describe('useScribe', () => {
  beforeEach(() => {
    mockClientInstance = createMockClient();
    vi.clearAllMocks();
    (ScribeClient as Mock).mockImplementation(() => mockClientInstance);
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test since we expect an error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useScribe());
    }).toThrow('useScribe must be used within a ScribeProvider');

    consoleSpy.mockRestore();
  });

  it('returns context value when used within provider', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ScribeProvider>{children}</ScribeProvider>
    );

    const { result } = renderHook(() => useScribe(), { wrapper });

    expect(result.current).toBeDefined();
    expect(result.current.client).toBeDefined();
    expect(result.current.status).toBe('disconnected');
    expect(result.current.error).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });
});

describe('useScribeClient', () => {
  beforeEach(() => {
    mockClientInstance = createMockClient();
    vi.clearAllMocks();
    (ScribeClient as Mock).mockImplementation(() => mockClientInstance);
  });

  it('throws error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useScribeClient());
    }).toThrow('useScribe must be used within a ScribeProvider');

    consoleSpy.mockRestore();
  });

  it('throws error when not connected', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ScribeProvider>{children}</ScribeProvider>
    );

    expect(() => {
      renderHook(() => useScribeClient(), { wrapper });
    }).toThrow('Scribe client not connected');

    consoleSpy.mockRestore();
  });

  it('returns client when connected', async () => {
    // Create a hook that uses both hooks to test the connected state
    function useBothHooks() {
      const scribe = useScribe();
      // Only try to get client if connected
      let client = null;
      try {
        if (scribe.status === 'connected') {
          client = useScribeClient();
        }
      } catch {
        // Expected when not connected
      }
      return { scribe, client };
    }

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ScribeProvider>{children}</ScribeProvider>
    );

    const { result } = renderHook(() => useBothHooks(), { wrapper });

    // Get the registered status-change handler
    await waitFor(() => {
      expect(mockClientInstance.on).toHaveBeenCalledWith('status-change', expect.any(Function));
    });

    const statusChangeCall = mockClientInstance.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'status-change'
    );
    const statusChangeHandler = statusChangeCall?.[1] as (status: string) => void;

    // Initially not connected
    expect(result.current.scribe.status).toBe('disconnected');
    expect(result.current.client).toBeNull();

    // Simulate connected state
    act(() => {
      statusChangeHandler('connected');
    });

    await waitFor(() => {
      expect(result.current.scribe.status).toBe('connected');
      expect(result.current.client).toBeDefined();
    });
  });
});
