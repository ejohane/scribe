import { app, BrowserWindow, Menu, MenuItem } from 'electron';
import path from 'path';
import { createVaultPath } from '@scribe/shared';
import { FileSystemVault, initializeVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import { TaskIndex } from '@scribe/engine-core/node';
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

// Flush task index before quitting to persist any pending changes
app.on('before-quit', async () => {
  if (deps.taskIndex) {
    try {
      await deps.taskIndex.flush();
      mainLogger.debug('Task index flushed successfully');
    } catch (error) {
      mainLogger.error('Failed to flush task index', { error });
    }
  }
});
