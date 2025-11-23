import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import * as fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { FileSystemVault, initializeVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import type { Note, NoteId } from '@scribe/shared';

// __filename and __dirname are provided by the build script banner

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let vault: FileSystemVault | null = null;
let graphEngine: GraphEngine | null = null;
let searchEngine: SearchEngine | null = null;

// App config
interface AppConfig {
  lastOpenedNoteId?: NoteId;
}

const CONFIG_DIR = path.join(homedir(), 'Scribe');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

/**
 * Load app configuration
 */
async function loadConfig(): Promise<AppConfig> {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    // Config doesn't exist or is invalid, return empty config
    return {};
  }
}

/**
 * Save app configuration
 */
async function saveConfig(config: AppConfig): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

/**
 * Initialize the vault and load notes
 */
async function initializeEngine() {
  try {
    // Initialize vault directory structure
    const vaultPath = await initializeVault();
    console.log(`Vault initialized at: ${vaultPath}`);

    // Create vault instance and load notes
    vault = new FileSystemVault(vaultPath);
    const noteCount = await vault.load();
    console.log(`Loaded ${noteCount} notes from vault`);

    // Initialize graph engine
    graphEngine = new GraphEngine();

    // Initialize search engine
    searchEngine = new SearchEngine();

    // Build initial graph and search index from loaded notes
    const notes = vault.list();
    for (const note of notes) {
      graphEngine.addNote(note);
      searchEngine.indexNote(note);
    }
    console.log(`Graph initialized with ${notes.length} notes`);
    console.log(`Search index initialized with ${searchEngine.size()} notes`);

    const stats = graphEngine.getStats();
    console.log(`Graph stats: ${stats.nodes} nodes, ${stats.edges} edges, ${stats.tags} tags`);
  } catch (error) {
    console.error('Failed to initialize engine:', error);
    throw error;
  }
}

/**
 * Setup IPC handlers for notes operations
 */
function setupIPCHandlers() {
  // Ping test handler
  ipcMain.handle('ping', async () => {
    return { message: 'pong', timestamp: Date.now() };
  });

  // List all notes
  ipcMain.handle('notes:list', async () => {
    if (!vault) {
      throw new Error('Vault not initialized');
    }
    return vault.list();
  });

  // Read a single note by ID
  ipcMain.handle('notes:read', async (_event, id: NoteId) => {
    if (!vault) {
      throw new Error('Vault not initialized');
    }
    const note = vault.read(id);
    if (!note) {
      throw new Error(`Note not found: ${id}`);
    }
    return note;
  });

  // Create a new note
  ipcMain.handle('notes:create', async () => {
    if (!vault) {
      throw new Error('Vault not initialized');
    }
    const note = await vault.create();
    return note;
  });

  // Save a note (update)
  ipcMain.handle('notes:save', async (_event, note: Note) => {
    if (!vault) {
      throw new Error('Vault not initialized');
    }
    if (!graphEngine) {
      throw new Error('Graph engine not initialized');
    }
    if (!searchEngine) {
      throw new Error('Search engine not initialized');
    }
    await vault.save(note);

    // Update graph with new note data
    graphEngine.addNote(note);

    // Update search index with new note data
    searchEngine.indexNote(note);

    return { success: true };
  });

  // Search: Query notes
  ipcMain.handle('search:query', async (_event, query: string) => {
    if (!searchEngine) {
      throw new Error('Search engine not initialized');
    }
    return searchEngine.search(query);
  });

  // Graph: Get neighbors for a note
  ipcMain.handle('graph:forNote', async (_event, id: NoteId) => {
    if (!graphEngine) {
      throw new Error('Graph engine not initialized');
    }
    return graphEngine.neighbors(id);
  });

  // Graph: Get backlinks for a note
  ipcMain.handle('graph:backlinks', async (_event, id: NoteId) => {
    if (!graphEngine) {
      throw new Error('Graph engine not initialized');
    }
    return graphEngine.backlinks(id);
  });

  // Graph: Get notes with tag
  ipcMain.handle('graph:notesWithTag', async (_event, tag: string) => {
    if (!graphEngine) {
      throw new Error('Graph engine not initialized');
    }
    return graphEngine.notesWithTag(tag);
  });

  // Open devtools
  ipcMain.handle('app:openDevTools', async () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools();
    }
    return { success: true };
  });

  // Get last opened note ID
  ipcMain.handle('app:getLastOpenedNote', async () => {
    const config = await loadConfig();
    return config.lastOpenedNoteId || null;
  });

  // Set last opened note ID
  ipcMain.handle('app:setLastOpenedNote', async (_event, noteId: NoteId | null) => {
    const config = await loadConfig();
    config.lastOpenedNoteId = noteId || undefined;
    await saveConfig(config);
    return { success: true };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../../preload/dist/preload.js'),
    },
  });

  // Load the renderer
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, '../../renderer/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialize engine before setting up IPC handlers
  await initializeEngine();

  setupIPCHandlers();
  createWindow();

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
