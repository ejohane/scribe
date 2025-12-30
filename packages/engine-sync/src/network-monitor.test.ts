import { describe, it, expect, vi } from 'vitest';
import { DisabledNetworkMonitor, SimpleNetworkMonitor } from './network-monitor.js';

describe('DisabledNetworkMonitor', () => {
  it('always returns false for isOnline()', () => {
    const monitor = new DisabledNetworkMonitor();
    expect(monitor.isOnline()).toBe(false);
  });

  it('returns a no-op unsubscribe function', () => {
    const monitor = new DisabledNetworkMonitor();
    const callback = vi.fn();
    const unsubscribe = monitor.onStatusChange(callback);

    // Should return a function
    expect(typeof unsubscribe).toBe('function');

    // Calling unsubscribe should not throw
    expect(() => unsubscribe()).not.toThrow();

    // Callback should never be called
    expect(callback).not.toHaveBeenCalled();
  });

  it('destroy() does not throw', () => {
    const monitor = new DisabledNetworkMonitor();
    expect(() => monitor.destroy()).not.toThrow();
  });
});

describe('SimpleNetworkMonitor', () => {
  describe('initial state', () => {
    it('defaults to online when no initial value provided', () => {
      const monitor = new SimpleNetworkMonitor();
      expect(monitor.isOnline()).toBe(true);
    });

    it('respects initial online value of true', () => {
      const monitor = new SimpleNetworkMonitor(true);
      expect(monitor.isOnline()).toBe(true);
    });

    it('respects initial online value of false', () => {
      const monitor = new SimpleNetworkMonitor(false);
      expect(monitor.isOnline()).toBe(false);
    });
  });

  describe('setOnline()', () => {
    it('updates online state', () => {
      const monitor = new SimpleNetworkMonitor(true);
      expect(monitor.isOnline()).toBe(true);

      monitor.setOnline(false);
      expect(monitor.isOnline()).toBe(false);

      monitor.setOnline(true);
      expect(monitor.isOnline()).toBe(true);
    });

    it('notifies listeners when state changes', () => {
      const monitor = new SimpleNetworkMonitor(true);
      const callback = vi.fn();
      monitor.onStatusChange(callback);

      monitor.setOnline(false);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(false);

      monitor.setOnline(true);
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith(true);
    });

    it('does not notify listeners when state is unchanged', () => {
      const monitor = new SimpleNetworkMonitor(true);
      const callback = vi.fn();
      monitor.onStatusChange(callback);

      monitor.setOnline(true); // Same value
      expect(callback).not.toHaveBeenCalled();

      monitor.setOnline(false);
      expect(callback).toHaveBeenCalledTimes(1);

      monitor.setOnline(false); // Same value again
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('notifies multiple listeners', () => {
      const monitor = new SimpleNetworkMonitor(true);
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      monitor.onStatusChange(callback1);
      monitor.onStatusChange(callback2);
      monitor.onStatusChange(callback3);

      monitor.setOnline(false);

      expect(callback1).toHaveBeenCalledWith(false);
      expect(callback2).toHaveBeenCalledWith(false);
      expect(callback3).toHaveBeenCalledWith(false);
    });
  });

  describe('onStatusChange()', () => {
    it('returns an unsubscribe function', () => {
      const monitor = new SimpleNetworkMonitor();
      const callback = vi.fn();
      const unsubscribe = monitor.onStatusChange(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('unsubscribe removes listener', () => {
      const monitor = new SimpleNetworkMonitor(true);
      const callback = vi.fn();
      const unsubscribe = monitor.onStatusChange(callback);

      // Verify listener is active
      monitor.setOnline(false);
      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Listener should no longer be called
      monitor.setOnline(true);
      expect(callback).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('unsubscribe is idempotent', () => {
      const monitor = new SimpleNetworkMonitor();
      const callback = vi.fn();
      const unsubscribe = monitor.onStatusChange(callback);

      // Multiple unsubscribes should not throw
      expect(() => unsubscribe()).not.toThrow();
      expect(() => unsubscribe()).not.toThrow();
      expect(() => unsubscribe()).not.toThrow();
    });

    it('can add same callback multiple times', () => {
      const monitor = new SimpleNetworkMonitor(true);
      const callback = vi.fn();

      // Add same callback twice
      monitor.onStatusChange(callback);
      monitor.onStatusChange(callback);

      // Due to Set behavior, it should only be called once
      monitor.setOnline(false);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('destroy()', () => {
    it('removes all listeners', () => {
      const monitor = new SimpleNetworkMonitor(true);
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      monitor.onStatusChange(callback1);
      monitor.onStatusChange(callback2);

      monitor.destroy();

      // Listeners should not be called after destroy
      monitor.setOnline(false);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('can be called multiple times without error', () => {
      const monitor = new SimpleNetworkMonitor();
      expect(() => monitor.destroy()).not.toThrow();
      expect(() => monitor.destroy()).not.toThrow();
    });

    it('allows new listeners after destroy', () => {
      const monitor = new SimpleNetworkMonitor(true);
      const callback1 = vi.fn();

      monitor.onStatusChange(callback1);
      monitor.destroy();

      // Add new listener after destroy
      const callback2 = vi.fn();
      monitor.onStatusChange(callback2);

      monitor.setOnline(false);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith(false);
    });
  });
});
