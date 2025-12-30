import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseClipboardReturn {
  copy: (text: string) => Promise<boolean>;
  copied: boolean;
  error: string | null;
}

/**
 * Custom hook for clipboard operations using Web Clipboard API
 *
 * Features:
 * - Copy text to clipboard via navigator.clipboard.writeText
 * - Track copied state (resets after timeout)
 * - Handle and expose errors gracefully
 * - Safe cleanup on unmount
 *
 * @param resetDelay - Time in ms before copied state resets (default: 2000)
 */
export function useClipboard(resetDelay = 2000): UseClipboardReturn {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setError(null);

        // Clear previous timeout if any
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Reset copied state after delay
        timeoutRef.current = setTimeout(() => {
          setCopied(false);
        }, resetDelay);

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to copy to clipboard';
        setError(message);
        setCopied(false);
        return false;
      }
    },
    [resetDelay]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { copy, copied, error };
}
