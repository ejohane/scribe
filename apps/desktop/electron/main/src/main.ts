import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { FileSystemVault, initializeVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import type { Note, NoteId } from '@scribe/shared';

// __filename and __dirname are provided by the build script banner

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let vault: FileSystemVault | null = null;
let graphEngine: GraphEngine | null = null;

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

    // Build initial graph from loaded notes
    const notes = vault.list();
    for (const note of notes) {
      graphEngine.addNote(note);
    }
    console.log(`Graph initialized with ${notes.length} notes`);

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
    await vault.save(note);

    // Update graph with new note data
    graphEngine.addNote(note);

    return { success: true };
  });

  // Placeholder handlers for future implementation
  ipcMain.handle('search:query', async (_event, text: string) => {
    return [];
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
