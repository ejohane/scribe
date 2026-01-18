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
  // Ignore Lexical selection errors that occur due to happy-dom compatibility issues
  // This happens when Lexical tries to modify a RangeSelection that happy-dom has frozen
  if (error.message?.includes("Cannot assign to read only property 'format'")) {
    return;
  }
  // Ignore WebSocket connection errors during tests (no daemon running)
  if (
    error.message?.includes('WebSocket connection failed') ||
    error.message?.includes('ECONNREFUSED')
  ) {
    return;
  }
  throw error;
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  // Ignore WebSocket connection errors during tests
  if (message?.includes('WebSocket connection failed') || message?.includes('ECONNREFUSED')) {
    return;
  }
  // Ignore Lexical selection errors
  if (message?.includes("Cannot assign to read only property 'format'")) {
    return;
  }
  throw reason;
});
