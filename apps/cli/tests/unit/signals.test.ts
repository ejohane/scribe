/**
 * Tests for signal handling module
 */

import { describe, expect, test, vi } from 'vitest';
import {
  setupSignalHandlers,
  registerCleanupCallback,
  SIGINT_EXIT_CODE,
  SIGTERM_EXIT_CODE,
} from '../../src/signals';

describe('signals', () => {
  describe('exit codes', () => {
    test('SIGINT exit code is 130', () => {
      expect(SIGINT_EXIT_CODE).toBe(130);
    });

    test('SIGTERM exit code is 143', () => {
      expect(SIGTERM_EXIT_CODE).toBe(143);
    });
  });

  describe('registerCleanupCallback', () => {
    test('returns unregister function', () => {
      const callback = vi.fn();
      const unregister = registerCleanupCallback(callback);
      expect(typeof unregister).toBe('function');
      // Clean up
      unregister();
    });

    test('unregister function removes callback', () => {
      const callback = vi.fn();
      const unregister = registerCleanupCallback(callback);
      unregister();
      // Callback should no longer be in the registry
      // We can't directly test this without triggering a signal,
      // but we verify the function doesn't throw
      expect(() => unregister()).not.toThrow();
    });
  });

  describe('setupSignalHandlers', () => {
    test('can be called multiple times without error', () => {
      // setupSignalHandlers is idempotent
      expect(() => {
        setupSignalHandlers();
        setupSignalHandlers();
        setupSignalHandlers();
      }).not.toThrow();
    });

    test('registers SIGINT handler', () => {
      // After calling setupSignalHandlers, there should be listeners
      setupSignalHandlers();
      const listeners = process.listeners('SIGINT');
      expect(listeners.length).toBeGreaterThan(0);
    });

    test('registers SIGTERM handler', () => {
      // After calling setupSignalHandlers, there should be listeners
      setupSignalHandlers();
      const listeners = process.listeners('SIGTERM');
      expect(listeners.length).toBeGreaterThan(0);
    });
  });
});
