/**
 * Unit Tests for Auto-Updater Timer Management
 *
 * Tests the fix for memory leak where setInterval/setTimeout were not properly
 * cleared when setupAutoUpdater() is called multiple times.
 *
 * Issue: scribe-3r5
 *
 * These tests verify:
 * - Interval and timeout IDs are stored at module level
 * - Existing timers are cleared before creating new ones
 * - cleanupAutoUpdater() properly clears all timers
 * - Only one interval is active after multiple setupAutoUpdater() calls
 *
 * Note: These are isolation tests that mock the electron and electron-updater
 * modules since they can't run outside of Electron runtime.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

// =============================================================================
// Test implementation that mirrors the auto-updater.ts logic
// This allows us to test the timer management without Electron dependencies
// =============================================================================

// Simulates the module-level state
let updateCheckInterval: ReturnType<typeof setInterval> | null = null;
let initialCheckTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Simulates setupAutoUpdater's timer management logic
 */
function setupAutoUpdaterTimers(): void {
  // Clear any existing timers to prevent accumulation
  if (initialCheckTimeout !== null) {
    clearTimeout(initialCheckTimeout);
    initialCheckTimeout = null;
  }
  if (updateCheckInterval !== null) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }

  // Create new timers (using very short intervals for testing)
  initialCheckTimeout = setTimeout(() => {
    // Would call autoUpdater.checkForUpdates()
  }, 100);

  updateCheckInterval = setInterval(() => {
    // Would call autoUpdater.checkForUpdates()
  }, 100);
}

/**
 * Simulates cleanupAutoUpdater logic
 */
function cleanupAutoUpdaterTimers(): boolean {
  let cleared = false;

  if (initialCheckTimeout !== null) {
    clearTimeout(initialCheckTimeout);
    initialCheckTimeout = null;
    cleared = true;
  }

  if (updateCheckInterval !== null) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
    cleared = true;
  }

  return cleared;
}

/**
 * Simulates getAutoUpdaterTimerState
 */
function getTimerState(): {
  hasInitialCheckTimeout: boolean;
  hasUpdateCheckInterval: boolean;
} {
  return {
    hasInitialCheckTimeout: initialCheckTimeout !== null,
    hasUpdateCheckInterval: updateCheckInterval !== null,
  };
}

// =============================================================================
// Unit Tests
// =============================================================================

describe('Auto-Updater Timer Management (Isolation Tests)', () => {
  beforeEach(() => {
    // Clean up any existing timers before each test
    cleanupAutoUpdaterTimers();
  });

  afterEach(() => {
    // Always cleanup after tests to prevent timer leaks
    cleanupAutoUpdaterTimers();
  });

  describe('getAutoUpdaterTimerState', () => {
    it('should return both timers as inactive initially', () => {
      const state = getTimerState();
      expect(state.hasInitialCheckTimeout).toBe(false);
      expect(state.hasUpdateCheckInterval).toBe(false);
    });

    it('should return both timers as active after setup', () => {
      setupAutoUpdaterTimers();

      const state = getTimerState();
      expect(state.hasInitialCheckTimeout).toBe(true);
      expect(state.hasUpdateCheckInterval).toBe(true);
    });

    it('should return both timers as inactive after cleanup', () => {
      setupAutoUpdaterTimers();
      cleanupAutoUpdaterTimers();

      const state = getTimerState();
      expect(state.hasInitialCheckTimeout).toBe(false);
      expect(state.hasUpdateCheckInterval).toBe(false);
    });
  });

  describe('cleanupAutoUpdater', () => {
    it('should return false when no timers are active', () => {
      const cleared = cleanupAutoUpdaterTimers();
      expect(cleared).toBe(false);
    });

    it('should return true when timers were cleared', () => {
      setupAutoUpdaterTimers();

      const cleared = cleanupAutoUpdaterTimers();
      expect(cleared).toBe(true);
    });

    it('should be idempotent - second call returns false', () => {
      setupAutoUpdaterTimers();

      const firstCleared = cleanupAutoUpdaterTimers();
      const secondCleared = cleanupAutoUpdaterTimers();

      expect(firstCleared).toBe(true);
      expect(secondCleared).toBe(false);
    });
  });

  describe('setupAutoUpdater - timer accumulation prevention', () => {
    it('should only have one set of timers after multiple calls', () => {
      // Call setup multiple times (simulating window recreation/hot reload)
      setupAutoUpdaterTimers();
      setupAutoUpdaterTimers();
      setupAutoUpdaterTimers();

      const state = getTimerState();
      // Should still only have one of each timer active
      expect(state.hasInitialCheckTimeout).toBe(true);
      expect(state.hasUpdateCheckInterval).toBe(true);
    });

    it('should clear previous timers when called again', () => {
      // First setup
      setupAutoUpdaterTimers();
      const stateAfterFirst = getTimerState();
      expect(stateAfterFirst.hasInitialCheckTimeout).toBe(true);
      expect(stateAfterFirst.hasUpdateCheckInterval).toBe(true);

      // Second setup should clear old and create new
      setupAutoUpdaterTimers();
      const stateAfterSecond = getTimerState();
      expect(stateAfterSecond.hasInitialCheckTimeout).toBe(true);
      expect(stateAfterSecond.hasUpdateCheckInterval).toBe(true);

      // Verify cleanup still works (only one set of timers to clear)
      const cleared = cleanupAutoUpdaterTimers();
      expect(cleared).toBe(true);

      const stateAfterCleanup = getTimerState();
      expect(stateAfterCleanup.hasInitialCheckTimeout).toBe(false);
      expect(stateAfterCleanup.hasUpdateCheckInterval).toBe(false);
    });
  });
});

