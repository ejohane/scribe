import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain, app } from 'electron';
import { createLogger, getErrorMessage } from '@scribe/shared';

const log = createLogger({ prefix: 'auto-updater' });

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const INITIAL_CHECK_DELAY_MS = 10 * 1000; // 10 seconds

// Module-level state for cleanup (fixes memory leak when setupAutoUpdater called multiple times)
let updateCheckInterval: NodeJS.Timeout | null = null;
let initialCheckTimeout: NodeJS.Timeout | null = null;

// Configure auto-updater behavior
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

/**
 * Setup auto-updater with event forwarding to renderer.
 *
 * This function:
 * - Configures electron-updater event handlers to forward events to the renderer via IPC
 * - Sets up IPC handlers for manual update checks and install requests
 * - Schedules an initial update check after a delay (to avoid blocking startup)
 * - Establishes periodic update checks every hour
 *
 * @param mainWindow - The main BrowserWindow to send update events to
 */
export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  // Event handlers - forward to renderer
  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('update:checking');
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update:available', {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update:not-available');
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update:downloaded', {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error', {
      error: getErrorMessage(err),
      currentVersion: app.getVersion(),
    });
    mainWindow.webContents.send('update:error', {
      message: err.message,
    });
  });

  // IPC handlers for renderer-initiated actions
  ipcMain.handle('update:check', async () => {
    await autoUpdater.checkForUpdates();
  });

  ipcMain.on('update:install', () => {
    autoUpdater.quitAndInstall();
  });

  // Clear any existing timers to prevent accumulation on repeated calls
  if (initialCheckTimeout !== null) {
    clearTimeout(initialCheckTimeout);
    initialCheckTimeout = null;
  }
  if (updateCheckInterval !== null) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }

  // Initial check (delayed to not block startup)
  initialCheckTimeout = setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Initial update check failed', { error: getErrorMessage(err) });
    });
  }, INITIAL_CHECK_DELAY_MS);

  // Periodic checks
  updateCheckInterval = setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Periodic update check failed', { error: getErrorMessage(err) });
    });
  }, CHECK_INTERVAL_MS);
}

/**
 * Cleanup auto-updater timers.
 *
 * Call this function when the auto-updater is no longer needed (e.g., during app shutdown
 * or in tests) to clear any pending timers and prevent memory leaks.
 *
 * @returns true if any timers were cleared, false if no timers were active
 */
export function cleanupAutoUpdater(): boolean {
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
 * Get the current state of auto-updater timers.
 * Exported for testing purposes only.
 *
 * @returns Object indicating whether each timer is currently active
 */
export function getAutoUpdaterTimerState(): {
  hasInitialCheckTimeout: boolean;
  hasUpdateCheckInterval: boolean;
} {
  return {
    hasInitialCheckTimeout: initialCheckTimeout !== null,
    hasUpdateCheckInterval: updateCheckInterval !== null,
  };
}

/**
 * Setup stub update handlers for development mode.
 *
 * In development, auto-updates don't work because there's no packaged app.
 * This function registers the IPC handlers so the UI doesn't error, but
 * immediately sends an "update:not-available" message to indicate no updates.
 *
 * @param mainWindow - The main BrowserWindow to send update events to
 */
export function setupDevUpdateHandlers(mainWindow: BrowserWindow): void {
  // IPC handlers that simulate the update flow
  ipcMain.handle('update:check', async () => {
    // Simulate the checking -> not-available flow
    mainWindow.webContents.send('update:checking');
    // Small delay to show the "Checking..." state
    setTimeout(() => {
      mainWindow.webContents.send('update:not-available');
    }, 500);
  });

  ipcMain.on('update:install', () => {
    // No-op in dev mode - there's nothing to install
    log.info('update:install called in dev mode - no action taken');
  });
}
