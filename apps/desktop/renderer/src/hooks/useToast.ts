import { useState, useCallback, useRef, useEffect } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface UseToastReturn {
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  dismissToast: (id: string) => void;
}

const AUTO_DISMISS_MS = 3000;

/**
 * Custom hook for managing toast notifications
 *
 * Features:
 * - Auto-dismiss after 3 seconds
 * - Manual dismissal via dismissToast
 * - Multiple concurrent toasts
 * - Cleanup of pending timeouts on unmount
 */
export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Track timeout IDs for cleanup
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /**
   * Dismiss a specific toast by ID
   */
  const dismissToast = useCallback((id: string) => {
    // Clear the timeout if it exists
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Show a new toast notification
   * @param message - The message to display
   * @param type - The type of toast ('success' or 'error'), defaults to 'success'
   */
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      const id = crypto.randomUUID();
      const newToast: Toast = { id, message, type };

      setToasts((prev) => [...prev, newToast]);

      // Set up auto-dismiss timeout
      const timeout = setTimeout(() => {
        dismissToast(id);
      }, AUTO_DISMISS_MS);

      timeoutsRef.current.set(id, timeout);
    },
    [dismissToast]
  );

  // Cleanup all pending timeouts on unmount
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  return { toasts, showToast, dismissToast };
}