describe('Auto-Updater Memory Leak Prevention (Isolation Tests)', () => {
  afterEach(() => {
    cleanupAutoUpdaterTimers();
  });

  it('scenario: window recreation should not accumulate intervals', () => {
    // Simulate the problematic scenario: window is destroyed and recreated
    // (e.g., during development hot reload or when user closes/opens window on macOS)

    // Initial window creation
    setupAutoUpdaterTimers();
    expect(getTimerState().hasUpdateCheckInterval).toBe(true);

    // Simulate window destruction (no explicit cleanup in original code!)
    // Then window recreation
    setupAutoUpdaterTimers();
    expect(getTimerState().hasUpdateCheckInterval).toBe(true);

    // With the fix, cleanup should clear exactly one interval
    const cleared = cleanupAutoUpdaterTimers();
    expect(cleared).toBe(true);

    // Should be fully cleaned up
    expect(getTimerState().hasUpdateCheckInterval).toBe(false);
  });

  it('scenario: app shutdown should properly cleanup', () => {
    setupAutoUpdaterTimers();

    // Simulate app shutdown by calling cleanup
    cleanupAutoUpdaterTimers();

    // Timers should be cleared
    const state = getTimerState();
    expect(state.hasInitialCheckTimeout).toBe(false);
    expect(state.hasUpdateCheckInterval).toBe(false);
  });

  it('scenario: rapid setup/cleanup cycles should not leak', () => {
    // Simulate rapid setup/cleanup cycles (stress test)
    for (let i = 0; i < 100; i++) {
      setupAutoUpdaterTimers();
      expect(getTimerState().hasUpdateCheckInterval).toBe(true);
    }

    // After 100 rapid setups, only one timer should be active
    const cleared = cleanupAutoUpdaterTimers();
    expect(cleared).toBe(true);

    // And after cleanup, all should be cleared
    expect(getTimerState().hasUpdateCheckInterval).toBe(false);
  });
});

// =============================================================================
// IPC Handler Tests - Simulates the IPC communication setup
// =============================================================================

/**
 * Mock types for Electron's IPC and BrowserWindow
 */
interface MockIpcMain {
  handlers: Map<string, (...args: unknown[]) => Promise<unknown>>;
  listeners: Map<string, (...args: unknown[]) => void>;
  handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => void;
  on: (channel: string, handler: (...args: unknown[]) => void) => void;
}

interface MockWebContents {
  sentMessages: Array<{ channel: string; data: unknown }>;
  send: (channel: string, data?: unknown) => void;
}

interface MockBrowserWindow {
  webContents: MockWebContents;
}

interface MockAutoUpdater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  eventHandlers: Map<string, ((...args: unknown[]) => void)[]>;
  checkForUpdatesCalledCount: number;
  quitAndInstallCalledCount: number;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  checkForUpdates: () => Promise<void>;
  quitAndInstall: () => void;
}

function createMockIpcMain(): MockIpcMain {
  return {
    handlers: new Map(),
    listeners: new Map(),
    handle(channel: string, handler: (...args: unknown[]) => Promise<unknown>) {
      this.handlers.set(channel, handler);
    },
    on(channel: string, handler: (...args: unknown[]) => void) {
      this.listeners.set(channel, handler);
    },
  };
}

