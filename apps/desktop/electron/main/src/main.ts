import { app, BrowserWindow, Menu, MenuItem } from 'electron';
import path from 'path';
import { createVaultPath, createNoteId } from '@scribe/shared';
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
  setupExportHandlers,
  setupDialogHandlers,
  setupVaultHandlers,
  setupSyncHandlers,
  setupSyncStatusForwarding,
  setupRecentOpensHandlers,
  getVaultPath,
  type HandlerDependencies,
} from './handlers';
import { mainLogger } from './logger';
import { DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT, TRAFFIC_LIGHT_POSITION } from './constants';

// __filename and __dirname are provided by the build script banner

const isDev = process.env.NODE_ENV === 'development';

// Shared dependencies for all IPC handlers
const deps: HandlerDependencies = {
  mainWindow: null,
  vault: null,
  graphEngine: null,
  searchEngine: null,
  taskIndex: null,
  syncEngine: null,
  recentOpensDb: null,
};

/**
 * Initialize the vault and load notes
 */
async function initializeEngine() {
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
  setupExportHandlers(deps);
  setupDialogHandlers();
  setupVaultHandlers(deps);
  setupSyncHandlers(deps);
  setupRecentOpensHandlers(deps);
}

/**
 * Create and configure the main application window.
 *
 * This function initializes the BrowserWindow with security-hardened settings,
 * loads the renderer process, and sets up the native context menu for spell-check
 * and editing operations.
 *
 * ## Window Configuration
 *
 * - **Dimensions**: Uses DEFAULT_WINDOW_WIDTH (1200) and DEFAULT_WINDOW_HEIGHT (800)
 *   as comfortable defaults for note-taking. These can be resized by the user.
 *
 * - **Title Bar**: Uses macOS-native `hiddenInset` style with custom traffic light
 *   positioning (TRAFFIC_LIGHT_POSITION) to blend with our custom UI while keeping
 *   native window controls accessible.
 *
 * - **Platform Icons**: Windows requires explicit .ico file; macOS uses dock icon
 *   (set separately); Linux uses the .desktop file configuration.
 *
 * ## Security Settings (webPreferences)
 *
 * - **nodeIntegration: false** - Prevents renderer process from accessing Node.js
 *   APIs directly. This is a critical security measure that prevents XSS attacks
 *   from accessing the filesystem or executing system commands.
 *
 * - **contextIsolation: true** - Runs preload script in isolated context, preventing
 *   the renderer from tampering with the preload script's privileged APIs. Works
 *   with contextBridge to expose only specific, controlled APIs.
 *
 * - **spellcheck: true** - Enables Chromium's built-in spell-checking. Dictionary
 *   management is handled via session.addWordToSpellCheckerDictionary() in the
 *   context menu handler.
 *
 * - **preload**: Points to the preload script that bridges main and renderer
 *   processes via contextBridge.exposeInMainWorld().
 *
 * ## Context Menu Behavior
 *
 * The context menu adapts to the current content:
 *
 * 1. **Misspelled words**: Shows dictionary suggestions, "Add to Dictionary" option
 * 2. **Editable fields**: Cut, Copy, Paste actions
 * 3. **Selected text (non-editable)**: Copy action only
 * 4. **No selection**: No menu shown
 *
 * ## Lifecycle
 *
 * - Window reference is stored in `deps.mainWindow` for IPC handler access
 * - Reference is nulled on 'closed' event to allow garbage collection
 * - In dev mode: loads from Vite dev server (localhost:5173) with DevTools open
 * - In production: loads from bundled renderer/dist/index.html
 *
 * @sideeffects
 * - Sets `deps.mainWindow` to the created BrowserWindow instance
 * - Opens DevTools in development mode
 * - Registers 'closed' and 'context-menu' event listeners
 */
function createWindow() {
  // Set window icon for Windows (macOS uses dock icon, Linux uses desktop file)
  const iconPath =
    process.platform === 'win32' ? path.join(__dirname, '../../../build/icon.ico') : undefined;

  deps.mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: TRAFFIC_LIGHT_POSITION,
    icon: iconPath,
    webPreferences: {
      // Security: Disable Node.js integration to prevent XSS from accessing system
      nodeIntegration: false,
      // Security: Isolate preload context to protect privileged APIs
      contextIsolation: true,
      // Enable Chromium spell-check with custom dictionary support
      spellcheck: true,
      // Bridge to renderer via contextBridge.exposeInMainWorld()
      preload: path.join(__dirname, '../../preload/dist/preload.js'),
    },
  });

  // Load the renderer
  if (isDev) {
    // In development, load from Vite dev server
    deps.mainWindow.loadURL('http://localhost:5173');
    deps.mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    // __dirname is electron/main/dist, so we need to go up 3 levels to reach renderer/dist
    deps.mainWindow.loadFile(path.join(__dirname, '../../../renderer/dist/index.html'));
  }

  deps.mainWindow.on('closed', () => {
    deps.mainWindow = null;
  });

  // Setup context menu for spellcheck and editing operations
  deps.mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu();

    // Add spelling suggestions if there's a misspelled word
    if (params.misspelledWord) {
      // Add spelling suggestions
      for (const suggestion of params.dictionarySuggestions) {
        menu.append(
          new MenuItem({
            label: suggestion,
            click: () => deps.mainWindow?.webContents.replaceMisspelling(suggestion),
          })
        );
      }

      // Add separator after suggestions (if any)
      if (params.dictionarySuggestions.length > 0) {
        menu.append(new MenuItem({ type: 'separator' }));
      }

      // Add "Add to Dictionary" option
      menu.append(
        new MenuItem({
          label: 'Add to Dictionary',
          click: () =>
            deps.mainWindow?.webContents.session.addWordToSpellCheckerDictionary(
              params.misspelledWord
            ),
        })
      );

      // Add separator before edit operations
      menu.append(new MenuItem({ type: 'separator' }));
    }

    // Standard editing actions for editable fields
    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'cut' }));
      menu.append(new MenuItem({ role: 'copy' }));
      menu.append(new MenuItem({ role: 'paste' }));
    } else if (params.selectionText) {
      // For non-editable text with selection, only show copy
      menu.append(new MenuItem({ role: 'copy' }));
    }

    // Only show menu if there are items
    if (menu.items.length > 0) {
      menu.popup();
    }
  });
}

app.whenReady().then(async () => {
  // Initialize engine before setting up IPC handlers
  await initializeEngine();

  setupIPCHandlers();
  createWindow();

  // Setup update handlers - production uses real auto-updater, dev uses stubs
  if (deps.mainWindow) {
    if (isDev) {
      setupDevUpdateHandlers(deps.mainWindow);
    } else {
      setupAutoUpdater(deps.mainWindow);
    }

    // Setup sync status forwarding to renderer (if sync is enabled)
    setupSyncStatusForwarding(deps, deps.mainWindow);
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
    if (BrowserWindow.getAllWindows().length === 0) {
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
