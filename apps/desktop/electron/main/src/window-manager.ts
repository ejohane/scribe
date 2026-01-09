/**
 * WindowManager - Core abstraction for multi-window support
 *
 * This class manages all BrowserWindow instances, replacing the singleton mainWindow pattern.
 * It provides:
 * - Window creation with consistent configuration
 * - Window lifecycle management (tracking, cleanup)
 * - Broadcasting messages to all windows
 * - Backwards compatibility via getMainWindow()
 */

import { BrowserWindow, Menu, MenuItem } from 'electron';
import path from 'path';
import { DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT, TRAFFIC_LIGHT_POSITION } from './constants';

/**
 * Options for creating a new window
 */
export interface WindowCreateOptions {
  /** Optional note ID to open in this window */
  noteId?: string;
  /** X position of the window */
  x?: number;
  /** Y position of the window */
  y?: number;
  /** Width of the window (defaults to DEFAULT_WINDOW_WIDTH) */
  width?: number;
  /** Height of the window (defaults to DEFAULT_WINDOW_HEIGHT) */
  height?: number;
}

/**
 * Configuration options for WindowManager
 */
export interface WindowManagerConfig {
  /** Whether running in development mode */
  isDev: boolean;
  /** Path to the preload script */
  preloadPath: string;
  /** Path to the renderer HTML file (production) */
  rendererPath: string;
  /** URL of the dev server (development) */
  devServerUrl: string;
}

/**
 * Manages all BrowserWindow instances for the application.
 *
 * Uses a Map<number, BrowserWindow> for O(1) lookup by window ID.
 * Handles window creation, lifecycle, and cross-window communication.
 */
export class WindowManager {
  /** Map of window ID to BrowserWindow instance */
  private windows: Map<number, BrowserWindow> = new Map();

  /** Map of window ID to the note ID currently being viewed in that window */
  private windowNotes: Map<number, string | null> = new Map();

  /** Whether running in development mode */
  private isDev: boolean;

  /** Path to the preload script */
  private preloadPath: string;

  /** Path to the renderer HTML file (production) */
  private rendererPath: string;

  /** URL of the dev server (development) */
  private devServerUrl: string;

  /**
   * Create a new WindowManager instance.
   *
   * @param config - Configuration options
   */
  constructor(config: WindowManagerConfig) {
    this.isDev = config.isDev;
    this.preloadPath = config.preloadPath;
    this.rendererPath = config.rendererPath;
    this.devServerUrl = config.devServerUrl;
  }

  /**
   * Create and configure a new application window.
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
   * ## Security Settings (webPreferences)
   *
   * - **nodeIntegration: false** - Prevents renderer process from accessing Node.js
   *   APIs directly. This is a critical security measure that prevents XSS attacks
   *   from accessing the filesystem or executing system commands.
   *
   * - **contextIsolation: true** - Runs preload script in isolated context, preventing
   *   the renderer from tampering with the preload script's privileged APIs.
   *
   * - **spellcheck: true** - Enables Chromium's built-in spell-checking.
   *
   * @param options - Window creation options
   * @returns The created BrowserWindow instance
   */
  createWindow(options: WindowCreateOptions = {}): BrowserWindow {
    // Set window icon for Windows (macOS uses dock icon, Linux uses desktop file)
    const iconPath =
      process.platform === 'win32' ? path.join(__dirname, '../../../build/icon.ico') : undefined;

    const win = new BrowserWindow({
      width: options.width ?? DEFAULT_WINDOW_WIDTH,
      height: options.height ?? DEFAULT_WINDOW_HEIGHT,
      x: options.x,
      y: options.y,
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
        preload: this.preloadPath,
      },
    });

    // Add to windows map
    this.windows.set(win.id, win);

    // Remove from map when closed
    win.on('closed', () => {
      this.windows.delete(win.id);
      this.windowNotes.delete(win.id);
    });

    // Setup context menu for spellcheck and editing operations
    this.setupContextMenu(win);

    // Load the renderer content
    this.loadWindow(win, options.noteId);