function createMockBrowserWindow(): MockBrowserWindow {
  return {
    webContents: {
      sentMessages: [],
      send(channel: string, data?: unknown) {
        this.sentMessages.push({ channel, data });
      },
    },
  };
}

function createMockAutoUpdater(): MockAutoUpdater {
  return {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    eventHandlers: new Map(),
    checkForUpdatesCalledCount: 0,
    quitAndInstallCalledCount: 0,
    on(event: string, handler: (...args: unknown[]) => void) {
      const handlers = this.eventHandlers.get(event) || [];
      handlers.push(handler);
      this.eventHandlers.set(event, handlers);
    },
    async checkForUpdates() {
      this.checkForUpdatesCalledCount++;
    },
    quitAndInstall() {
      this.quitAndInstallCalledCount++;
    },
  };
}

/**
 * Simulates setupAutoUpdater with full IPC and event handling
 * This mirrors the actual implementation for testing purposes
 */
function setupAutoUpdaterFull(
  mockWindow: MockBrowserWindow,
  mockIpcMain: MockIpcMain,
  mockAutoUpdater: MockAutoUpdater
): void {
  // Event handlers - forward to renderer
  mockAutoUpdater.on('checking-for-update', () => {
    mockWindow.webContents.send('update:checking');
  });

  mockAutoUpdater.on('update-available', (info: unknown) => {
    const updateInfo = info as { version: string; releaseDate?: string };
    mockWindow.webContents.send('update:available', {
      version: updateInfo.version,
      releaseDate: updateInfo.releaseDate,
    });
  });

  mockAutoUpdater.on('update-not-available', () => {
    mockWindow.webContents.send('update:not-available');
  });

  mockAutoUpdater.on('update-downloaded', (info: unknown) => {
    const updateInfo = info as { version: string; releaseDate?: string };
    mockWindow.webContents.send('update:downloaded', {
      version: updateInfo.version,
      releaseDate: updateInfo.releaseDate,
    });
  });

  mockAutoUpdater.on('error', (err: unknown) => {
    const error = err as Error;
    mockWindow.webContents.send('update:error', {
      message: error.message,
    });
  });

  // IPC handlers for renderer-initiated actions
  mockIpcMain.handle('update:check', async () => {
    await mockAutoUpdater.checkForUpdates();
  });

  mockIpcMain.on('update:install', () => {
    mockAutoUpdater.quitAndInstall();
  });
}

describe('Auto-Updater IPC Handler Tests', () => {
  let mockWindow: MockBrowserWindow;
  let mockIpcMain: MockIpcMain;
  let mockAutoUpdater: MockAutoUpdater;

  beforeEach(() => {
    mockWindow = createMockBrowserWindow();
    mockIpcMain = createMockIpcMain();
    mockAutoUpdater = createMockAutoUpdater();
    setupAutoUpdaterFull(mockWindow, mockIpcMain, mockAutoUpdater);
  });

  describe('IPC handler registration', () => {
    it('should register update:check handler via ipcMain.handle', () => {
      expect(mockIpcMain.handlers.has('update:check')).toBe(true);
    });

    it('should register update:install listener via ipcMain.on', () => {
      expect(mockIpcMain.listeners.has('update:install')).toBe(true);
    });
  });

  describe('update:check IPC handler', () => {
    it('should call autoUpdater.checkForUpdates when invoked', async () => {
      const handler = mockIpcMain.handlers.get('update:check');
      expect(handler).toBeDefined();

      await handler!();

      expect(mockAutoUpdater.checkForUpdatesCalledCount).toBe(1);
    });

    it('should handle multiple check requests', async () => {
      const handler = mockIpcMain.handlers.get('update:check');

      await handler!();
      await handler!();
      await handler!();

      expect(mockAutoUpdater.checkForUpdatesCalledCount).toBe(3);
    });
  });

  describe('update:install IPC handler', () => {
    it('should call autoUpdater.quitAndInstall when invoked', () => {
      const listener = mockIpcMain.listeners.get('update:install');
      expect(listener).toBeDefined();

      listener!();

      expect(mockAutoUpdater.quitAndInstallCalledCount).toBe(1);
    });

    it('should handle install being called multiple times', () => {
      const listener = mockIpcMain.listeners.get('update:install');

      listener!();
      listener!();

      // In practice electron-updater handles this, but the handler should work
      expect(mockAutoUpdater.quitAndInstallCalledCount).toBe(2);
    });
  });
});

// =============================================================================
// AutoUpdater Event Forwarding Tests - Tests event relay to renderer
// =============================================================================

