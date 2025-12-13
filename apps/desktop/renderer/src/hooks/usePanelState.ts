import { useState, useCallback, useMemo } from 'react';

interface UsePanelStateReturn {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Current width of the panel */
  width: number;
  /** Toggle the panel open/closed */
  toggle: () => void;
  /** Open the panel */
  open: () => void;
  /** Close the panel */
  close: () => void;
  /** Set the panel width */
  setWidth: (width: number) => void;
}

/**
 * Custom hook for managing side panel state (sidebar and context panel)
 *
 * Provides:
 * - Open/close state
 * - Resizable width
 * - Toggle, open, close, and setWidth controls
 *
 * @param defaultWidth - Initial width of the panel
 * @param initialOpen - Whether panel starts open (default: false)
 */
export function usePanelState(
  defaultWidth: number,
  initialOpen: boolean = false
): UsePanelStateReturn {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [width, setWidth] = useState(defaultWidth);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return useMemo(
    () => ({
      isOpen,
      width,
      toggle,
      open,
      close,
      setWidth,
    }),
    [isOpen, width, toggle, open, close]
  );
}