    return win;
  }

  /**
   * Setup context menu for spellcheck and editing operations.
   *
   * The context menu adapts to the current content:
   * 1. **Misspelled words**: Shows dictionary suggestions, "Add to Dictionary" option
   * 2. **Editable fields**: Cut, Copy, Paste actions
   * 3. **Selected text (non-editable)**: Copy action only
   * 4. **No selection**: No menu shown
   *
   * @param win - The window to setup context menu for
   */
  private setupContextMenu(win: BrowserWindow): void {
    win.webContents.on('context-menu', (_event, params) => {
      const menu = new Menu();

      // Add spelling suggestions if there's a misspelled word
      if (params.misspelledWord) {
        // Add spelling suggestions
        for (const suggestion of params.dictionarySuggestions) {
          menu.append(
            new MenuItem({
              label: suggestion,
              click: () => win.webContents.replaceMisspelling(suggestion),
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
              win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
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

  /**
   * Load content into a window.
   *
   * In development, loads from Vite dev server with DevTools open.
   * In production, loads from bundled HTML file.
   *
   * @param win - The window to load content into
   * @param noteId - Optional note ID to pass as query parameter
   */
  private loadWindow(win: BrowserWindow, noteId?: string): void {
    if (this.isDev) {
      const url = noteId
        ? `${this.devServerUrl}?noteId=${encodeURIComponent(noteId)}`
        : this.devServerUrl;
      win.loadURL(url);
      win.webContents.openDevTools();
    } else {
      if (noteId) {
        win.loadURL(`file://${this.rendererPath}?noteId=${encodeURIComponent(noteId)}`);
      } else {
        win.loadFile(this.rendererPath);
      }
    }
  }

  /**
   * Get all managed windows.
   *
   * @returns Array of all BrowserWindow instances
   */
  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values());
  }

  /**
   * Get a window by its ID.
   *
   * @param id - The window ID
   * @returns The BrowserWindow if found, undefined otherwise
   */
  getWindow(id: number): BrowserWindow | undefined {
    return this.windows.get(id);
  }

  /**
   * Get the currently focused window, or the first window if none is focused.
   *
   * @returns The focused window, first available window, or undefined if no windows exist
   */
  getFocusedWindow(): BrowserWindow | undefined {
    return BrowserWindow.getFocusedWindow() ?? this.windows.values().next().value;
  }

  /**
   * Get the number of managed windows.
   *
   * @returns The number of windows
   */
  getWindowCount(): number {
    return this.windows.size;
  }

  /**
   * Broadcast a message to all windows.
   *
   * Safely skips destroyed windows to prevent errors during shutdown.
   *
   * @param channel - The IPC channel to send on
   * @param args - Arguments to send with the message
   */
  broadcast(channel: string, ...args: unknown[]): void {
    for (const win of this.windows.values()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...args);
      }
    }
  }

  /**
   * Get the "main" window for backwards compatibility during migration.
   *
   * Returns the first window in the map, which is typically the oldest window.
   * This allows gradual migration from the singleton mainWindow pattern.
   *
   * @returns The first BrowserWindow or null if no windows exist
   * @deprecated Use getFocusedWindow() or getWindow(id) instead
   */
  getMainWindow(): BrowserWindow | null {
    const first = this.windows.values().next();
    return first.done ? null : first.value;
  }

  /**
   * Close all managed windows.
   *
   * Safely skips destroyed windows to prevent errors.
   */
  closeAll(): void {
    for (const win of this.windows.values()) {
      if (!win.isDestroyed()) {
        win.close();
      }
    }
  }

  /**
   * Set the note ID currently being viewed in a window.
   * Used for smart deep link routing to find windows with specific notes.
   *
   * @param windowId - The window ID
   * @param noteId - The note ID being viewed (null if no note)
   */
  setWindowNote(windowId: number, noteId: string | null): void {
    this.windowNotes.set(windowId, noteId);
  }

  /**
   * Find a window that is currently viewing a specific note.
   *
   * @param noteId - The note ID to search for
   * @returns The BrowserWindow if found, null otherwise
   */
  findWindowWithNote(noteId: string): BrowserWindow | null {
    for (const [windowId, note] of this.windowNotes) {
      if (note === noteId) {
        const win = this.windows.get(windowId);
        if (win && !win.isDestroyed()) {
          return win;
        }
      }
    }
    return null;
  }
}