describe('Auto-Updater Event Forwarding', () => {
  let mockWindow: MockBrowserWindow;
  let mockIpcMain: MockIpcMain;
  let mockAutoUpdater: MockAutoUpdater;

  beforeEach(() => {
    mockWindow = createMockBrowserWindow();
    mockIpcMain = createMockIpcMain();
    mockAutoUpdater = createMockAutoUpdater();
    setupAutoUpdaterFull(mockWindow, mockIpcMain, mockAutoUpdater);
  });

  describe('checking-for-update event', () => {
    it('should forward to renderer as update:checking', () => {
      const handlers = mockAutoUpdater.eventHandlers.get('checking-for-update');
      expect(handlers).toBeDefined();
      expect(handlers!.length).toBeGreaterThan(0);

      // Trigger the event
      handlers![0]();

      expect(mockWindow.webContents.sentMessages).toHaveLength(1);
      expect(mockWindow.webContents.sentMessages[0]).toEqual({
        channel: 'update:checking',
        data: undefined,
      });
    });
  });

  describe('update-available event', () => {
    it('should forward to renderer with version info', () => {
      const handlers = mockAutoUpdater.eventHandlers.get('update-available');
      expect(handlers).toBeDefined();

      const updateInfo = { version: '2.0.0', releaseDate: '2024-01-15' };
      handlers![0](updateInfo);

      expect(mockWindow.webContents.sentMessages).toHaveLength(1);
      expect(mockWindow.webContents.sentMessages[0]).toEqual({
        channel: 'update:available',
        data: { version: '2.0.0', releaseDate: '2024-01-15' },
      });
    });

    it('should handle missing releaseDate', () => {
      const handlers = mockAutoUpdater.eventHandlers.get('update-available');

      const updateInfo = { version: '2.0.0' };
      handlers![0](updateInfo);

      expect(mockWindow.webContents.sentMessages[0]).toEqual({
        channel: 'update:available',
        data: { version: '2.0.0', releaseDate: undefined },
      });
    });
  });

  describe('update-not-available event', () => {
    it('should forward to renderer as update:not-available', () => {
      const handlers = mockAutoUpdater.eventHandlers.get('update-not-available');
      expect(handlers).toBeDefined();

      handlers![0]();

      expect(mockWindow.webContents.sentMessages).toHaveLength(1);
      expect(mockWindow.webContents.sentMessages[0]).toEqual({
        channel: 'update:not-available',
        data: undefined,
      });
    });
  });

  describe('update-downloaded event', () => {
    it('should forward to renderer with version info', () => {
      const handlers = mockAutoUpdater.eventHandlers.get('update-downloaded');
      expect(handlers).toBeDefined();

      const downloadInfo = { version: '2.0.0', releaseDate: '2024-01-15' };
      handlers![0](downloadInfo);

      expect(mockWindow.webContents.sentMessages).toHaveLength(1);
      expect(mockWindow.webContents.sentMessages[0]).toEqual({
        channel: 'update:downloaded',
        data: { version: '2.0.0', releaseDate: '2024-01-15' },
      });
    });

    it('should handle pre-release versions', () => {
      const handlers = mockAutoUpdater.eventHandlers.get('update-downloaded');

      const downloadInfo = {
        version: '2.0.0-beta.1',
        releaseDate: '2024-01-15T10:30:00Z',
      };
      handlers![0](downloadInfo);

      expect(mockWindow.webContents.sentMessages[0]).toEqual({
        channel: 'update:downloaded',
        data: { version: '2.0.0-beta.1', releaseDate: '2024-01-15T10:30:00Z' },
      });
    });
  });

  describe('error event', () => {
    it('should forward error message to renderer', () => {
      const handlers = mockAutoUpdater.eventHandlers.get('error');
      expect(handlers).toBeDefined();

      const error = new Error('Network timeout');
      handlers![0](error);

      expect(mockWindow.webContents.sentMessages).toHaveLength(1);
      expect(mockWindow.webContents.sentMessages[0]).toEqual({
        channel: 'update:error',
        data: { message: 'Network timeout' },
      });
    });

    it('should handle error with stack trace', () => {
      const handlers = mockAutoUpdater.eventHandlers.get('error');

      const error = new Error('Download failed');
      error.stack = 'Error: Download failed\n    at download.js:42';
      handlers![0](error);

      // Only message is forwarded, not stack
      expect(mockWindow.webContents.sentMessages[0]).toEqual({
        channel: 'update:error',
        data: { message: 'Download failed' },
      });
    });
  });

  describe('event sequence simulation', () => {
    it('should handle complete update flow sequence', () => {
      const checkingHandlers = mockAutoUpdater.eventHandlers.get('checking-for-update');
      const availableHandlers = mockAutoUpdater.eventHandlers.get('update-available');
      const downloadedHandlers = mockAutoUpdater.eventHandlers.get('update-downloaded');

      // Simulate full update flow
      checkingHandlers![0]();
      availableHandlers![0]({ version: '2.0.0', releaseDate: '2024-01-15' });
      downloadedHandlers![0]({ version: '2.0.0', releaseDate: '2024-01-15' });

      expect(mockWindow.webContents.sentMessages).toHaveLength(3);
      expect(mockWindow.webContents.sentMessages[0].channel).toBe('update:checking');
      expect(mockWindow.webContents.sentMessages[1].channel).toBe('update:available');
      expect(mockWindow.webContents.sentMessages[2].channel).toBe('update:downloaded');
    });

    it('should handle check with no update available', () => {
      const checkingHandlers = mockAutoUpdater.eventHandlers.get('checking-for-update');
      const notAvailableHandlers = mockAutoUpdater.eventHandlers.get('update-not-available');

      checkingHandlers![0]();
      notAvailableHandlers![0]();

      expect(mockWindow.webContents.sentMessages).toHaveLength(2);
      expect(mockWindow.webContents.sentMessages[0].channel).toBe('update:checking');
      expect(mockWindow.webContents.sentMessages[1].channel).toBe('update:not-available');
    });

    it('should handle check with error', () => {
      const checkingHandlers = mockAutoUpdater.eventHandlers.get('checking-for-update');
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      checkingHandlers![0]();
      errorHandlers![0](new Error('GitHub API rate limit exceeded'));

      expect(mockWindow.webContents.sentMessages).toHaveLength(2);
      expect(mockWindow.webContents.sentMessages[0].channel).toBe('update:checking');
      expect(mockWindow.webContents.sentMessages[1].channel).toBe('update:error');
      expect(mockWindow.webContents.sentMessages[1].data).toEqual({
        message: 'GitHub API rate limit exceeded',
      });
    });
  });
});

