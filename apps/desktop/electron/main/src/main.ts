/**
 * Electron Main Process Entry Point
 *
 * This is the simplified architecture for the Scribe desktop app.
 * The embedded daemon handles all note/search/graph/export functionality via tRPC.
 * The main process only handles Electron-specific concerns:
 * - Window management
 * - Deep link routing
 * - Asset protocol
 * - Native dialogs
 * - Auto-updates
 *
 * @module electron/main
 */

import { app } from 'electron';
import path from 'path';
import { createVaultPath } from '@scribe/shared';
import { initializeVault } from '@scribe/storage-fs';
import { WindowManager } from './window-manager';
import { setupAutoUpdater, setupDevUpdateHandlers } from './auto-updater';
import {
  setupAppHandlers,
  setupDialogHandlers,
  setupVaultHandlers,
  setupAssetHandlers,
  registerAssetProtocol,
  setupWindowHandlers,
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
import { setupSingleInstance, setWindowManager, processPendingDeepLink } from './deep-link-router';

const isDev = process.env.NODE_ENV === 'development';

// ============================================================================
// Single Instance Lock
// ============================================================================

if (!setupSingleInstance()) {
  app.quit();
}

// ============================================================================
// Application State
// ============================================================================

const deps: HandlerDependencies = {
  windowManager: null,
  daemonPort: undefined,
};

let embeddedDaemon: EmbeddedDaemonInfo | null = null;
let isShuttingDown = false;

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(async () => {
  registerProtocolHandler();

  // Initialize vault directory
  const configuredPath = await getVaultPath();
  mainLogger.info(`Using vault path: ${configuredPath}`);
  const vaultPath = await initializeVault(createVaultPath(configuredPath));

  // Start embedded daemon
  try {
    embeddedDaemon = await startEmbeddedDaemon({ vaultPath });
    deps.daemonPort = embeddedDaemon.port;
    mainLogger.info('Embedded daemon ready', { port: deps.daemonPort });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    mainLogger.error('Failed to start embedded daemon', { error });
    await showErrorAndQuit(
      'Failed to Start Scribe',
      `Could not start the Scribe daemon: ${message}`
    );
    return;
  }

  // Register asset protocol and IPC handlers
  registerAssetProtocol(vaultPath);
  setupAppHandlers(deps);
  setupDialogHandlers();
  setupVaultHandlers(deps);
  setupWindowHandlers(deps);
  setupAssetHandlers(vaultPath);

  // Initialize window manager
  deps.windowManager = new WindowManager({
    isDev,
    preloadPath: path.join(__dirname, '../../preload/dist/preload.js'),
    rendererPath: path.join(__dirname, '../../../renderer/dist/index.html'),
    devServerUrl: 'http://localhost:5173',
  });
  setWindowManager(deps.windowManager);

  // Setup menu and create first window
  setupApplicationMenu(deps.windowManager);
  deps.windowManager.createWindow();

  // Process any pending deep link
  setTimeout(() => processPendingDeepLink(), 500);

  // Setup auto-updater
  if (isDev) {
    setupDevUpdateHandlers(deps.windowManager);
  } else {
    setupAutoUpdater(deps.windowManager);
  }

  // macOS dock icon (dev mode needs explicit icon)
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(app.getAppPath(), 'build', 'icon.png');
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
      deps.windowManager.createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  if (isShuttingDown || !embeddedDaemon) {
    return;
  }

  event.preventDefault();
  isShuttingDown = true;
  mainLogger.info('Application quitting, stopping embedded daemon...');

  try {
    await stopEmbeddedDaemon(embeddedDaemon);
    embeddedDaemon = null;
    mainLogger.info('Daemon stopped, proceeding with quit');
  } catch (error) {
    mainLogger.error('Error stopping daemon during quit', { error });
  }

  app.quit();
});
