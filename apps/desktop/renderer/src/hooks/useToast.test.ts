import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from './useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('showToast', () => {
    it('adds toast to array with unique ID', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Test message');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe('Test message');
      expect(result.current.toasts[0].id).toBeDefined();
      expect(typeof result.current.toasts[0].id).toBe('string');
    });

    it('defaults type to success', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Success message');
      });

      expect(result.current.toasts[0].type).toBe('success');
    });

    it('allows setting type to error', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Error message', 'error');
      });

      expect(result.current.toasts[0].type).toBe('error');
    });

    it('generates unique IDs for each toast', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Message 1');
        result.current.showToast('Message 2');
      });

      expect(result.current.toasts).toHaveLength(2);
      expect(result.current.toasts[0].id).not.toBe(result.current.toasts[1].id);
    });
  });

  describe('dismissToast', () => {
    it('removes specific toast by ID', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Message 1');
        result.current.showToast('Message 2');
      });

      const idToRemove = result.current.toasts[0].id;

      act(() => {
        result.current.dismissToast(idToRemove);
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe('Message 2');
    });

    it('handles dismissing non-existent ID gracefully', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Message 1');
      });

      act(() => {
        result.current.dismissToast('non-existent-id');
      });

      // Original toast should still be there
      expect(result.current.toasts).toHaveLength(1);
    });
  });

  describe('auto-dismiss', () => {
    it('auto-dismisses after 3 seconds', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Auto dismiss me');
      });

      expect(result.current.toasts).toHaveLength(1);

      // Advance time by 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('does not dismiss before 3 seconds', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Should still be here');
      });

      // Advance time by just under 3 seconds
      act(() => {
        vi.advanceTimersByTime(2999);
      });

      expect(result.current.toasts).toHaveLength(1);
    });

    it('each toast has independent auto-dismiss timer', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('First toast');
      });

      // Advance 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      act(() => {
        result.current.showToast('Second toast');
      });

      // After 2 more seconds (3 total since first toast)
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // First toast should be gone, second should remain
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe('Second toast');

      // After 1 more second (3 total since second toast)
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe('multiple toasts', () => {
    it('stacks multiple toasts correctly', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('First');
        result.current.showToast('Second', 'error');
        result.current.showToast('Third');
      });

      expect(result.current.toasts).toHaveLength(3);
      expect(result.current.toasts[0].message).toBe('First');
      expect(result.current.toasts[1].message).toBe('Second');
      expect(result.current.toasts[1].type).toBe('error');
      expect(result.current.toasts[2].message).toBe('Third');
    });

    it('maintains order when middle toast is dismissed', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('First');
        result.current.showToast('Second');
        result.current.showToast('Third');
      });

      const middleId = result.current.toasts[1].id;

      act(() => {
        result.current.dismissToast(middleId);
      });

      expect(result.current.toasts).toHaveLength(2);
      expect(result.current.toasts[0].message).toBe('First');
      expect(result.current.toasts[1].message).toBe('Third');
    });
  });

  describe('cleanup on unmount', () => {
    it('cancels pending timeouts on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const { result, unmount } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Toast 1');
        result.current.showToast('Toast 2');
      });

      expect(result.current.toasts).toHaveLength(2);

      unmount();

      // Should have called clearTimeout for each pending toast
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);

      clearTimeoutSpy.mockRestore();
    });

    it('does not throw when unmounting with no toasts', () => {
      const { unmount } = renderHook(() => useToast());

      expect(() => unmount()).not.toThrow();
    });
  });
});