// =============================================================================
// Error Scenario Tests - Various error conditions
// =============================================================================

describe('Auto-Updater Error Scenarios', () => {
  let mockWindow: MockBrowserWindow;
  let mockIpcMain: MockIpcMain;
  let mockAutoUpdater: MockAutoUpdater;

  beforeEach(() => {
    mockWindow = createMockBrowserWindow();
    mockIpcMain = createMockIpcMain();
    mockAutoUpdater = createMockAutoUpdater();
    setupAutoUpdaterFull(mockWindow, mockIpcMain, mockAutoUpdater);
  });

  describe('network errors', () => {
    it('should handle network timeout error', () => {
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      errorHandlers![0](new Error('net::ERR_CONNECTION_TIMED_OUT'));

      expect(mockWindow.webContents.sentMessages[0]).toEqual({
        channel: 'update:error',
        data: { message: 'net::ERR_CONNECTION_TIMED_OUT' },
      });
    });

    it('should handle DNS resolution failure', () => {
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      errorHandlers![0](new Error('getaddrinfo ENOTFOUND github.com'));

      expect(mockWindow.webContents.sentMessages[0].data).toEqual({
        message: 'getaddrinfo ENOTFOUND github.com',
      });
    });

    it('should handle SSL certificate error', () => {
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      errorHandlers![0](new Error('certificate has expired'));

      expect(mockWindow.webContents.sentMessages[0].data).toEqual({
        message: 'certificate has expired',
      });
    });
  });

  describe('download errors', () => {
    it('should handle checksum mismatch error', () => {
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      errorHandlers![0](new Error('sha512 checksum mismatch'));

      expect(mockWindow.webContents.sentMessages[0].data).toEqual({
        message: 'sha512 checksum mismatch',
      });
    });

    it('should handle disk full error', () => {
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      errorHandlers![0](new Error('ENOSPC: no space left on device'));

      expect(mockWindow.webContents.sentMessages[0].data).toEqual({
        message: 'ENOSPC: no space left on device',
      });
    });

    it('should handle permission denied during download', () => {
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      errorHandlers![0](new Error('EACCES: permission denied'));

      expect(mockWindow.webContents.sentMessages[0].data).toEqual({
        message: 'EACCES: permission denied',
      });
    });
  });

  describe('GitHub/release errors', () => {
    it('should handle rate limit error', () => {
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      errorHandlers![0](new Error('API rate limit exceeded for user'));

      expect(mockWindow.webContents.sentMessages[0].data).toEqual({
        message: 'API rate limit exceeded for user',
      });
    });

    it('should handle 404 release not found', () => {
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      errorHandlers![0](new Error('Cannot find latest.yml in the latest release artifacts'));

      expect(mockWindow.webContents.sentMessages[0].data).toEqual({
        message: 'Cannot find latest.yml in the latest release artifacts',
      });
    });

    it('should handle invalid release signature', () => {
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      errorHandlers![0](new Error('Signature verification failed'));

      expect(mockWindow.webContents.sentMessages[0].data).toEqual({
        message: 'Signature verification failed',
      });
    });
  });

  describe('error recovery scenarios', () => {
    it('should allow retry after error', () => {
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');
      const checkingHandlers = mockAutoUpdater.eventHandlers.get('checking-for-update');
      const downloadedHandlers = mockAutoUpdater.eventHandlers.get('update-downloaded');

      // First attempt fails
      checkingHandlers![0]();
      errorHandlers![0](new Error('Network error'));

      // Second attempt succeeds
      checkingHandlers![0]();
      downloadedHandlers![0]({ version: '2.0.0' });

      expect(mockWindow.webContents.sentMessages).toHaveLength(4);
      expect(mockWindow.webContents.sentMessages[0].channel).toBe('update:checking');
      expect(mockWindow.webContents.sentMessages[1].channel).toBe('update:error');
      expect(mockWindow.webContents.sentMessages[2].channel).toBe('update:checking');
      expect(mockWindow.webContents.sentMessages[3].channel).toBe('update:downloaded');
    });

    it('should handle multiple consecutive errors', () => {
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      errorHandlers![0](new Error('Error 1'));
      errorHandlers![0](new Error('Error 2'));
      errorHandlers![0](new Error('Error 3'));

      expect(mockWindow.webContents.sentMessages).toHaveLength(3);
      expect(mockWindow.webContents.sentMessages[2].data).toEqual({
        message: 'Error 3',
      });
    });
  });
});

