import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollHeader } from './useScrollHeader';

// Mock requestAnimationFrame and cancelAnimationFrame
const mockRaf = vi.fn((callback: FrameRequestCallback) => {
  // Execute immediately for testing
  callback(0);
  return 1;
});
const mockCancelRaf = vi.fn();

describe('useScrollHeader', () => {
  beforeEach(() => {
    // Reset mock implementations to default behavior
    mockRaf.mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    mockCancelRaf.mockImplementation(() => {});

    vi.stubGlobal('requestAnimationFrame', mockRaf);
    vi.stubGlobal('cancelAnimationFrame', mockCancelRaf);
    mockRaf.mockClear();
    mockCancelRaf.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Helper to create a mock scroll container with configurable scrollTop
  function createMockContainer(scrollTop: number = 0): HTMLDivElement {
    return {
      scrollTop,
    } as HTMLDivElement;
  }

  describe('initial state', () => {
    it('returns isVisible as true initially', () => {
      const { result } = renderHook(() => useScrollHeader());

      expect(result.current.isVisible).toBe(true);
    });

    it('returns translateY as 0 initially', () => {
      const { result } = renderHook(() => useScrollHeader());

      expect(result.current.translateY).toBe(0);
    });

    it('provides a scrollContainerRef', () => {
      const { result } = renderHook(() => useScrollHeader());

      expect(result.current.scrollContainerRef).toBeDefined();
      expect(result.current.scrollContainerRef.current).toBeNull();
    });

    it('provides a handleScroll function', () => {
      const { result } = renderHook(() => useScrollHeader());

      expect(typeof result.current.handleScroll).toBe('function');
    });
  });

  describe('default options', () => {
    it('uses default threshold of 50', () => {
      const { result } = renderHook(() => useScrollHeader());

      // Manually set scrollContainerRef
      const container = createMockContainer(30);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      act(() => {
        result.current.handleScroll();
      });

      // Should still be visible within threshold
      expect(result.current.isVisible).toBe(true);
      expect(result.current.translateY).toBe(0);
    });

    it('uses default headerHeight of 100', () => {
      const { result } = renderHook(() => useScrollHeader());

      // Set up container past threshold
      const container = createMockContainer(60);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // First scroll establishes position - delta will be 60 (scrollTop - lastScrollTop which is 0)
      act(() => {
        result.current.handleScroll();
      });

      // Scroll down more - now delta is 200 - 60 = 140, accumulated will be 60 + 140 = 200, capped at 100
      container.scrollTop = 200;
      act(() => {
        result.current.handleScroll();
      });

      // TranslateY should be capped at -headerHeight (default -100)
      expect(result.current.translateY).toBe(-100);
    });
  });

  describe('custom options', () => {
    it('respects custom threshold', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 100 }));

      const container = createMockContainer(80);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      act(() => {
        result.current.handleScroll();
      });

      // 80 is within threshold of 100, so should stay visible
      expect(result.current.isVisible).toBe(true);
      expect(result.current.translateY).toBe(0);
    });

    it('respects custom headerHeight', () => {
      const { result } = renderHook(() => useScrollHeader({ headerHeight: 50 }));

      const container = createMockContainer(60);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // First scroll - delta is 60, accumulated capped at headerHeight (50)
      act(() => {
        result.current.handleScroll();
      });

      // TranslateY should be capped at custom -headerHeight (-50)
      expect(result.current.translateY).toBe(-50);
    });
  });

  describe('scroll position tracking', () => {
    it('does nothing when scrollContainerRef is null', () => {
      const { result } = renderHook(() => useScrollHeader());

      // Don't set scrollContainerRef

      act(() => {
        result.current.handleScroll();
      });

      // State should remain at initial values
      expect(result.current.isVisible).toBe(true);
      expect(result.current.translateY).toBe(0);
    });

    it('shows header when at top of document (within threshold)', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 50 }));

      const container = createMockContainer(20);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      act(() => {
        result.current.handleScroll();
      });

      expect(result.current.isVisible).toBe(true);
      expect(result.current.translateY).toBe(0);
    });

    it('resets accumulated delta when scrolling back within threshold', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 50, headerHeight: 100 }));

      const container = createMockContainer(100);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // Scroll to build up delta (past threshold)
      act(() => {
        result.current.handleScroll();
      });

      // Verify we've accumulated some delta
      expect(result.current.translateY).toBeLessThan(0);

      // Now scroll back to within threshold
      container.scrollTop = 30;
      act(() => {
        result.current.handleScroll();
      });

      // Should reset to visible state
      expect(result.current.isVisible).toBe(true);
      expect(result.current.translateY).toBe(0);
    });
  });

  describe('scroll direction detection', () => {
    it('detects scrolling down (positive delta)', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 50, headerHeight: 100 }));

      const container = createMockContainer(60);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // First scroll establishes baseline
      act(() => {
        result.current.handleScroll();
      });

      const firstTranslateY = result.current.translateY;

      // Scroll down more
      container.scrollTop = 120;
      act(() => {
        result.current.handleScroll();
      });

      // TranslateY should be more negative (hiding more)
      expect(result.current.translateY).toBeLessThan(firstTranslateY);
    });

    it('detects scrolling up (negative delta)', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 50, headerHeight: 100 }));

      const container = createMockContainer(200);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // First scroll establishes baseline - accumulates up to 100 (capped at headerHeight)
      act(() => {
        result.current.handleScroll();
      });

      expect(result.current.translateY).toBe(-100);

      // Scroll up by 50 pixels
      container.scrollTop = 150;
      act(() => {
        result.current.handleScroll();
      });

      // TranslateY should be less negative (moving back toward 0)
      expect(result.current.translateY).toBe(-50);
    });

    it('handles zero delta (no scroll change)', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 50, headerHeight: 100 }));

      const container = createMockContainer(100);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // First scroll
      act(() => {
        result.current.handleScroll();
      });

      const translateAfterFirst = result.current.translateY;

      // Same scroll position
      act(() => {
        result.current.handleScroll();
      });

      // Should remain unchanged
      expect(result.current.translateY).toBe(translateAfterFirst);
    });
  });

  describe('parallax calculation (translateY)', () => {
    it('translateY starts at 0', () => {
      const { result } = renderHook(() => useScrollHeader());

      expect(result.current.translateY).toBe(0);
    });

    it('translateY accumulates based on scroll delta', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 50, headerHeight: 100 }));

      const container = createMockContainer(60);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // First scroll - delta is 60 (60 - 0), so translateY = -60
      act(() => {
        result.current.handleScroll();
      });

      expect(result.current.translateY).toBe(-60);
    });

    it('translateY is capped at -headerHeight', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 50, headerHeight: 100 }));

      const container = createMockContainer(200);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // First scroll - delta is 200, but capped at headerHeight (100)
      act(() => {
        result.current.handleScroll();
      });

      // Should be capped at -100 (headerHeight)
      expect(result.current.translateY).toBe(-100);
    });

    it('translateY increases (toward 0) on scroll up', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 50, headerHeight: 100 }));

      const container = createMockContainer(200);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // Establish baseline with full hide
      act(() => {
        result.current.handleScroll();
      });

      expect(result.current.translateY).toBe(-100);

      // Scroll up by 40 pixels
      container.scrollTop = 160;
      act(() => {
        result.current.handleScroll();
      });

      expect(result.current.translateY).toBe(-60);
    });

    it('translateY is capped at 0 (does not go positive)', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 50, headerHeight: 100 }));

      const container = createMockContainer(80);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // First scroll - accumulate 80
      act(() => {
        result.current.handleScroll();
      });

      expect(result.current.translateY).toBe(-80);

      // Scroll up by more than accumulated delta (go back to 70, so -10 delta)
      container.scrollTop = 70;
      act(() => {
        result.current.handleScroll();
      });

      expect(result.current.translateY).toBe(-70);

      // Scroll up more - go way back (past threshold resets)
      container.scrollTop = 30;
      act(() => {
        result.current.handleScroll();
      });

      // Within threshold, so resets to 0
      expect(result.current.translateY).toBe(0);
    });
  });

  describe('header visibility state', () => {
    it('isVisible is true when accumulatedDelta < headerHeight * 0.5', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 50, headerHeight: 100 }));

      const container = createMockContainer(60);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // First scroll - delta is 60, but we start beyond threshold
      act(() => {
        result.current.handleScroll();
      });

      // 60 > 50 (50% of 100), so isVisible should be false
      // Let's scroll up to reduce accumulated delta below 50
      container.scrollTop = 55;
      act(() => {
        result.current.handleScroll();
      });

      // Now accumulated delta is 60 - 5 = 55, still >= 50
      // Need to scroll up more
      container.scrollTop = 52;
      act(() => {
        result.current.handleScroll();
      });

      // Now accumulated delta is 55 - 3 = 52, still >= 50
      // Let's set up a fresh scenario
      const { result: result2 } = renderHook(() =>
        useScrollHeader({ threshold: 10, headerHeight: 100 })
      );

      const container2 = createMockContainer(20);
      Object.defineProperty(result2.current.scrollContainerRef, 'current', {
        value: container2,
        writable: true,
      });

      // First scroll - delta is 20, accumulated = 20 < 50 (50% of 100)
      act(() => {
        result2.current.handleScroll();
      });

      expect(result2.current.isVisible).toBe(true);
    });

    it('isVisible is false when accumulatedDelta >= headerHeight * 0.5', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 50, headerHeight: 100 }));

      const container = createMockContainer(120);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // First scroll - delta is 120, capped at 100 which is >= 50
      act(() => {
        result.current.handleScroll();
      });

      expect(result.current.isVisible).toBe(false);
    });

    it('visibility transitions based on scroll direction', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 10, headerHeight: 100 }));

      const container = createMockContainer(20);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // First scroll - delta = 20, accumulated = 20 < 50
      act(() => {
        result.current.handleScroll();
      });

      expect(result.current.isVisible).toBe(true);

      // Scroll down past 50% threshold
      container.scrollTop = 80;
      act(() => {
        result.current.handleScroll();
      });

      // accumulated = 20 + 60 = 80 >= 50
      expect(result.current.isVisible).toBe(false);

      // Scroll up significantly
      container.scrollTop = 40;
      act(() => {
        result.current.handleScroll();
      });

      // accumulated = 80 - 40 = 40 < 50
      expect(result.current.isVisible).toBe(true);
    });
  });

  describe('performance (RAF usage)', () => {
    it('uses requestAnimationFrame for scroll handling', () => {
      const { result } = renderHook(() => useScrollHeader());

      const container = createMockContainer(100);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      act(() => {
        result.current.handleScroll();
      });

      expect(mockRaf).toHaveBeenCalled();
    });

    it('cancels previous RAF when handleScroll is called rapidly', () => {
      // Set up RAF to return incrementing IDs
      let rafId = 0;
      mockRaf.mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return ++rafId;
      });

      const { result } = renderHook(() => useScrollHeader());

      const container = createMockContainer(100);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // Multiple rapid scroll calls
      act(() => {
        result.current.handleScroll();
        result.current.handleScroll();
        result.current.handleScroll();
      });

      // cancelAnimationFrame should be called for all but the first
      // (first call has no rafId yet to cancel)
      expect(mockCancelRaf).toHaveBeenCalled();
    });

    it('cleans up RAF on unmount', () => {
      // Set up RAF to not immediately execute (simulating pending RAF)
      mockRaf.mockImplementation((_callback: FrameRequestCallback) => {
        // Don't execute callback to simulate pending RAF
        return 42;
      });

      const { result, unmount } = renderHook(() => useScrollHeader());

      const container = createMockContainer(100);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // Trigger a scroll to create a pending RAF
      result.current.handleScroll();

      // Unmount should cancel pending RAF
      unmount();

      expect(mockCancelRaf).toHaveBeenCalledWith(42);
    });

    it('does not cause excessive re-renders on scroll', () => {
      const renderCount = { current: 0 };

      const { result } = renderHook(() => {
        renderCount.current++;
        return useScrollHeader();
      });

      const container = createMockContainer(100);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      const initialRenderCount = renderCount.current;

      // Scroll without state changes (within threshold)
      container.scrollTop = 30;
      act(() => {
        result.current.handleScroll();
      });

      // Should only re-render when state actually changes
      // The exact number depends on whether isVisible/translateY changed
      expect(renderCount.current).toBeLessThanOrEqual(initialRenderCount + 2);
    });
  });

  describe('edge cases', () => {
    it('handles scrollTop of 0', () => {
      const { result } = renderHook(() => useScrollHeader());

      const container = createMockContainer(0);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      act(() => {
        result.current.handleScroll();
      });

      expect(result.current.isVisible).toBe(true);
      expect(result.current.translateY).toBe(0);
    });

    it('handles very large scroll values', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 50, headerHeight: 100 }));

      // First establish baseline at a position past threshold
      const container = createMockContainer(60);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      act(() => {
        result.current.handleScroll();
      });

      // Now scroll to very large value
      container.scrollTop = 100000;
      act(() => {
        result.current.handleScroll();
      });

      // Should be capped at -headerHeight
      expect(result.current.translateY).toBe(-100);
      expect(result.current.isVisible).toBe(false);
    });

    it('handles threshold equal to 0', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 0, headerHeight: 100 }));

      // With threshold 0, scrollTop <= 0 triggers reset
      // So we need scrollTop > 0 for the header to start hiding
      const container = createMockContainer(1);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // First scroll - delta is 1 (past threshold of 0)
      act(() => {
        result.current.handleScroll();
      });

      expect(result.current.translateY).toBe(-1);

      // Scroll more
      container.scrollTop = 60;
      act(() => {
        result.current.handleScroll();
      });

      // accumulated = 1 + 59 = 60
      expect(result.current.translateY).toBe(-60);
    });

    it('handles rapid scroll direction changes', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 50, headerHeight: 100 }));

      const container = createMockContainer(100);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      act(() => {
        result.current.handleScroll();
      });

      // Scroll down
      container.scrollTop = 150;
      act(() => {
        result.current.handleScroll();
      });

      // Immediately scroll up
      container.scrollTop = 120;
      act(() => {
        result.current.handleScroll();
      });

      // Immediately scroll down
      container.scrollTop = 140;
      act(() => {
        result.current.handleScroll();
      });

      // Should handle these gracefully without errors
      expect(typeof result.current.translateY).toBe('number');
      expect(typeof result.current.isVisible).toBe('boolean');
    });

    it('maintains state consistency after many scroll events', () => {
      const { result } = renderHook(() => useScrollHeader({ threshold: 50, headerHeight: 100 }));

      const container = createMockContainer(0);
      Object.defineProperty(result.current.scrollContainerRef, 'current', {
        value: container,
        writable: true,
      });

      // Simulate many scroll events
      for (let i = 0; i < 100; i++) {
        container.scrollTop = i * 10;
        act(() => {
          result.current.handleScroll();
        });
      }

      // State should be valid
      expect(result.current.translateY).toBeGreaterThanOrEqual(-100);
      expect(result.current.translateY).toBeLessThanOrEqual(0);
      expect(typeof result.current.isVisible).toBe('boolean');
    });
  });

  describe('return value stability', () => {
    it('handleScroll function reference is stable across renders', () => {
      const { result, rerender } = renderHook(() => useScrollHeader());

      const firstHandleScroll = result.current.handleScroll;

      rerender();

      // handleScroll should be memoized via useCallback
      expect(result.current.handleScroll).toBe(firstHandleScroll);
    });

    it('scrollContainerRef reference is stable across renders', () => {
      const { result, rerender } = renderHook(() => useScrollHeader());

      const firstRef = result.current.scrollContainerRef;

      rerender();

      expect(result.current.scrollContainerRef).toBe(firstRef);
    });

    it('handleScroll reference changes when options change', () => {
      const { result, rerender } = renderHook(({ threshold }) => useScrollHeader({ threshold }), {
        initialProps: { threshold: 50 },
      });

      const firstHandleScroll = result.current.handleScroll;

      // Change threshold
      rerender({ threshold: 100 });

      // handleScroll should be recreated since threshold changed
      expect(result.current.handleScroll).not.toBe(firstHandleScroll);
    });
  });
});
