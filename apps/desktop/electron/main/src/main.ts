import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

// __filename and __dirname are provided by the build script banner

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;

// Setup IPC handlers
function setupIPCHandlers() {
  // Ping test handler
  ipcMain.handle('ping', async () => {
    return { message: 'pong', timestamp: Date.now() };
  });

  // Placeholder handlers for future implementation
  ipcMain.handle('notes:list', async () => {
    return [];
  });

  ipcMain.handle('notes:read', async (_event, id: string) => {
    return null;
  });

  ipcMain.handle('notes:save', async (_event, note: unknown) => {
    return { success: true };
  });

  ipcMain.handle('notes:create', async () => {
    return null;
  });

  ipcMain.handle('search:query', async (_event, text: string) => {
    return [];
  });

  ipcMain.handle('graph:forNote', async (_event, id: string) => {
    return [];
  });

  ipcMain.handle('graph:backlinks', async (_event, id: string) => {
    return [];
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

app.whenReady().then(() => {
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
