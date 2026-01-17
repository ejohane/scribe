import { app } from 'electron';
import path from 'path';
import { createVaultPath, IPC_CHANNELS } from '@scribe/shared';
import { WindowManager } from './window-manager';
import { initializeVault } from '@scribe/storage-fs';
import { setupAutoUpdater, setupDevUpdateHandlers } from './auto-updater';
import {
  setupAppHandlers,
  setupDialogHandlers,
  setupVaultHandlers,
  setupAssetHandlers,
  registerAssetProtocol,
  setupWindowHandlers,
  parseDeepLink,
  extractDeepLinkFromArgv,
  registerProtocolHandler,
  getVaultPath,
  type HandlerDependencies,
} from './handlers';
import { mainLogger } from './logger';
import { setupApplicationMenu } from './menu';
import {
  startEmbeddedDaemon,
  stopEmbeddedDaemon,
  showErrorAndQuit,
  type EmbeddedDaemonInfo,
} from './embedded-daemon';

// __filename and __dirname are provided by the build script banner

const isDev = process.env.NODE_ENV === 'development';

// ============================================================================
// Single Instance Lock & Deep Link Handling
// ============================================================================

/**
 * Pending deep link URL to be processed after app is ready.
 * This is used when the app is launched via a deep link URL.
 */
let pendingDeepLinkUrl: string | null = null;

/**
 * Request single instance lock to prevent multiple app instances.
 * This is required for proper deep link handling on Windows/Linux.
 *
 * When another instance is launched with a deep link URL, the existing
 * instance receives the URL via the 'second-instance' event.
 */
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running - quit this one
  mainLogger.info('Another instance is already running, quitting...');
  app.quit();
} else {
  // Handle second-instance event (Windows/Linux deep links)
  app.on('second-instance', (_event, argv, _workingDirectory) => {
    mainLogger.debug('Second instance detected', { argv });

    // Extract deep link URL from command line args
    const deepLinkUrl = extractDeepLinkFromArgv(argv);
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    } else {
      // No deep link - focus existing window or create new
      focusOrCreateWindow();
    }
  });
}

/**
 * Focus an existing window or create a new one if none exist.
 * Used when a second instance is launched without a deep link.
 */
function focusOrCreateWindow(): void {
  if (!deps.windowManager) return;

  // Try to find and focus an existing window
  const windows = deps.windowManager.getAllWindows();

  if (windows.length > 0) {
    // Focus the most recently focused window, or first available
    const focused = deps.windowManager.getFocusedWindow();
    const target = focused ?? windows[0];

    if (target.isMinimized()) {
      target.restore();
    }
    target.show();
    target.focus();
  } else {
    // No windows exist - create one
    deps.windowManager.createWindow();
  }
}

/**
 * Handle macOS open-url event.
 * This fires when the app is opened via a scribe:// URL.
 *
 * Note: On macOS, this can fire before app is ready if launched via URL.
 * In that case, we store the URL and process it after ready.
 */
app.on('open-url', (event, url) => {
  event.preventDefault();
  mainLogger.debug('Received open-url event', { url });

  if (app.isReady()) {
    handleDeepLink(url);
  } else {
    // App not ready yet - store for later processing
    pendingDeepLinkUrl = url;
  }
});

/**
 * Focus a window by restoring it if minimized and bringing it to front.
 *
 * @param win - The BrowserWindow to focus
 */
function focusWindow(win: import('electron').BrowserWindow): void {
  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.focus();
}

/**
 * Process a deep link URL and send it to the appropriate window.
 *
 * Smart routing logic:
 * 1. If the deep link is for a specific note that's already open in a window,
 *    focus that window and send the deep link to it only.
 * 2. Otherwise, send to the focused window or the first available window.
 * 3. If no windows exist, store the URL for later processing.
 *
 * @param url - The scribe:// URL to process
 */