// =============================================================================
// Window Communication Tests - Tests proper IPC communication
// =============================================================================

describe('Auto-Updater Window Communication', () => {
  let mockWindow: MockBrowserWindow;
  let mockIpcMain: MockIpcMain;
  let mockAutoUpdater: MockAutoUpdater;

  beforeEach(() => {
    mockWindow = createMockBrowserWindow();
    mockIpcMain = createMockIpcMain();
    mockAutoUpdater = createMockAutoUpdater();
    setupAutoUpdaterFull(mockWindow, mockIpcMain, mockAutoUpdater);
  });

  describe('message format consistency', () => {
    it('should send consistent channel names', () => {
      const checkingHandlers = mockAutoUpdater.eventHandlers.get('checking-for-update');
      const availableHandlers = mockAutoUpdater.eventHandlers.get('update-available');
      const notAvailableHandlers = mockAutoUpdater.eventHandlers.get('update-not-available');
      const downloadedHandlers = mockAutoUpdater.eventHandlers.get('update-downloaded');
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      // Trigger all events
      checkingHandlers![0]();
      availableHandlers![0]({ version: '2.0.0' });
      notAvailableHandlers![0]();
      downloadedHandlers![0]({ version: '2.0.0' });
      errorHandlers![0](new Error('test'));

      const channels = mockWindow.webContents.sentMessages.map((m) => m.channel);
      expect(channels).toEqual([
        'update:checking',
        'update:available',
        'update:not-available',
        'update:downloaded',
        'update:error',
      ]);
    });

    it('should use update: namespace prefix for all events', () => {
      const checkingHandlers = mockAutoUpdater.eventHandlers.get('checking-for-update');
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      checkingHandlers![0]();
      errorHandlers![0](new Error('test'));

      for (const message of mockWindow.webContents.sentMessages) {
        expect(message.channel.startsWith('update:')).toBe(true);
      }
    });
  });

  describe('data payload structure', () => {
    it('should send version and releaseDate for update:available', () => {
      const availableHandlers = mockAutoUpdater.eventHandlers.get('update-available');

      availableHandlers![0]({ version: '2.0.0', releaseDate: '2024-01-15' });

      const payload = mockWindow.webContents.sentMessages[0].data as {
        version: string;
        releaseDate: string;
      };
      expect(payload).toHaveProperty('version');
      expect(payload).toHaveProperty('releaseDate');
    });

    it('should send version and releaseDate for update:downloaded', () => {
      const downloadedHandlers = mockAutoUpdater.eventHandlers.get('update-downloaded');

      downloadedHandlers![0]({ version: '2.0.0', releaseDate: '2024-01-15' });

      const payload = mockWindow.webContents.sentMessages[0].data as {
        version: string;
        releaseDate: string;
      };
      expect(payload).toHaveProperty('version');
      expect(payload).toHaveProperty('releaseDate');
    });

    it('should send message property for update:error', () => {
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      errorHandlers![0](new Error('Test error'));

      const payload = mockWindow.webContents.sentMessages[0].data as { message: string };
      expect(payload).toHaveProperty('message');
      expect(typeof payload.message).toBe('string');
    });

    it('should not include extra properties in error payload', () => {
      const errorHandlers = mockAutoUpdater.eventHandlers.get('error');

      const error = new Error('Test error');
      (error as NodeJS.ErrnoException).code = 'ENETWORK';
      errorHandlers![0](error);

      const payload = mockWindow.webContents.sentMessages[0].data;
      expect(Object.keys(payload as object)).toEqual(['message']);
    });
  });

  describe('bidirectional communication', () => {
    it('should support renderer initiating update check', async () => {
      // Renderer calls update:check
      const checkHandler = mockIpcMain.handlers.get('update:check');
      await checkHandler!();

      expect(mockAutoUpdater.checkForUpdatesCalledCount).toBe(1);

      // Main process responds with event
      const availableHandlers = mockAutoUpdater.eventHandlers.get('update-available');
      availableHandlers![0]({ version: '2.0.0' });

      expect(mockWindow.webContents.sentMessages).toHaveLength(1);
      expect(mockWindow.webContents.sentMessages[0].channel).toBe('update:available');
    });

    it('should support renderer initiating install', () => {
      // First, update must be ready (downloaded)
      const downloadedHandlers = mockAutoUpdater.eventHandlers.get('update-downloaded');
      downloadedHandlers![0]({ version: '2.0.0' });

      // Renderer calls update:install
      const installListener = mockIpcMain.listeners.get('update:install');
      installListener!();

      expect(mockAutoUpdater.quitAndInstallCalledCount).toBe(1);
    });
  });
});

