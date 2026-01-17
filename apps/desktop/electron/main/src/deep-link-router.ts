/**
 * Deep Link Router - Single-instance and deep link routing for Electron.
 *
 * This module handles:
 * - Single instance lock (prevents multiple app instances)
 * - Deep link routing to appropriate windows
 * - Pending deep link storage for pre-ready URLs
 *
 * Extracted from main.ts to reduce its size and improve modularity.
 *
 * @module electron/main/deep-link-router
 */

import { app, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@scribe/shared';
import type { WindowManager } from './window-manager';
import { parseDeepLink, extractDeepLinkFromArgv } from './handlers';
import { mainLogger } from './logger';

/**
 * Pending deep link URL to be processed after app is ready.
 * This is used when the app is launched via a deep link URL.
 */
let pendingDeepLinkUrl: string | null = null;

/**
 * Reference to the window manager for routing deep links.
 */
let windowManagerRef: WindowManager | null = null;

/**
 * Set the window manager reference for deep link routing.
 * Must be called after WindowManager is initialized.
 */
export function setWindowManager(wm: WindowManager): void {
  windowManagerRef = wm;
}

/**
 * Get pending deep link URL if one exists.
 */
export function getPendingDeepLink(): string | null {
  return pendingDeepLinkUrl;
}

/**
 * Clear the pending deep link URL.
 */
export function clearPendingDeepLink(): void {
  pendingDeepLinkUrl = null;
}

/**
 * Focus a window by restoring it if minimized and bringing it to front.
 */
function focusWindow(win: BrowserWindow): void {
  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.focus();
}

/**
 * Focus an existing window or create a new one if none exist.
 * Used when a second instance is launched without a deep link.
 */
function focusOrCreateWindow(): void {
  if (!windowManagerRef) return;

  const windows = windowManagerRef.getAllWindows();

  if (windows.length > 0) {
    const focused = windowManagerRef.getFocusedWindow();
    const target = focused ?? windows[0];

    if (target.isMinimized()) {
      target.restore();
    }
    target.show();
    target.focus();
  } else {
    windowManagerRef.createWindow();
  }
}

/**
 * Process a deep link URL and send it to the appropriate window.
 *
 * Smart routing logic:
 * 1. If the deep link is for a specific note that's already open in a window,
 *    focus that window and send the deep link to it only.
 * 2. Otherwise, send to the focused window or the first available window.
 * 3. If no windows exist, store the URL for later processing.
 */
export function handleDeepLink(url: string): void {
  mainLogger.info('Processing deep link', { url });

  const result = parseDeepLink(url);
  if (!result.valid) {
    mainLogger.warn('Invalid deep link URL', { url, action: result.action });
    return;
  }

  // Check if we have any windows to route to
  if (!windowManagerRef || windowManagerRef.getWindowCount() === 0) {
    pendingDeepLinkUrl = url;
    mainLogger.debug('No windows available, storing deep link for later', { url });
    return;
  }

  // Extract note ID if this is a note-specific deep link
  const noteId = result.action.type === 'note' ? result.action.noteId : null;

  if (noteId) {
    // Check if the note is already open in a window
    const existingWindow = windowManagerRef.findWindowWithNote(noteId);

    if (existingWindow) {
      focusWindow(existingWindow);
      existingWindow.webContents.send(IPC_CHANNELS.DEEP_LINK_RECEIVED, result.action);
      mainLogger.debug('Routed deep link to existing window with note', {
        action: result.action,
        windowId: existingWindow.id,
      });
      return;
    }
  }

  // Note not open anywhere (or not a note link) - send to focused or first available window
  const focusedWindow = windowManagerRef.getFocusedWindow();
  const allWindows = windowManagerRef.getAllWindows();
  const targetWindow = focusedWindow || allWindows[0];

  if (targetWindow && !targetWindow.isDestroyed()) {
    focusWindow(targetWindow);
    targetWindow.webContents.send(IPC_CHANNELS.DEEP_LINK_RECEIVED, result.action);
    mainLogger.debug('Routed deep link to target window', {
      action: result.action,
      windowId: targetWindow.id,
      wasFocused: targetWindow === focusedWindow,
    });
  } else {
    // No valid windows - create one with the note if applicable
    if (noteId) {
      windowManagerRef.createWindow({ noteId });
      mainLogger.debug('Created new window for deep link', { noteId });
    } else {
      // For non-note deep links (daily, search), create window and queue the action
      const newWindow = windowManagerRef.createWindow();
      newWindow.webContents.once('did-finish-load', () => {
        newWindow.webContents.send(IPC_CHANNELS.DEEP_LINK_RECEIVED, result.action);
      });
      mainLogger.debug('Created new window for deep link action', { action: result.action });
    }
  }
}

/**
 * Process any pending deep link that was received before the window was ready.
 */
export function processPendingDeepLink(): void {
  if (pendingDeepLinkUrl) {
    mainLogger.debug('Processing pending deep link', { url: pendingDeepLinkUrl });
    handleDeepLink(pendingDeepLinkUrl);
    pendingDeepLinkUrl = null;
  }
}

/**
 * Request single instance lock and setup deep link event handlers.
 *
 * This should be called early in app startup (before app.whenReady()).
 * Returns false if another instance is already running.
 */
export function setupSingleInstance(): boolean {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    mainLogger.info('Another instance is already running, quitting...');
    return false;
  }

  // Handle second-instance event (Windows/Linux deep links)
  app.on('second-instance', (_event, argv, _workingDirectory) => {
    mainLogger.debug('Second instance detected', { argv });

    const deepLinkUrl = extractDeepLinkFromArgv(argv);
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    } else {
      focusOrCreateWindow();
    }
  });

  // Handle macOS open-url event
  app.on('open-url', (event, url) => {
    event.preventDefault();
    mainLogger.debug('Received open-url event', { url });

    if (app.isReady()) {
      handleDeepLink(url);
    } else {
      pendingDeepLinkUrl = url;
    }
  });

  return true;
}