function handleDeepLink(url: string): void {
  mainLogger.info('Processing deep link', { url });

  const result = parseDeepLink(url);
  if (!result.valid) {
    mainLogger.warn('Invalid deep link URL', { url, action: result.action });
    return;
  }

  // Check if we have any windows to route to
  if (!deps.windowManager || deps.windowManager.getWindowCount() === 0) {
    // No windows yet - store for later processing
    pendingDeepLinkUrl = url;
    mainLogger.debug('No windows available, storing deep link for later', { url });
    return;
  }

  // Extract note ID if this is a note-specific deep link
  const noteId = result.action.type === 'note' ? result.action.noteId : null;

  if (noteId) {
    // Check if the note is already open in a window
    const existingWindow = deps.windowManager.findWindowWithNote(noteId);

    if (existingWindow) {
      // Focus the existing window and send the deep link to it
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
  const focusedWindow = deps.windowManager.getFocusedWindow();
  const allWindows = deps.windowManager.getAllWindows();
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
      deps.windowManager.createWindow({ noteId });
      mainLogger.debug('Created new window for deep link', { noteId });
    } else {
      // For non-note deep links (daily, search), create window and queue the action
      const newWindow = deps.windowManager.createWindow();
      // Wait for window to be ready before sending the action
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
function processPendingDeepLink(): void {
  if (pendingDeepLinkUrl) {
    mainLogger.debug('Processing pending deep link', { url: pendingDeepLinkUrl });
    handleDeepLink(pendingDeepLinkUrl);
    pendingDeepLinkUrl = null;
  }
}

// Shared dependencies for all IPC handlers
// Note: vault, graphEngine, and searchEngine have been removed as their
// functionality is now provided by the daemon via tRPC.
const deps: HandlerDependencies = {
  windowManager: null,
  daemonPort: undefined,
};

// Reference to the embedded daemon for lifecycle management
let embeddedDaemon: EmbeddedDaemonInfo | null = null;

/**
 * Initialize the vault directory structure.
 *
 * Note: This is a thin initialization that only ensures the vault directory exists.
 * All note loading, graph building, and search indexing is now handled by the daemon.
 *
 * @returns The initialized vault path (VaultPath branded type)
 */
async function initializeVaultDirectory(): Promise<import('@scribe/shared').VaultPath> {
  try {
    // Load configured vault path (or default)
    const configuredPath = await getVaultPath();
    mainLogger.info(`Using vault path from config: ${configuredPath}`);

    // Initialize vault directory structure (creates if needed)
    const vaultPath = await initializeVault(createVaultPath(configuredPath));
    mainLogger.info(`Vault initialized at: ${vaultPath}`);

    return vaultPath;
  } catch (error) {
    mainLogger.error('Failed to initialize vault directory', { error });
    throw error;
  }
}

/**
 * Setup all IPC handlers by delegating to domain-specific handler modules.
 *
 * Note: Notes, search, graph, and export functionality is now provided by
 * the daemon via tRPC. Only electron-specific handlers remain here.
 */
function setupIPCHandlers() {
  // Register all handler modules
  setupAppHandlers(deps);
  setupDialogHandlers();
  setupVaultHandlers(deps);
  setupWindowHandlers(deps);
}

/**
 * Create and configure a new application window.
 *
 * Delegates to WindowManager which handles:
 * - BrowserWindow creation with security-hardened settings
 * - Renderer loading (dev server or bundled files)
 * - Context menu setup for spell-check and editing operations
 *
 * @param noteId - Optional note ID to open in the new window
 * @returns The created BrowserWindow instance
 * @throws Error if WindowManager is not initialized
 */
function createWindow(noteId?: string) {
  if (!deps.windowManager) {
    throw new Error('WindowManager not initialized');
  }
  return deps.windowManager.createWindow({ noteId });
}

app.whenReady().then(async () => {
  // Register as default protocol handler for scribe:// URLs
  registerProtocolHandler();

  // Initialize vault directory structure before setting up IPC handlers
  const vaultPath = await initializeVaultDirectory();

  // Start embedded daemon before creating windows
  // This ensures all API endpoints are available when the renderer loads
  try {
    embeddedDaemon = await startEmbeddedDaemon({
      vaultPath,
      // Port 0 = auto-assign (default in startEmbeddedDaemon)
    });
    deps.daemonPort = embeddedDaemon.port;
    mainLogger.info('Embedded daemon ready', { port: deps.daemonPort });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    mainLogger.error('Failed to start embedded daemon', { error });
    await showErrorAndQuit(
      'Failed to Start Scribe',
      `Could not start the Scribe daemon: ${message}`
    );
    return; // showErrorAndQuit doesn't return, but TypeScript doesn't know that
  }

  // Register custom protocol for serving asset files securely
  registerAssetProtocol(vaultPath);

  setupIPCHandlers();
  setupAssetHandlers(vaultPath);

  // Initialize WindowManager before creating the first window
  deps.windowManager = new WindowManager({
    isDev,
    preloadPath: path.join(__dirname, '../../preload/dist/preload.js'),
    rendererPath: path.join(__dirname, '../../../renderer/dist/index.html'),
    devServerUrl: 'http://localhost:5173',
  });

  // Setup application menu with File > New Window
  setupApplicationMenu(deps.windowManager);

  createWindow();

  // Process any deep link that was received before the window was ready
  // Slight delay to ensure window is fully loaded
  setTimeout(() => {
    processPendingDeepLink();
  }, 500);

  // Setup update handlers - production uses real auto-updater, dev uses stubs
  if (deps.windowManager) {
    if (isDev) {
      setupDevUpdateHandlers(deps.windowManager);
    } else {
      setupAutoUpdater(deps.windowManager);
    }
  }

  // On macOS, set the dock icon explicitly (needed for dev mode, production uses bundled icon)
  if (process.platform === 'darwin' && app.dock) {
    // app.getAppPath() returns the apps/desktop directory (where package.json with "main" is)
    // Note: dock.setIcon() requires PNG format, not .icns
    const appPath = app.getAppPath();
    const iconPath = path.join(appPath, 'build', 'icon.png');
    try {
      app.dock.setIcon(iconPath);
    } catch (err) {
      mainLogger.error('Failed to set dock icon', { error: err });
    }
    app.dock.show();
    app.focus({ steal: true });
  }

  app.on('activate', () => {
    if (deps.windowManager?.getWindowCount() === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup hook before quitting
// Track if we're in the middle of shutdown to prevent re-entry
let isShuttingDown = false;

app.on('before-quit', async (event) => {
  // If we're already shutting down, let the quit proceed
  if (isShuttingDown) {
    return;
  }

  // If there's no daemon to shut down, let the quit proceed
  if (!embeddedDaemon) {
    mainLogger.debug('Application quitting (no daemon to stop)');
    return;
  }

  // Prevent the quit and shut down the daemon first
  event.preventDefault();
  isShuttingDown = true;

  mainLogger.info('Application quitting, stopping embedded daemon...');

  try {
    await stopEmbeddedDaemon(embeddedDaemon);
    embeddedDaemon = null;
    mainLogger.info('Daemon stopped, proceeding with quit');
  } catch (error) {
    mainLogger.error('Error stopping daemon during quit', { error });
    // Continue with quit even if daemon stop fails
  }

  // Now actually quit
  app.quit();
});