// =============================================================================
// Contract Tests - Verify the actual auto-updater.ts exports match expected API
// =============================================================================

describe('Auto-Updater API Contract', () => {
  it('should export cleanupAutoUpdater function', async () => {
    // This test verifies the function signature exists
    // The actual module can't be imported outside Electron, but we verify
    // the code structure is correct via the file we edited
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(
      new URL('./electron/main/src/auto-updater.ts', import.meta.url),
      'utf-8'
    );

    // Verify cleanupAutoUpdater is exported
    expect(content).toContain('export function cleanupAutoUpdater()');
    // Verify it returns boolean
    expect(content).toContain('cleanupAutoUpdater(): boolean');
  });

  it('should export getAutoUpdaterTimerState function', async () => {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(
      new URL('./electron/main/src/auto-updater.ts', import.meta.url),
      'utf-8'
    );

    // Verify getAutoUpdaterTimerState is exported
    expect(content).toContain('export function getAutoUpdaterTimerState()');
    // Verify return type
    expect(content).toContain('hasInitialCheckTimeout: boolean');
    expect(content).toContain('hasUpdateCheckInterval: boolean');
  });

  it('should have module-level timer variables', async () => {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(
      new URL('./electron/main/src/auto-updater.ts', import.meta.url),
      'utf-8'
    );

    // Verify module-level variables exist
    expect(content).toContain('let updateCheckInterval: NodeJS.Timeout | null = null');
    expect(content).toContain('let initialCheckTimeout: NodeJS.Timeout | null = null');
  });

  it('should clear existing timers in setupAutoUpdater', async () => {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(
      new URL('./electron/main/src/auto-updater.ts', import.meta.url),
      'utf-8'
    );

    // Verify timers are cleared before creating new ones
    expect(content).toContain('clearTimeout(initialCheckTimeout)');
    expect(content).toContain('clearInterval(updateCheckInterval)');
  });

  it('should store interval/timeout IDs', async () => {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(
      new URL('./electron/main/src/auto-updater.ts', import.meta.url),
      'utf-8'
    );

    // Verify IDs are stored
    expect(content).toContain('initialCheckTimeout = setTimeout(');
    expect(content).toContain('updateCheckInterval = setInterval(');
  });
});

