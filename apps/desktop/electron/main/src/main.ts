import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import * as fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { FileSystemVault, initializeVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import type { Note, NoteId, LexicalState } from '@scribe/shared';
import { ScribeError, ErrorCode } from '@scribe/shared';

// __filename and __dirname are provided by the build script banner

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let vault: FileSystemVault | null = null;
let graphEngine: GraphEngine | null = null;
let searchEngine: SearchEngine | null = null;

// App config
interface AppConfig {
  lastOpenedNoteId?: NoteId;
  theme?: 'light' | 'dark' | 'system';
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

    // Check for quarantined files and log warning
    const quarantinedFiles = vault.getQuarantinedFiles();
    if (quarantinedFiles.length > 0) {
      console.warn(
        `⚠️  ${quarantinedFiles.length} corrupt note(s) were quarantined: ${quarantinedFiles.join(', ')}`
      );
    }

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
 * Create the initial Lexical content for a new person note.
 * Sets up an H1 heading with the person's name and an empty paragraph.
 */
function createPersonContent(name: string): LexicalState {
  return {
    root: {
      children: [
        {
          type: 'heading',
          tag: 'h1',
          children: [{ type: 'text', text: name }],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
        {
          type: 'paragraph',
          children: [],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'person',
  };
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
    try {
      if (!vault) {
        throw new Error('Vault not initialized');
      }
      const note = vault.read(id);
      return note;
    } catch (error) {
      // Send user-friendly error message if it's a ScribeError
      if (error instanceof ScribeError) {
        const userError = new Error(error.getUserMessage());
        userError.name = error.code;
        throw userError;
      }
      throw error;
    }
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
    try {
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
    } catch (error) {
      // Send user-friendly error message if it's a ScribeError
      if (error instanceof ScribeError) {
        const userError = new Error(error.getUserMessage());
        userError.name = error.code;
        throw userError;
      }
      throw error;
    }
  });

  // Delete a note
  ipcMain.handle('notes:delete', async (_event, id: NoteId) => {
    try {
      if (!vault) {
        throw new Error('Vault not initialized');
      }
      if (!graphEngine) {
        throw new Error('Graph engine not initialized');
      }
      if (!searchEngine) {
        throw new Error('Search engine not initialized');
      }
      await vault.delete(id);
      graphEngine.removeNote(id);
      searchEngine.removeNote(id);
      return { success: true };
    } catch (error) {
      if (error instanceof ScribeError) {
        const userError = new Error(error.getUserMessage());
        userError.name = error.code;
        throw userError;
      }
      throw error;
    }
  });

  // Find a note by title (for wiki-link resolution)
  ipcMain.handle('notes:findByTitle', async (_event, title: string) => {
    if (!vault) {
      throw new Error('Vault not initialized');
    }
    const notes = vault.list();

    // Exact match first (using explicit title field)
    let match = notes.find((n) => n.title === title);

    // Case-insensitive fallback
    if (!match) {
      const lowerTitle = title.toLowerCase();
      const matches = notes.filter((n) => n.title?.toLowerCase() === lowerTitle);
      // Most recently updated wins
      match = matches.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    }

    return match ?? null;
  });

  // Search note titles (for wiki-link autocomplete)
  ipcMain.handle('notes:searchTitles', async (_event, query: string, limit = 10) => {
    if (!vault) {
      throw new Error('Vault not initialized');
    }

    // Empty query returns empty results
    if (!query.trim()) {
      return [];
    }

    const notes = vault.list();
    const lowerQuery = query.toLowerCase();

    // Use explicit title field for search
    const matches = notes
      .filter((n) => n.title) // Has title
      .filter((n) => n.title.toLowerCase().includes(lowerQuery))
      .slice(0, limit)
      .map((n) => ({
        id: n.id,
        title: n.title,
        snippet: '',
        score: 1,
        matches: [],
      }));

    return matches;
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

  // People: List all people
  ipcMain.handle('people:list', async () => {
    if (!vault) {
      throw new ScribeError(ErrorCode.VAULT_NOT_INITIALIZED, 'Vault not initialized');
    }
    const notes = vault.list();
    return notes.filter((n) => n.metadata.type === 'person');
  });

  // People: Create a new person
  ipcMain.handle('people:create', async (_event, name: string) => {
    try {
      if (!vault) {
        throw new ScribeError(ErrorCode.VAULT_NOT_INITIALIZED, 'Vault not initialized');
      }
      if (!graphEngine) {
        throw new ScribeError(ErrorCode.GRAPH_NOT_INITIALIZED, 'Graph engine not initialized');
      }
      if (!searchEngine) {
        throw new ScribeError(ErrorCode.SEARCH_NOT_INITIALIZED, 'Search engine not initialized');
      }
      if (!name || name.trim().length === 0) {
        throw new ScribeError(ErrorCode.VALIDATION_ERROR, 'Person name is required');
      }
      const content = createPersonContent(name.trim());
      // Note: vault.create() now accepts options object
      const note = await vault.create({ content, type: 'person', title: name.trim() });

      // Update graph and search indexes
      graphEngine.addNote(note);
      searchEngine.indexNote(note);

      return note;
    } catch (error) {
      // Send user-friendly error message if it's a ScribeError
      if (error instanceof ScribeError) {
        const userError = new Error(error.getUserMessage());
        userError.name = error.code;
        throw userError;
      }
      throw error;
    }
  });

  // People: Search people by name
  ipcMain.handle('people:search', async (_event, query: string, limit = 10) => {
    if (!vault) {
      throw new ScribeError(ErrorCode.VAULT_NOT_INITIALIZED, 'Vault not initialized');
    }
    const notes = vault.list();
    // Use explicit type field for filtering
    const people = notes.filter((n) => n.type === 'person');

    const queryLower = query.toLowerCase();
    const filtered = people.filter((n) => {
      const title = (n.title ?? '').toLowerCase();
      return title.includes(queryLower);
    });

    return filtered.slice(0, limit).map((n) => ({
      id: n.id,
      title: n.title,
      snippet: '',
      score: 1,
      matches: [],
    }));
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

  // Get app config
  ipcMain.handle('app:getConfig', async () => {
    return await loadConfig();
  });

  // Set app config (merge with existing)
  ipcMain.handle('app:setConfig', async (_event, partialConfig: Partial<AppConfig>) => {
    const config = await loadConfig();
    const updatedConfig = { ...config, ...partialConfig };
    await saveConfig(updatedConfig);
    return { success: true };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
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
