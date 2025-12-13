/// <reference types="@testing-library/jest-dom/vitest" />
import { afterEach, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

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
  if (error.message?.includes('TableObserver')) {
    // Silently ignore TableObserver cleanup errors
    return;
  }
  throw error;
});
