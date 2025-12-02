import { useState, useCallback, useRef, useEffect } from 'react';

interface UseScrollHeaderOptions {
  /** Threshold in pixels before header starts hiding (default: 50) */
  threshold?: number;
  /** Height of the header in pixels for transform calculation */
  headerHeight?: number;
}

interface UseScrollHeaderReturn {
  /** Whether the header should be visible */
  isVisible: boolean;
  /** Current transform offset (0 to -headerHeight) for parallax effect */
  translateY: number;
  /** Ref to attach to the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  /** Handler to call on scroll events */
  handleScroll: () => void;
}

/**
 * Hook for implementing a parallax hide/show header effect on scroll.
 *
 * - Header is always visible at the top of the document
 * - Scrolling down hides the header with a parallax slide-up effect
 * - Scrolling up reveals the header with a parallax slide-down effect
 * - Uses transform for smooth 60fps animations
 */
export function useScrollHeader(options: UseScrollHeaderOptions = {}): UseScrollHeaderReturn {
  const { threshold = 50, headerHeight = 100 } = options;

  const [isVisible, setIsVisible] = useState(true);
  const [translateY, setTranslateY] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const accumulatedDelta = useRef(0);
  const rafId = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    // Cancel any pending RAF to avoid stacking
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
    }

    rafId.current = requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const scrollTop = container.scrollTop;
      const delta = scrollTop - lastScrollTop.current;

      // At the top of the document, always show header
      if (scrollTop <= threshold) {
        setIsVisible(true);
        setTranslateY(0);
        accumulatedDelta.current = 0;
        lastScrollTop.current = scrollTop;
        return;
      }

      // Accumulate scroll delta for parallax effect
      if (delta > 0) {
        // Scrolling down - hide header
        accumulatedDelta.current = Math.min(accumulatedDelta.current + delta, headerHeight);
      } else if (delta < 0) {
        // Scrolling up - show header
        accumulatedDelta.current = Math.max(accumulatedDelta.current + delta, 0);
      }

      // Calculate parallax transform
      const newTranslateY = -accumulatedDelta.current;
      setTranslateY(newTranslateY);

      // Update visibility based on accumulated delta
      const shouldBeVisible = accumulatedDelta.current < headerHeight * 0.5;
      setIsVisible(shouldBeVisible);

      lastScrollTop.current = scrollTop;
    });
  }, [threshold, headerHeight]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return {
    isVisible,
    translateY,
    scrollContainerRef,
    handleScroll,
  };
}
