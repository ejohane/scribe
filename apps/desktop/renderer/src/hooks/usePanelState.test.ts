import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePanelState } from './usePanelState';

describe('usePanelState', () => {
  describe('initial state', () => {
    it('starts closed by default', () => {
      const { result } = renderHook(() => usePanelState(280));

      expect(result.current.isOpen).toBe(false);
    });

    it('starts with the provided default width', () => {
      const { result } = renderHook(() => usePanelState(300));

      expect(result.current.width).toBe(300);
    });

    it('can start open when initialOpen is true', () => {
      const { result } = renderHook(() => usePanelState(280, true));

      expect(result.current.isOpen).toBe(true);
    });

    it('starts closed when initialOpen is false', () => {
      const { result } = renderHook(() => usePanelState(280, false));

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('toggle function', () => {
    it('opens a closed panel', () => {
      const { result } = renderHook(() => usePanelState(280, false));

      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('closes an open panel', () => {
      const { result } = renderHook(() => usePanelState(280, true));

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('toggles multiple times correctly', () => {
      const { result } = renderHook(() => usePanelState(280, false));

      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('open function', () => {
    it('opens a closed panel', () => {
      const { result } = renderHook(() => usePanelState(280, false));

      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('keeps an open panel open', () => {
      const { result } = renderHook(() => usePanelState(280, true));

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('close function', () => {
    it('closes an open panel', () => {
      const { result } = renderHook(() => usePanelState(280, true));

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('keeps a closed panel closed', () => {
      const { result } = renderHook(() => usePanelState(280, false));

      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('setWidth function', () => {
    it('updates the panel width', () => {
      const { result } = renderHook(() => usePanelState(280));

      expect(result.current.width).toBe(280);

      act(() => {
        result.current.setWidth(350);
      });

      expect(result.current.width).toBe(350);
    });

    it('can set width to different values', () => {
      const { result } = renderHook(() => usePanelState(280));

      act(() => {
        result.current.setWidth(200);
      });
      expect(result.current.width).toBe(200);

      act(() => {
        result.current.setWidth(400);
      });
      expect(result.current.width).toBe(400);

      act(() => {
        result.current.setWidth(100);
      });
      expect(result.current.width).toBe(100);
    });

    it('preserves isOpen state when width changes', () => {
      const { result } = renderHook(() => usePanelState(280, true));

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.setWidth(350);
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.width).toBe(350);
    });
  });

  describe('return value stability', () => {
    it('returns memoized object when dependencies do not change', () => {
      const { result, rerender } = renderHook(() => usePanelState(280));

      const firstReturn = result.current;

      // Rerender without changes
      rerender();

      // The object reference should be stable due to useMemo
      expect(result.current).toBe(firstReturn);
    });

    it('function references are stable across rerenders', () => {
      const { result, rerender } = renderHook(() => usePanelState(280));

      const firstToggle = result.current.toggle;
      const firstOpen = result.current.open;
      const firstClose = result.current.close;

      rerender();

      expect(result.current.toggle).toBe(firstToggle);
      expect(result.current.open).toBe(firstOpen);
      expect(result.current.close).toBe(firstClose);
    });

    it('returns new object reference when isOpen changes', () => {
      const { result } = renderHook(() => usePanelState(280));

      const firstReturn = result.current;

      act(() => {
        result.current.toggle();
      });

      // After state change, the memoized object should be different
      expect(result.current).not.toBe(firstReturn);
    });

    it('returns new object reference when width changes', () => {
      const { result } = renderHook(() => usePanelState(280));

      const firstReturn = result.current;

      act(() => {
        result.current.setWidth(350);
      });

      // After state change, the memoized object should be different
      expect(result.current).not.toBe(firstReturn);
    });
  });

  describe('edge cases', () => {
    it('handles rapid toggle calls', () => {
      const { result } = renderHook(() => usePanelState(280, false));

      // Rapid toggles
      for (let i = 0; i < 20; i++) {
        act(() => {
          result.current.toggle();
        });
      }

      // Should be in consistent state (even number of toggles = same as start)
      expect(result.current.isOpen).toBe(false);
    });

    it('handles rapid open/close calls', () => {
      const { result } = renderHook(() => usePanelState(280, false));

      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.open();
        });
        expect(result.current.isOpen).toBe(true);

        act(() => {
          result.current.close();
        });
        expect(result.current.isOpen).toBe(false);
      }
    });

    it('handles zero width', () => {
      const { result } = renderHook(() => usePanelState(0));

      expect(result.current.width).toBe(0);
    });

    it('handles very large width', () => {
      const { result } = renderHook(() => usePanelState(10000));

      expect(result.current.width).toBe(10000);
    });

    it('handles negative width (no validation)', () => {
      // Note: The hook doesn't validate width, so negative values are accepted
      const { result } = renderHook(() => usePanelState(-50));

      expect(result.current.width).toBe(-50);
    });

    it('handles fractional width', () => {
      const { result } = renderHook(() => usePanelState(280.5));

      expect(result.current.width).toBe(280.5);
    });
  });

  describe('different initial configurations', () => {
    it('works with small default width', () => {
      const { result } = renderHook(() => usePanelState(100, true));

      expect(result.current.width).toBe(100);
      expect(result.current.isOpen).toBe(true);
    });

    it('works with large default width', () => {
      const { result } = renderHook(() => usePanelState(500, false));

      expect(result.current.width).toBe(500);
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('state independence', () => {
    it('width changes do not affect isOpen', () => {
      const { result } = renderHook(() => usePanelState(280, true));

      expect(result.current.isOpen).toBe(true);

      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.setWidth(200 + i * 50);
        });
        expect(result.current.isOpen).toBe(true);
      }
    });

    it('isOpen changes do not affect width', () => {
      const { result } = renderHook(() => usePanelState(300));

      act(() => {
        result.current.setWidth(350);
      });

      expect(result.current.width).toBe(350);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.width).toBe(350);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.width).toBe(350);
    });
  });
});
