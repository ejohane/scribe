import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUpdateStatus } from './useUpdateStatus';

// Store captured callbacks for each event type
type UpdateCallbacks = {
  onChecking: (() => void) | null;
  onAvailable: ((info: { version: string }) => void) | null;
  onNotAvailable: (() => void) | null;
  onDownloaded: ((info: { version: string }) => void) | null;
  onError: ((error: { message: string }) => void) | null;
};

// Store unsubscribe functions to track cleanup
type UnsubscribeFns = {
  onChecking: ReturnType<typeof vi.fn>;
  onAvailable: ReturnType<typeof vi.fn>;
  onNotAvailable: ReturnType<typeof vi.fn>;
  onDownloaded: ReturnType<typeof vi.fn>;
  onError: ReturnType<typeof vi.fn>;
};

describe('useUpdateStatus', () => {
  let capturedCallbacks: UpdateCallbacks;
  let unsubscribeFns: UnsubscribeFns;
  let mockInstall: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset captured callbacks
    capturedCallbacks = {
      onChecking: null,
      onAvailable: null,
      onNotAvailable: null,
      onDownloaded: null,
      onError: null,
    };

    // Create fresh unsubscribe mocks
    unsubscribeFns = {
      onChecking: vi.fn(),
      onAvailable: vi.fn(),
      onNotAvailable: vi.fn(),
      onDownloaded: vi.fn(),
      onError: vi.fn(),
    };

    // Create mock install function
    mockInstall = vi.fn();

    // Mock window.scribe.update API
    window.scribe = {
      update: {
        check: vi.fn(),
        install: mockInstall,
        onChecking: vi.fn((callback) => {
          capturedCallbacks.onChecking = callback;
          return unsubscribeFns.onChecking;
        }),
        onAvailable: vi.fn((callback) => {
          capturedCallbacks.onAvailable = callback;
          return unsubscribeFns.onAvailable;
        }),
        onNotAvailable: vi.fn((callback) => {
          capturedCallbacks.onNotAvailable = callback;
          return unsubscribeFns.onNotAvailable;
        }),
        onDownloaded: vi.fn((callback) => {
          capturedCallbacks.onDownloaded = callback;
          return unsubscribeFns.onDownloaded;
        }),
        onError: vi.fn((callback) => {
          capturedCallbacks.onError = callback;
          return unsubscribeFns.onError;
        }),
      },
    } as unknown as typeof window.scribe;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('status should be idle, hasUpdate should be false, dismissed should be false', () => {
      const { result } = renderHook(() => useUpdateStatus());

      expect(result.current.status).toBe('idle');
      expect(result.current.hasUpdate).toBe(false);
      expect(result.current.dismissed).toBe(false);
      expect(result.current.version).toBeUndefined();
      expect(result.current.error).toBeUndefined();
    });
  });

  describe('checking event', () => {
    it('status changes to checking when onChecking callback is triggered', () => {
      const { result } = renderHook(() => useUpdateStatus());

      // Verify callback was captured
      expect(capturedCallbacks.onChecking).not.toBeNull();

      // Trigger the checking event
      act(() => {
        capturedCallbacks.onChecking!();
      });

      expect(result.current.status).toBe('checking');
    });
  });

  describe('available event', () => {
    it('status changes to downloading and version is set when onAvailable callback is triggered', () => {
      const { result } = renderHook(() => useUpdateStatus());

      // Verify callback was captured
      expect(capturedCallbacks.onAvailable).not.toBeNull();

      // Trigger the available event with version info
      act(() => {
        capturedCallbacks.onAvailable!({ version: '1.2.0' });
      });

      expect(result.current.status).toBe('downloading');
      expect(result.current.version).toBe('1.2.0');
    });
  });

  describe('not available event', () => {
    it('status returns to idle after checking when no update is available', () => {
      const { result } = renderHook(() => useUpdateStatus());

      // First trigger checking
      act(() => {
        capturedCallbacks.onChecking!();
      });

      expect(result.current.status).toBe('checking');

      // Then trigger not available
      act(() => {
        capturedCallbacks.onNotAvailable!();
      });

      expect(result.current.status).toBe('idle');
    });
  });

  describe('downloaded event', () => {
    it('status changes to ready and hasUpdate becomes true when onDownloaded callback is triggered', () => {
      const { result } = renderHook(() => useUpdateStatus());

      // Verify callback was captured
      expect(capturedCallbacks.onDownloaded).not.toBeNull();

      // Trigger the downloaded event
      act(() => {
        capturedCallbacks.onDownloaded!({ version: '1.3.0' });
      });

      expect(result.current.status).toBe('ready');
      expect(result.current.version).toBe('1.3.0');
      expect(result.current.hasUpdate).toBe(true);
    });
  });

  describe('error event', () => {
    it('status changes to error and error message is captured when onError callback is triggered', () => {
      const { result } = renderHook(() => useUpdateStatus());

      // Verify callback was captured
      expect(capturedCallbacks.onError).not.toBeNull();

      // Trigger the error event
      act(() => {
        capturedCallbacks.onError!({ message: 'Network error' });
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Network error');
    });
  });

  describe('dismiss functionality', () => {
    it('dismissed becomes true when dismiss is called', () => {
      const { result } = renderHook(() => useUpdateStatus());

      expect(result.current.dismissed).toBe(false);

      act(() => {
        result.current.dismiss();
      });

      expect(result.current.dismissed).toBe(true);
    });
  });

  describe('new update resets dismissed', () => {
    it('dismissed is reset to false when a new update is downloaded', () => {
      const { result } = renderHook(() => useUpdateStatus());

      // First, dismiss the current state
      act(() => {
        result.current.dismiss();
      });

      expect(result.current.dismissed).toBe(true);

      // Then trigger a new downloaded event
      act(() => {
        capturedCallbacks.onDownloaded!({ version: '2.0.0' });
      });

      expect(result.current.dismissed).toBe(false);
      expect(result.current.status).toBe('ready');
      expect(result.current.version).toBe('2.0.0');
    });
  });

  describe('installUpdate calls API', () => {
    it('installUpdate calls window.scribe.update.install()', () => {
      const { result } = renderHook(() => useUpdateStatus());

      act(() => {
        result.current.installUpdate();
      });

      expect(mockInstall).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup on unmount', () => {
    it('all unsubscribe functions are called when hook unmounts', () => {
      const { unmount } = renderHook(() => useUpdateStatus());

      // Verify no unsubscribe calls before unmount
      expect(unsubscribeFns.onChecking).not.toHaveBeenCalled();
      expect(unsubscribeFns.onAvailable).not.toHaveBeenCalled();
      expect(unsubscribeFns.onNotAvailable).not.toHaveBeenCalled();
      expect(unsubscribeFns.onDownloaded).not.toHaveBeenCalled();
      expect(unsubscribeFns.onError).not.toHaveBeenCalled();

      // Unmount the hook
      unmount();

      // Verify all unsubscribe functions were called
      expect(unsubscribeFns.onChecking).toHaveBeenCalledTimes(1);
      expect(unsubscribeFns.onAvailable).toHaveBeenCalledTimes(1);
      expect(unsubscribeFns.onNotAvailable).toHaveBeenCalledTimes(1);
      expect(unsubscribeFns.onDownloaded).toHaveBeenCalledTimes(1);
      expect(unsubscribeFns.onError).toHaveBeenCalledTimes(1);
    });
  });

  describe('full update flow', () => {
    it('handles complete update lifecycle: checking -> available -> downloaded -> install', () => {
      const { result } = renderHook(() => useUpdateStatus());

      // Initial state
      expect(result.current.status).toBe('idle');
      expect(result.current.hasUpdate).toBe(false);

      // Start checking
      act(() => {
        capturedCallbacks.onChecking!();
      });
      expect(result.current.status).toBe('checking');

      // Update available, start downloading
      act(() => {
        capturedCallbacks.onAvailable!({ version: '2.0.0' });
      });
      expect(result.current.status).toBe('downloading');
      expect(result.current.version).toBe('2.0.0');

      // Download complete
      act(() => {
        capturedCallbacks.onDownloaded!({ version: '2.0.0' });
      });
      expect(result.current.status).toBe('ready');
      expect(result.current.hasUpdate).toBe(true);
      expect(result.current.version).toBe('2.0.0');

      // Install update
      act(() => {
        result.current.installUpdate();
      });
      expect(mockInstall).toHaveBeenCalledTimes(1);
    });
  });
});
