/**
 * useClipboard Hook Tests
 *
 * Tests for the useClipboard hook which provides clipboard operations
 * using the Web Clipboard API.
 *
 * Test coverage:
 * - Initial state
 * - Copy success behavior
 * - Copy error handling
 * - Auto-reset of copied state after timeout
 * - Cleanup on unmount (no memory leaks)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useClipboard } from './useClipboard';

// Mock navigator.clipboard
const mockWriteText = vi.fn();

describe('useClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockWriteText.mockClear();
    mockWriteText.mockResolvedValue(undefined);

    // Setup clipboard mock
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('has copied set to false initially', () => {
      const { result } = renderHook(() => useClipboard());
      expect(result.current.copied).toBe(false);
    });

    it('has error set to null initially', () => {
      const { result } = renderHook(() => useClipboard());
      expect(result.current.error).toBe(null);
    });

    it('provides a copy function', () => {
      const { result } = renderHook(() => useClipboard());
      expect(typeof result.current.copy).toBe('function');
    });
  });

  describe('copy success', () => {
    it('calls navigator.clipboard.writeText with the provided text', async () => {
      const { result } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(mockWriteText).toHaveBeenCalledWith('test text');
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });

    it('returns true on success', async () => {
      const { result } = renderHook(() => useClipboard());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.copy('test text');
      });

      expect(success).toBe(true);
    });

    it('sets copied to true on success', async () => {
      const { result } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.copied).toBe(true);
    });

    it('sets error to null on success', async () => {
      const { result } = renderHook(() => useClipboard());

      // First trigger an error
      mockWriteText.mockRejectedValueOnce(new Error('First error'));
      await act(async () => {
        await result.current.copy('text');
      });
      expect(result.current.error).not.toBe(null);

      // Then success - error should be cleared
      mockWriteText.mockResolvedValueOnce(undefined);
      await act(async () => {
        await result.current.copy('text');
      });
      expect(result.current.error).toBe(null);
    });
  });

  describe('copy error', () => {
    it('returns false on error', async () => {
      mockWriteText.mockRejectedValue(new Error('Clipboard access denied'));
      const { result } = renderHook(() => useClipboard());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.copy('test text');
      });

      expect(success).toBe(false);
    });

    it('sets error message from Error object', async () => {
      mockWriteText.mockRejectedValue(new Error('Clipboard access denied'));
      const { result } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.error).toBe('Clipboard access denied');
    });

    it('sets default error message for non-Error exceptions', async () => {
      mockWriteText.mockRejectedValue('Unknown error');
      const { result } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.error).toBe('Failed to copy to clipboard');
    });

    it('sets copied to false on error', async () => {
      mockWriteText.mockRejectedValue(new Error('Error'));
      const { result } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.copied).toBe(false);
    });
  });

  describe('copied state reset', () => {
    it('resets copied to false after default delay (2000ms)', async () => {
      const { result } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.copied).toBe(true);

      // Advance time by default delay
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.copied).toBe(false);
    });

    it('does not reset before the delay expires', async () => {
      const { result } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      // Advance time just before delay
      act(() => {
        vi.advanceTimersByTime(1999);
      });

      expect(result.current.copied).toBe(true);
    });

    it('respects custom resetDelay', async () => {
      const { result } = renderHook(() => useClipboard(500));

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.copied).toBe(true);

      // Advance time by custom delay
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.copied).toBe(false);
    });

    it('clears previous timeout on subsequent copy calls', async () => {
      const { result } = renderHook(() => useClipboard(2000));

      // First copy
      await act(async () => {
        await result.current.copy('first');
      });

      // Advance 1500ms
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.copied).toBe(true);

      // Second copy - should reset the timer
      await act(async () => {
        await result.current.copy('second');
      });

      // Advance another 1500ms (total 3000ms from first, but only 1500ms from second)
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      // Should still be true because second copy reset the timer
      expect(result.current.copied).toBe(true);

      // Advance remaining 500ms
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Now should be false
      expect(result.current.copied).toBe(false);
    });
  });

  describe('cleanup on unmount', () => {
    it('clears timeout on unmount to prevent memory leaks', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const { result, unmount } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      unmount();

      // clearTimeout should have been called for cleanup
      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });

    it('does not throw when unmounting without any copy', () => {
      const { unmount } = renderHook(() => useClipboard());

      expect(() => unmount()).not.toThrow();
    });

    it('does not update state after unmount', async () => {
      const { result, unmount } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.copied).toBe(true);

      unmount();

      // Advance timers - should not throw or cause issues
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // No error should occur (state update after unmount would warn in React)
    });
  });

  describe('edge cases', () => {
    it('handles empty string', async () => {
      const { result } = renderHook(() => useClipboard());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.copy('');
      });

      expect(success).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('');
    });

    it('handles special characters', async () => {
      const { result } = renderHook(() => useClipboard());
      const specialText = '🎉 Special chars: <>&"\'\\n\\t';

      await act(async () => {
        await result.current.copy(specialText);
      });

      expect(mockWriteText).toHaveBeenCalledWith(specialText);
    });

    it('handles very long text', async () => {
      const { result } = renderHook(() => useClipboard());
      const longText = 'a'.repeat(100000);

      await act(async () => {
        await result.current.copy(longText);
      });

      expect(mockWriteText).toHaveBeenCalledWith(longText);
    });
  });
});
