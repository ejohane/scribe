import { useState, useEffect, useCallback, useRef } from 'react';

interface UseMouseActivityOptions {
  /** Timeout in milliseconds before considering the user inactive (default: 2000) */
  timeout?: number;
  /** Whether to track activity (default: true) */
  enabled?: boolean;
  /** Whether typing should immediately hide the UI (default: true) */
  hideOnTyping?: boolean;
}

interface UseMouseActivityReturn {
  /** Whether the UI should be visible (mouse active and not typing) */
  isActive: boolean;
  /** Manually reset the activity timer */
  resetActivity: () => void;
}

/**
 * Custom hook that tracks mouse activity and typing within the application window.
 *
 * Returns `isActive: true` when the user has moved their mouse recently and is not typing.
 * Returns `isActive: false` after the specified timeout of mouse inactivity OR when typing starts.
 *
 * @param options - Configuration options
 * @returns Object with isActive state and resetActivity function
 */
export function useMouseActivity(options: UseMouseActivityOptions = {}): UseMouseActivityReturn {
  const { timeout = 2000, enabled = true, hideOnTyping = true } = options;

  const [isActive, setIsActive] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideUI = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsActive(false);
  }, []);

  const resetActivity = useCallback(() => {
    setIsActive(true);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      setIsActive(false);
    }, timeout);
  }, [timeout]);

  useEffect(() => {
    if (!enabled) {
      setIsActive(true);
      return;
    }

    // Handle mouse movement - show UI
    const handleMouseMove = () => {
      resetActivity();
    };

    // Handle mouse entering the window - show UI
    const handleMouseEnter = () => {
      resetActivity();
    };

    // Handle mouse leaving the window - immediately hide UI
    const handleMouseLeave = () => {
      hideUI();
    };

    // Handle keydown - immediately hide UI when typing
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hideOnTyping) return;

      // Ignore modifier keys alone and navigation shortcuts
      const isModifierOnly =
        e.key === 'Meta' ||
        e.key === 'Control' ||
        e.key === 'Alt' ||
        e.key === 'Shift' ||
        e.key === 'CapsLock';

      // Ignore keyboard shortcuts (Cmd/Ctrl + key)
      const isShortcut = e.metaKey || e.ctrlKey;

      // Hide on actual typing (printable characters, backspace, delete, enter, tab, arrows)
      if (!isModifierOnly && !isShortcut) {
        hideUI();
      }
    };

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('keydown', handleKeyDown);

    // Start the initial timeout
    resetActivity();

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('keydown', handleKeyDown);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, resetActivity, hideUI, hideOnTyping]);

  return { isActive, resetActivity };
}
