/// <reference types="@testing-library/jest-dom/vitest" />
import { afterEach, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof window !== 'undefined') {
  const storage = window.localStorage as Storage | undefined;
  if (!storage || typeof storage.getItem !== 'function') {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  }
}

const isIgnorableMessage = (message: string) => {
  if (message.includes('TableObserver')) {
    return true;
  }
  if (message.includes("Cannot assign to read only property 'format'")) {
    return true;
  }
  if (message.includes('WebSocket connection failed') || message.includes('ECONNREFUSED')) {
    return true;
  }
  return false;
};

const isIgnorableAggregate = (error: AggregateError) => {
  const errors = Array.isArray(error.errors) ? error.errors : [];
  return errors.some((entry) => {
    const message = entry instanceof Error ? entry.message : String(entry ?? '');
    return isIgnorableMessage(message);
  });
};

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Suppress Lexical TableObserver errors that fire after cleanup
// This is a known issue with async cleanup in Lexical table tests
// The errors are thrown asynchronously when the MutationObserver fires after DOM cleanup
const originalConsoleError = console.error;

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const message = args[0]?.toString() || '';
    if (message.includes('TableObserver')) return;
    originalConsoleError.apply(console, args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Also handle uncaught errors at the process level
process.on('uncaughtException', (error) => {
  const message = error?.message ?? '';
  if (isIgnorableMessage(message)) {
    return;
  }
  if (error instanceof AggregateError && isIgnorableAggregate(error)) {
    return;
  }
  throw error;
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  if (reason instanceof AggregateError && isIgnorableAggregate(reason)) {
    return;
  }
  const message = reason instanceof Error ? reason.message : String(reason ?? '');
  if (isIgnorableMessage(message)) {
    return;
  }
  throw reason;
});
