import { app } from 'electron';
import path from 'path';
import { createVaultPath, createNoteId, IPC_CHANNELS } from '@scribe/shared';
import { WindowManager } from './window-manager';
import { FileSystemVault, initializeVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import { TaskIndex } from '@scribe/engine-core/node';
import { loadSyncConfig, createSyncEngine } from '@scribe/engine-sync';
import { createCredentialManager } from './sync/credential-manager.js';
import { RecentOpensDatabase } from './database/recentOpensDb';
import { setupAutoUpdater, setupDevUpdateHandlers } from './auto-updater';
import {
  setupNotesHandlers,
  setupSearchHandlers,
  setupGraphHandlers,
  setupPeopleHandlers,
  setupAppHandlers,
  setupDictionaryHandlers,
  setupDailyHandlers,
  setupMeetingHandlers,
  setupTasksHandlers,
  setupCLIHandlers,
  setupRaycastHandlers,
  setupExportHandlers,
  setupDialogHandlers,
  setupVaultHandlers,
  setupSyncHandlers,
  setupSyncStatusForwarding,
  setupRecentOpensHandlers,
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
const deps: HandlerDependencies = {
  windowManager: null,
  vault: null,
  graphEngine: null,
  searchEngine: null,
  taskIndex: null,
  syncEngine: null,
  recentOpensDb: null,
};

/**
 * Initialize the vault and load notes
 * @returns The initialized vault path (VaultPath branded type)
 */
async function initializeEngine(): Promise<import('@scribe/shared').VaultPath> {
  try {
    // Load configured vault path (or default)
    const configuredPath = await getVaultPath();
    mainLogger.info(`Using vault path from config: ${configuredPath}`);

    // Initialize vault directory structure (creates if needed)
    const vaultPath = await initializeVault(createVaultPath(configuredPath));
    mainLogger.info(`Vault initialized at: ${vaultPath}`);

    // Create vault instance and load notes
    deps.vault = new FileSystemVault(vaultPath);
    const noteCount = await deps.vault.load();
    mainLogger.info(`Loaded ${noteCount} notes from vault`);

    // Check for quarantined files and log warning
    const quarantinedFiles = deps.vault.getQuarantineManager().listQuarantined();
    if (quarantinedFiles.length > 0) {
      mainLogger.warn(
        `${quarantinedFiles.length} corrupt note(s) were quarantined: ${quarantinedFiles.join(', ')}`
      );
    }

    // Initialize graph engine
    deps.graphEngine = new GraphEngine();

    // Initialize search engine
    deps.searchEngine = new SearchEngine();

    // Initialize task index (derived data stored in vault/derived)
    deps.taskIndex = new TaskIndex(path.join(vaultPath, 'derived'));
    await deps.taskIndex.load();

    // Initialize recent opens database
    const recentOpensDbPath = path.join(vaultPath, 'derived', 'recent_opens.sqlite3');
    deps.recentOpensDb = new RecentOpensDatabase({ dbPath: recentOpensDbPath });
    mainLogger.info('Recent opens database initialized');

    // Build initial graph, search index, and task index from loaded notes
    const notes = deps.vault.list();
    for (const note of notes) {
      deps.graphEngine.addNote(note);
      deps.searchEngine.indexNote(note);
      deps.taskIndex.indexNote(note);
    }
    mainLogger.info(`Graph initialized with ${notes.length} notes`);
    mainLogger.info(`Search index initialized with ${deps.searchEngine.size()} notes`);
    mainLogger.info(`Task index initialized with ${deps.taskIndex.size} tasks`);

    const stats = deps.graphEngine.getStats();
    mainLogger.debug(`Graph stats: ${stats.nodes} nodes, ${stats.edges} edges, ${stats.tags} tags`);

    // SYNC: Load sync configuration using engine-sync package
    // Sync is disabled by default - only enabled with valid config and enabled: true
    const syncConfigResult = await loadSyncConfig(vaultPath);

    if (syncConfigResult.status === 'enabled') {
      try {
        // Get API key from secure storage
        const credentialManager = createCredentialManager(vaultPath);
        const apiKey = await credentialManager.getApiKey();

        if (apiKey) {
          // Create and initialize sync engine
          deps.syncEngine = await createSyncEngine({
            vaultPath,
            config: syncConfigResult.config,
            apiKey,
            // networkMonitor: new ElectronNetworkMonitor(), // TODO: Implement if needed
            onSaveNote: async (note) => {
              // Save via vault without triggering sync again (internal sync save)
              await deps.vault?.save(note);
            },
            onDeleteNote: async (noteId) => {
              await deps.vault?.delete(createNoteId(noteId));
            },
            onReadNote: async (noteId) => {
              return deps.vault?.read(createNoteId(noteId)) ?? null;
            },
          });

          mainLogger.info('Sync engine initialized', {
            serverUrl: syncConfigResult.config.serverUrl,
            deviceId: syncConfigResult.config.deviceId.slice(0, 8) + '...', // Log only prefix for privacy
          });
        } else {
          mainLogger.warn('Sync enabled but no API key found - sync engine not initialized');
          deps.syncEngine = null;
        }
      } catch (error) {
        mainLogger.error('Failed to initialize sync engine', { error });
        deps.syncEngine = null;
      }
    } else if (syncConfigResult.status === 'disabled') {
      deps.syncEngine = null;
      mainLogger.info(`Sync disabled - reason: ${syncConfigResult.reason}`);
    } else {
      // Error loading config
      deps.syncEngine = null;
      mainLogger.error('Error loading sync config', { error: syncConfigResult.error });
    }

    return vaultPath;
  } catch (error) {
    mainLogger.error('Failed to initialize engine', { error });
    throw error;
  }
}

/**
 * Setup all IPC handlers by delegating to domain-specific handler modules.
 */
function setupIPCHandlers() {
  // Register all handler modules
  setupAppHandlers(deps);
  setupNotesHandlers(deps);
  setupSearchHandlers(deps);
  setupGraphHandlers(deps);
  setupPeopleHandlers(deps);
  setupDictionaryHandlers(deps);
  setupDailyHandlers(deps);
  setupMeetingHandlers(deps);
  setupTasksHandlers(deps);
  setupCLIHandlers(deps);
  setupRaycastHandlers(deps);
  setupExportHandlers(deps);
  setupDialogHandlers();
  setupVaultHandlers(deps);
  setupSyncHandlers(deps);
  setupRecentOpensHandlers(deps);
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

  // Initialize engine before setting up IPC handlers
  const vaultPath = await initializeEngine();

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

  // Setup sync status forwarding to renderer (if sync is enabled)
  setupSyncStatusForwarding(deps);

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

// Cleanup engines before quitting
app.on('before-quit', async () => {
  // Flush task index to persist any pending changes
  if (deps.taskIndex) {
    try {
      await deps.taskIndex.flush();
      mainLogger.debug('Task index flushed successfully');
    } catch (error) {
      mainLogger.error('Failed to flush task index', { error });
    }
  }

  // Shutdown sync engine to stop polling and cleanup resources
  if (deps.syncEngine) {
    try {
      await deps.syncEngine.shutdown();
      mainLogger.debug('Sync engine shutdown successfully');
    } catch (error) {
      mainLogger.error('Failed to shutdown sync engine', { error });
    }
  }

  // Close recent opens database
  if (deps.recentOpensDb) {
    try {
      deps.recentOpensDb.close();
      mainLogger.debug('Recent opens database closed successfully');
    } catch (error) {
      mainLogger.error('Failed to close recent opens database', { error });
    }
  }
});