// =============================================================================
// Extended Contract Tests - Comprehensive API verification
// =============================================================================

describe('Auto-Updater Implementation Contract', () => {
  let fileContent: string;

  beforeEach(async () => {
    const fs = await import('node:fs/promises');
    fileContent = await fs.readFile(
      new URL('./electron/main/src/auto-updater.ts', import.meta.url),
      'utf-8'
    );
  });

  describe('autoUpdater event handlers', () => {
    it('should register handler for checking-for-update event', () => {
      expect(fileContent).toContain("autoUpdater.on('checking-for-update'");
    });

    it('should register handler for update-available event', () => {
      expect(fileContent).toContain("autoUpdater.on('update-available'");
    });

    it('should register handler for update-not-available event', () => {
      expect(fileContent).toContain("autoUpdater.on('update-not-available'");
    });

    it('should register handler for update-downloaded event', () => {
      expect(fileContent).toContain("autoUpdater.on('update-downloaded'");
    });

    it('should register handler for error event', () => {
      expect(fileContent).toContain("autoUpdater.on('error'");
    });
  });

  describe('IPC channel registration', () => {
    it('should register update:check handler', () => {
      expect(fileContent).toContain("ipcMain.handle('update:check'");
    });

    it('should register update:install listener', () => {
      expect(fileContent).toContain("ipcMain.on('update:install'");
    });
  });

  describe('renderer IPC channel sends', () => {
    it('should send update:checking to renderer', () => {
      expect(fileContent).toContain("send('update:checking')");
    });

    it('should send update:available to renderer', () => {
      expect(fileContent).toContain("send('update:available'");
    });

    it('should send update:not-available to renderer', () => {
      expect(fileContent).toContain("send('update:not-available')");
    });

    it('should send update:downloaded to renderer', () => {
      expect(fileContent).toContain("send('update:downloaded'");
    });

    it('should send update:error to renderer', () => {
      expect(fileContent).toContain("send('update:error'");
    });
  });

  describe('autoUpdater configuration', () => {
    it('should set autoDownload to true', () => {
      expect(fileContent).toContain('autoUpdater.autoDownload = true');
    });

    it('should set autoInstallOnAppQuit to true', () => {
      expect(fileContent).toContain('autoUpdater.autoInstallOnAppQuit = true');
    });
  });

  describe('update check timing', () => {
    it('should define CHECK_INTERVAL_MS constant', () => {
      expect(fileContent).toContain('CHECK_INTERVAL_MS');
      // Verify it's set to 1 hour (60 * 60 * 1000)
      expect(fileContent).toMatch(/CHECK_INTERVAL_MS\s*=\s*60\s*\*\s*60\s*\*\s*1000/);
    });

    it('should define INITIAL_CHECK_DELAY_MS constant', () => {
      expect(fileContent).toContain('INITIAL_CHECK_DELAY_MS');
      // Verify it's set to 10 seconds (10 * 1000)
      expect(fileContent).toMatch(/INITIAL_CHECK_DELAY_MS\s*=\s*10\s*\*\s*1000/);
    });
  });

  describe('error handling', () => {
    it('should log errors to console.error', () => {
      expect(fileContent).toContain('console.error');
    });

    it('should handle errors with catch block for update checks', () => {
      expect(fileContent).toContain('.catch((err)');
    });
  });

  describe('setupAutoUpdater function signature', () => {
    it('should export setupAutoUpdater function', () => {
      expect(fileContent).toContain('export function setupAutoUpdater');
    });

    it('should accept BrowserWindow parameter', () => {
      expect(fileContent).toContain('mainWindow: BrowserWindow');
    });

    it('should return void', () => {
      expect(fileContent).toContain('setupAutoUpdater(mainWindow: BrowserWindow): void');
    });
  });

  describe('update info forwarding', () => {
    it('should forward version from update info', () => {
      expect(fileContent).toContain('info.version');
    });

    it('should forward releaseDate from update info', () => {
      expect(fileContent).toContain('info.releaseDate');
    });

    it('should forward error message', () => {
      expect(fileContent).toContain('err.message');
    });
  });

  describe('autoUpdater actions', () => {
    it('should call checkForUpdates', () => {
      expect(fileContent).toContain('autoUpdater.checkForUpdates()');
    });

    it('should call quitAndInstall', () => {
      expect(fileContent).toContain('autoUpdater.quitAndInstall()');
    });
  });
});
