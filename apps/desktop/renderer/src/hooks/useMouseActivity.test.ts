import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMouseActivity } from './useMouseActivity';

describe('useMouseActivity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to dispatch mouse events
  const dispatchMouseMove = () => {
    const event = new MouseEvent('mousemove', { bubbles: true });
    document.dispatchEvent(event);
  };

  const dispatchMouseEnter = () => {
    const event = new MouseEvent('mouseenter', { bubbles: true });
    document.dispatchEvent(event);
  };

  const dispatchMouseLeave = () => {
    const event = new MouseEvent('mouseleave', { bubbles: true });
    document.dispatchEvent(event);
  };

  const dispatchKeyDown = (key: string, options: { metaKey?: boolean; ctrlKey?: boolean } = {}) => {
    const event = new KeyboardEvent('keydown', {
      key,
      metaKey: options.metaKey ?? false,
      ctrlKey: options.ctrlKey ?? false,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  describe('initial state', () => {
    it('starts with isActive true', () => {
      const { result } = renderHook(() => useMouseActivity());

      expect(result.current.isActive).toBe(true);
    });

    it('provides resetActivity function', () => {
      const { result } = renderHook(() => useMouseActivity());

      expect(typeof result.current.resetActivity).toBe('function');
    });
  });

  describe('mouse movement tracking', () => {
    it('remains active on mouse movement', () => {
      const { result } = renderHook(() => useMouseActivity({ timeout: 2000 }));

      act(() => {
        dispatchMouseMove();
      });

      expect(result.current.isActive).toBe(true);
    });

    it('resets idle timer on mouse movement', () => {
      const { result } = renderHook(() => useMouseActivity({ timeout: 2000 }));

      // Advance timer partway
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      // Move mouse - should reset timer
      act(() => {
        dispatchMouseMove();
      });

      expect(result.current.isActive).toBe(true);

      // Advance another 1500ms - should still be active (timer was reset)
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.isActive).toBe(true);

      // Advance full timeout - now should be inactive
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(result.current.isActive).toBe(false);
    });

    it('becomes active on mouse enter', () => {
      const { result } = renderHook(() => useMouseActivity({ timeout: 2000 }));

      // Wait for inactive
      act(() => {
        vi.advanceTimersByTime(2100);
      });

      expect(result.current.isActive).toBe(false);

      // Mouse enters
      act(() => {
        dispatchMouseEnter();
      });

      expect(result.current.isActive).toBe(true);
    });

    it('becomes inactive on mouse leave', () => {
      const { result } = renderHook(() => useMouseActivity({ timeout: 2000 }));

      expect(result.current.isActive).toBe(true);

      act(() => {
        dispatchMouseLeave();
      });

      expect(result.current.isActive).toBe(false);
    });
  });

  describe('idle state detection', () => {
    it('detects idle state after timeout', () => {
      const { result } = renderHook(() => useMouseActivity({ timeout: 2000 }));

      expect(result.current.isActive).toBe(true);

      // Advance timer past timeout
      act(() => {
        vi.advanceTimersByTime(2100);
      });

      expect(result.current.isActive).toBe(false);
    });

    it('uses default timeout of 2000ms', () => {
      const { result } = renderHook(() => useMouseActivity());

      // Advance less than default timeout
      act(() => {
        vi.advanceTimersByTime(1900);
      });

      expect(result.current.isActive).toBe(true);

      // Advance past default timeout
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.isActive).toBe(false);
    });

    it('respects custom timeout value', () => {
      const { result } = renderHook(() => useMouseActivity({ timeout: 500 }));

      // Advance less than custom timeout
      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(result.current.isActive).toBe(true);

      // Advance past custom timeout
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.isActive).toBe(false);
    });
  });

  describe('keyboard interaction', () => {
    it('hides UI on typing when hideOnTyping is true', () => {
      const { result } = renderHook(() => useMouseActivity({ hideOnTyping: true }));

      expect(result.current.isActive).toBe(true);

      act(() => {
        dispatchKeyDown('a');
      });

      expect(result.current.isActive).toBe(false);
    });

    it('does not hide on typing when hideOnTyping is false', () => {
      const { result } = renderHook(() => useMouseActivity({ hideOnTyping: false }));

      expect(result.current.isActive).toBe(true);

      act(() => {
        dispatchKeyDown('a');
      });

      expect(result.current.isActive).toBe(true);
    });

    it('ignores modifier keys alone', () => {
      const { result } = renderHook(() => useMouseActivity({ hideOnTyping: true }));

      expect(result.current.isActive).toBe(true);

      // Press modifier keys alone
      act(() => {
        dispatchKeyDown('Meta');
      });

      expect(result.current.isActive).toBe(true);

      act(() => {
        dispatchKeyDown('Control');
      });

      expect(result.current.isActive).toBe(true);

      act(() => {
        dispatchKeyDown('Alt');
      });

      expect(result.current.isActive).toBe(true);

      act(() => {
        dispatchKeyDown('Shift');
      });

      expect(result.current.isActive).toBe(true);

      act(() => {
        dispatchKeyDown('CapsLock');
      });

      expect(result.current.isActive).toBe(true);
    });

    it('ignores keyboard shortcuts (Cmd/Ctrl + key)', () => {
      const { result } = renderHook(() => useMouseActivity({ hideOnTyping: true }));

      expect(result.current.isActive).toBe(true);

      // Press Cmd+K (a shortcut)
      act(() => {
        dispatchKeyDown('k', { metaKey: true });
      });

      expect(result.current.isActive).toBe(true);

      // Press Ctrl+S (a shortcut)
      act(() => {
        dispatchKeyDown('s', { ctrlKey: true });
      });

      expect(result.current.isActive).toBe(true);
    });
  });

  describe('resetActivity function', () => {
    it('resets idle timer when called', () => {
      const { result } = renderHook(() => useMouseActivity({ timeout: 2000 }));

      // Wait until almost inactive
      act(() => {
        vi.advanceTimersByTime(1900);
      });

      expect(result.current.isActive).toBe(true);

      // Reset activity
      act(() => {
        result.current.resetActivity();
      });

      // Advance another 1500ms - should still be active
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.isActive).toBe(true);
    });

    it('reactivates from inactive state', () => {
      const { result } = renderHook(() => useMouseActivity({ timeout: 2000 }));

      // Wait for inactive
      act(() => {
        vi.advanceTimersByTime(2100);
      });

      expect(result.current.isActive).toBe(false);

      // Reset activity
      act(() => {
        result.current.resetActivity();
      });

      expect(result.current.isActive).toBe(true);
    });
  });

  describe('enabled option', () => {
    it('always returns active when disabled', () => {
      const { result } = renderHook(() => useMouseActivity({ enabled: false, timeout: 100 }));

      expect(result.current.isActive).toBe(true);

      // Even after timeout, should remain active
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.isActive).toBe(true);
    });

    it('tracks activity when enabled', () => {
      const { result } = renderHook(() => useMouseActivity({ enabled: true, timeout: 100 }));

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.isActive).toBe(false);
    });

    it('resets to active when disabled dynamically', () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useMouseActivity({ enabled, timeout: 100 }),
        { initialProps: { enabled: true } }
      );

      // Go inactive
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.isActive).toBe(false);

      // Disable tracking
      rerender({ enabled: false });

      expect(result.current.isActive).toBe(true);
    });
  });

  describe('cleanup on unmount', () => {
    it('cleans up event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => useMouseActivity());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseenter', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it('clears timeout on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { unmount } = renderHook(() => useMouseActivity({ timeout: 2000 }));

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });
  });

  describe('return value stability', () => {
    it('resetActivity function reference is stable', () => {
      const { result, rerender } = renderHook(() => useMouseActivity());

      const firstResetActivity = result.current.resetActivity;

      rerender();

      expect(result.current.resetActivity).toBe(firstResetActivity);
    });
  });

  describe('edge cases', () => {
    it('handles rapid mouse movements', () => {
      const { result } = renderHook(() => useMouseActivity({ timeout: 2000 }));

      // Multiple rapid mouse moves
      for (let i = 0; i < 10; i++) {
        act(() => {
          dispatchMouseMove();
        });
      }

      expect(result.current.isActive).toBe(true);
    });

    it('handles alternating enter/leave events', () => {
      const { result } = renderHook(() => useMouseActivity({ timeout: 2000 }));

      act(() => {
        dispatchMouseLeave();
      });
      expect(result.current.isActive).toBe(false);

      act(() => {
        dispatchMouseEnter();
      });
      expect(result.current.isActive).toBe(true);

      act(() => {
        dispatchMouseLeave();
      });
      expect(result.current.isActive).toBe(false);
    });
  });
});
