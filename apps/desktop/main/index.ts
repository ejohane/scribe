/**
 * Electron main process entry point.
 */

import { app, BrowserWindow } from 'electron';
import { setupIPC } from './ipc.js';
import { CoreEngineManager } from './core-engine-manager.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let coreEngineManager: CoreEngineManager | null = null;

/**
 * Create the main application window.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, load from Vite dev server
  // In production, load from built files
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Initialize the application.
 */
async function initialize() {
  // Create window
  createWindow();

  // Start Core Engine
  coreEngineManager = new CoreEngineManager();
  await coreEngineManager.start();

  // Setup IPC handlers
  if (mainWindow && coreEngineManager) {
    setupIPC(mainWindow, coreEngineManager);
  }
}

// App lifecycle
app.whenReady().then(initialize);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  if (coreEngineManager) {
    await coreEngineManager.stop();
  }
});
