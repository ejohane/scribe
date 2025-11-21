/**
 * Hook for using the markdown parser worker with debouncing.
 * Manages worker lifecycle and provides debounced parsing.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { InlineToken, WorkerMessage, WorkerResponse } from '../workers/markdown-parser.worker';

interface UseMarkdownParserOptions {
  /** Debounce delay in milliseconds (default: 150ms) */
  debounceMs?: number;
}

export function useMarkdownParser(options: UseMarkdownParserOptions = {}) {
  const { debounceMs = 150 } = options;

  const [tokens, setTokens] = useState<InlineToken[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const parseIdRef = useRef(0);
  const debounceTimerRef = useRef<number | null>(null);
  const latestTextRef = useRef<string>('');

  // Initialize worker on mount
  useEffect(() => {
    // Create worker
    const worker = new Worker(new URL('../workers/markdown-parser.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const response = e.data;

      if (response.type === 'result') {
        // Only update if this is the latest parse request
        if (response.id === parseIdRef.current) {
          setTokens(response.tokens);
          setIsParsing(false);
          setError(null);
        }
      } else if (response.type === 'error') {
        if (response.id === parseIdRef.current) {
          setError(response.error);
          setIsParsing(false);
        }
      }
    };

    worker.onerror = (e) => {
      console.error('Parser worker error:', e);
      setError('Parser worker failed');
      setIsParsing(false);
    };

    workerRef.current = worker;

    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      worker.terminate();
    };
  }, []);

  /**
   * Parse markdown text with debouncing.
   */
  const parse = useCallback(
    (text: string) => {
      latestTextRef.current = text;

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set up new debounced parse
      debounceTimerRef.current = window.setTimeout(() => {
        if (!workerRef.current) return;

        // Increment parse ID and send to worker
        parseIdRef.current += 1;
        const parseId = parseIdRef.current;

        setIsParsing(true);

        const message: WorkerMessage = {
          type: 'parse',
          text,
          id: parseId,
        };

        workerRef.current.postMessage(message);
      }, debounceMs);
    },
    [debounceMs]
  );

  /**
   * Parse immediately without debouncing.
   */
  const parseImmediate = useCallback((text: string) => {
    if (!workerRef.current) return;

    // Clear any pending debounced parse
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    latestTextRef.current = text;
    parseIdRef.current += 1;
    const parseId = parseIdRef.current;

    setIsParsing(true);

    const message: WorkerMessage = {
      type: 'parse',
      text,
      id: parseId,
    };

    workerRef.current.postMessage(message);
  }, []);

  return {
    tokens,
    isParsing,
    error,
    parse,
    parseImmediate,
  };
}
