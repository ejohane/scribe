import { app, BrowserWindow, ipcMain, shell, Menu, MenuItem } from 'electron';
import path from 'path';
import * as fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { format } from 'date-fns';
import { FileSystemVault, initializeVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import { computeTextHash } from '@scribe/engine-core';
import { TaskIndex } from '@scribe/engine-core/node';
import type { Note, NoteId, LexicalState, LexicalNode, Task, TaskFilter } from '@scribe/shared';
import { ScribeError, ErrorCode } from '@scribe/shared';
import { setupAutoUpdater } from './auto-updater';

// __filename and __dirname are provided by the build script banner

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let vault: FileSystemVault | null = null;
let graphEngine: GraphEngine | null = null;
let searchEngine: SearchEngine | null = null;
let taskIndex: TaskIndex | null = null;

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

    // Initialize task index (derived data stored in vault/derived)
    taskIndex = new TaskIndex(path.join(vaultPath, 'derived'));
    await taskIndex.load();

    // Build initial graph, search index, and task index from loaded notes
    const notes = vault.list();
    for (const note of notes) {
      graphEngine.addNote(note);
      searchEngine.indexNote(note);
      taskIndex.indexNote(note);
    }
    console.log(`Graph initialized with ${notes.length} notes`);
    console.log(`Search index initialized with ${searchEngine.size()} notes`);
    console.log(`Task index initialized with ${taskIndex.size} tasks`);

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
 * Create initial content for daily notes.
 * Matches the structure in renderer/src/templates/daily.ts
 */
function createDailyContent(): LexicalState {
  return {
    root: {
      children: [
        {
          type: 'list',
          listType: 'bullet',
          children: [
            {
              type: 'listitem',
              children: [],
              direction: null,
              format: '',
              indent: 0,
              version: 1,
            },
          ],
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
    type: 'daily',
  } as LexicalState;
}

/**
 * Create initial content for meeting notes.
 * Matches the structure in renderer/src/templates/meeting.ts
 */
function createMeetingContent(): LexicalState {
  const createH3 = (text: string) => ({
    type: 'heading',
    tag: 'h3',
    children: [{ type: 'text', text, format: 0, mode: 'normal', style: '', detail: 0, version: 1 }],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  });

  const emptyBulletList = () => ({
    type: 'list',
    listType: 'bullet',
    start: 1,
    tag: 'ul',
    children: [
      {
        type: 'listitem',
        value: 1,
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  });

  return {
    root: {
      children: [
        createH3('Pre-Read'),
        emptyBulletList(),
        createH3('Notes'),
        emptyBulletList(),
        createH3('Action Items'),
        emptyBulletList(),
      ],
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'meeting',
  } as LexicalState;
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
      if (!taskIndex) {
        throw new Error('Task index not initialized');
      }
      await vault.save(note);

      // Update graph with new note data
      graphEngine.addNote(note);

      // Update search index with new note data
      searchEngine.indexNote(note);

      // Re-index tasks for this note and broadcast changes
      const taskChanges = taskIndex.indexNote(note);
      if (taskChanges.length > 0) {
        mainWindow?.webContents.send('tasks:changed', taskChanges);
      }

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
      if (!taskIndex) {
        throw new Error('Task index not initialized');
      }
      await vault.delete(id);
      graphEngine.removeNote(id);
      searchEngine.removeNote(id);

      // Remove tasks for this note and broadcast changes
      const taskChanges = taskIndex.removeNote(id);
      if (taskChanges.length > 0) {
        mainWindow?.webContents.send('tasks:changed', taskChanges);
      }

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

  // Find notes by date (for date-based linked mentions in daily notes)
  ipcMain.handle(
    'notes:findByDate',
    async (
      _event,
      {
        date,
        includeCreated,
        includeUpdated,
      }: { date: string; includeCreated: boolean; includeUpdated: boolean }
    ) => {
      if (!vault) {
        throw new Error('Vault not initialized');
      }

      // Parse the date string (expecting "MM-dd-yyyy" format from daily note titles)
      const [month, day, year] = date.split('-').map(Number);
      const targetDate = new Date(year, month - 1, day);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const startMs = startOfDay.getTime();
      const endMs = endOfDay.getTime();

      const notes = vault.list();
      const results: Array<{ note: Note; reason: 'created' | 'updated' }> = [];

      for (const note of notes) {
        // Skip the daily note itself (will be excluded later by noteId, but good to skip early)
        if (note.type === 'daily' && note.title === date) {
          continue;
        }

        const wasCreatedOnDate = note.createdAt >= startMs && note.createdAt <= endMs;
        const wasUpdatedOnDate = note.updatedAt >= startMs && note.updatedAt <= endMs;

        if (includeCreated && wasCreatedOnDate) {
          results.push({ note, reason: 'created' });
        } else if (includeUpdated && wasUpdatedOnDate && !wasCreatedOnDate) {
          // Only mark as "updated" if it wasn't also created on this date
          results.push({ note, reason: 'updated' });
        }
      }

      return results;
    }
  );

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

  // Open external URL in default browser
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    // Validate URL to prevent arbitrary command execution
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('Only http:// and https:// URLs are allowed');
    }
    await shell.openExternal(url);
    return { success: true };
  });

  // ============================================
  // Dictionary/Spellcheck Handlers
  // ============================================

  // Add a word to the spellcheck dictionary
  ipcMain.handle('dictionary:addWord', async (_event, word: string) => {
    if (!mainWindow) {
      throw new Error('Main window not available');
    }
    if (!word?.trim()) {
      throw new Error('Word is required');
    }
    mainWindow.webContents.session.addWordToSpellCheckerDictionary(word.trim());
    return { success: true };
  });

  // Remove a word from the spellcheck dictionary
  ipcMain.handle('dictionary:removeWord', async (_event, word: string) => {
    if (!mainWindow) {
      throw new Error('Main window not available');
    }
    if (!word?.trim()) {
      throw new Error('Word is required');
    }
    mainWindow.webContents.session.removeWordFromSpellCheckerDictionary(word.trim());
    return { success: true };
  });

  // Get current spellcheck languages
  ipcMain.handle('dictionary:getLanguages', async () => {
    if (!mainWindow) {
      throw new Error('Main window not available');
    }
    return mainWindow.webContents.session.getSpellCheckerLanguages();
  });

  // Set spellcheck languages
  ipcMain.handle('dictionary:setLanguages', async (_event, languages: string[]) => {
    if (!mainWindow) {
      throw new Error('Main window not available');
    }
    if (!Array.isArray(languages)) {
      throw new Error('Languages must be an array');
    }
    mainWindow.webContents.session.setSpellCheckerLanguages(languages);
    return { success: true };
  });

  // Get available spellcheck languages
  ipcMain.handle('dictionary:getAvailableLanguages', async () => {
    if (!mainWindow) {
      throw new Error('Main window not available');
    }
    return mainWindow.webContents.session.availableSpellCheckerLanguages;
  });

  // ============================================
  // Daily Note Handlers
  // ============================================

  /**
   * Get or create a daily note for a specific date.
   * If no date is provided, uses today's date.
   * Idempotent: returns existing note if one exists for the date.
   */
  ipcMain.handle('daily:getOrCreate', async (_, options?: { date?: string }) => {
    if (!vault) {
      throw new ScribeError(ErrorCode.VAULT_NOT_INITIALIZED, 'Vault not initialized');
    }

    // Use provided date or default to today
    const targetDate = options?.date ? new Date(options.date) : new Date();
    const dateStr = format(targetDate, 'MM-dd-yyyy');

    // Find existing daily note by matching type and title (MM-dd-yyyy date)
    const notes = vault.list();
    const existing = notes.find((n) => n.type === 'daily' && n.title === dateStr);
    if (existing) {
      return existing;
    }

    // Create new daily note
    // Set createdAt to noon on the target date (avoids timezone edge cases)
    const content = createDailyContent();
    const createdAt = new Date(targetDate);
    createdAt.setHours(12, 0, 0, 0);
    const note = await vault.create({
      type: 'daily',
      title: dateStr,
      tags: ['daily'],
      content,
      daily: { date: dateStr },
      createdAt: createdAt.getTime(),
    });

    // Index in engines
    graphEngine!.addNote(note);
    searchEngine!.indexNote(note);

    return note;
  });

  /**
   * Find daily note for a specific date.
   * Returns null if no daily note exists for that date.
   */
  ipcMain.handle('daily:find', async (_, { date }: { date: string }) => {
    if (!vault) {
      throw new ScribeError(ErrorCode.VAULT_NOT_INITIALIZED, 'Vault not initialized');
    }

    const notes = vault.list();
    return notes.find((n) => n.type === 'daily' && n.title === date) ?? null;
  });

  // ============================================
  // Meeting Note Handlers
  // ============================================

  /**
   * Create a new meeting note for today.
   * Auto-creates today's daily note if it doesn't exist.
   */
  ipcMain.handle('meeting:create', async (_, { title }: { title: string }) => {
    if (!vault) {
      throw new ScribeError(ErrorCode.VAULT_NOT_INITIALIZED, 'Vault not initialized');
    }
    if (!title?.trim()) {
      throw new ScribeError(ErrorCode.VALIDATION_ERROR, 'Meeting title required');
    }

    const today = new Date();
    const dateStr = format(today, 'MM-dd-yyyy');

    // Ensure daily note exists (create if needed)
    let dailyNote = vault.list().find((n) => n.type === 'daily' && n.title === dateStr);
    if (!dailyNote) {
      dailyNote = await vault.create({
        type: 'daily',
        title: dateStr,
        tags: ['daily'],
        content: createDailyContent(),
        daily: { date: dateStr },
      });
      graphEngine!.addNote(dailyNote);
      searchEngine!.indexNote(dailyNote);
    }

    // Create meeting note
    const content = createMeetingContent();
    const note = await vault.create({
      type: 'meeting',
      title: title.trim(),
      tags: ['meeting'],
      content,
      meeting: {
        date: dateStr,
        dailyNoteId: dailyNote.id,
        attendees: [],
      },
    });

    graphEngine!.addNote(note);
    searchEngine!.indexNote(note);

    return note;
  });

  /**
   * Add a person as attendee to a meeting.
   * Idempotent: adding same person twice has no effect.
   */
  ipcMain.handle(
    'meeting:addAttendee',
    async (_, { noteId, personId }: { noteId: NoteId; personId: NoteId }) => {
      if (!vault) {
        throw new ScribeError(ErrorCode.VAULT_NOT_INITIALIZED, 'Vault not initialized');
      }

      const note = vault.read(noteId);
      if (note.type !== 'meeting') {
        throw new ScribeError(ErrorCode.VALIDATION_ERROR, 'Note is not a meeting');
      }

      const attendees = note.meeting?.attendees ?? [];
      if (attendees.includes(personId)) {
        return { success: true }; // Already added, idempotent
      }

      const updatedNote = {
        ...note,
        meeting: {
          ...note.meeting!,
          attendees: [...attendees, personId],
        },
      };

      await vault.save(updatedNote);
      return { success: true };
    }
  );

  /**
   * Remove a person from a meeting's attendees.
   * Idempotent: removing non-existent attendee has no effect.
   */
  ipcMain.handle(
    'meeting:removeAttendee',
    async (_, { noteId, personId }: { noteId: NoteId; personId: NoteId }) => {
      if (!vault) {
        throw new ScribeError(ErrorCode.VAULT_NOT_INITIALIZED, 'Vault not initialized');
      }

      const note = vault.read(noteId);
      if (note.type !== 'meeting') {
        throw new ScribeError(ErrorCode.VALIDATION_ERROR, 'Note is not a meeting');
      }

      const attendees = note.meeting?.attendees ?? [];
      const updatedNote = {
        ...note,
        meeting: {
          ...note.meeting!,
          attendees: attendees.filter((id) => id !== personId),
        },
      };

      await vault.save(updatedNote);
      return { success: true };
    }
  );

  // ============================================
  // Task Handlers
  // ============================================

  /**
   * Toggle a task's completion state.
   *
   * This is the write path for task completion:
   * 1. Load note from vault
   * 2. Find checklist node by nodeKey (fallback: textHash, lineIndex)
   * 3. Toggle __checked property on the Lexical listitem node
   * 4. Save note via existing persistence path
   * 5. Update TaskIndex (completedAt set/cleared)
   * 6. Handle conflicts/missing tasks with error
   */
  ipcMain.handle('tasks:toggle', async (_, { taskId }: { taskId: string }) => {
    try {
      if (!vault) {
        return { success: false, error: 'Vault not initialized' };
      }
      if (!taskIndex) {
        return { success: false, error: 'Task index not initialized' };
      }
      if (!graphEngine) {
        return { success: false, error: 'Graph engine not initialized' };
      }
      if (!searchEngine) {
        return { success: false, error: 'Search engine not initialized' };
      }

      // Get task from index
      const task = taskIndex.get(taskId);
      if (!task) {
        return { success: false, error: 'Task not found' };
      }

      // Load note
      let note: Note;
      try {
        note = vault.read(task.noteId);
      } catch {
        // Task's note was deleted - remove from index
        const changes = taskIndex.removeNote(task.noteId);
        mainWindow?.webContents.send('tasks:changed', changes);
        return { success: false, error: 'Note not found' };
      }

      // Find and toggle the checklist node in Lexical content
      const toggled = toggleChecklistNode(note.content, {
        nodeKey: task.nodeKey,
        textHash: task.textHash,
        lineIndex: task.lineIndex,
      });

      if (!toggled) {
        // Task no longer exists in note - remove from index and re-index
        const removeChanges = taskIndex.removeNote(task.noteId);
        const addChanges = taskIndex.indexNote(note);
        const allChanges = [...removeChanges, ...addChanges];
        mainWindow?.webContents.send('tasks:changed', allChanges);
        return { success: false, error: 'Task no longer exists in note' };
      }

      // Save note
      await vault.save(note);

      // Update graph and search (in case content affects metadata)
      graphEngine.addNote(note);
      searchEngine.indexNote(note);

      // Re-index to update completedAt
      const changes = taskIndex.indexNote(note);
      mainWindow?.webContents.send('tasks:changed', changes);

      const updatedTask = taskIndex.get(taskId);
      return { success: true, task: updatedTask };
    } catch (error) {
      console.error('[tasks:toggle] Error:', error);
      return { success: false, error: String(error) };
    }
  });

  /**
   * List tasks with optional filtering.
   */
  ipcMain.handle('tasks:list', async (_, filter?: TaskFilter) => {
    if (!taskIndex) {
      throw new Error('Task index not initialized');
    }
    return taskIndex.list(filter);
  });

  /**
   * Get a single task by ID.
   */
  ipcMain.handle('tasks:get', async (_, { taskId }: { taskId: string }) => {
    if (!taskIndex) {
      throw new Error('Task index not initialized');
    }
    return taskIndex.get(taskId) ?? null;
  });

  /**
   * Reorder tasks by priority.
   */
  ipcMain.handle('tasks:reorder', async (_, { taskIds }: { taskIds: string[] }) => {
    if (!taskIndex) {
      throw new Error('Task index not initialized');
    }
    taskIndex.reorder(taskIds);
    mainWindow?.webContents.send('tasks:changed', [{ type: 'reordered', taskIds }]);
    return { success: true };
  });
}

// ============================================================================
// Checklist Node Toggle Helper
// ============================================================================

/**
 * Locator for finding a checklist node in Lexical content.
 */
interface ChecklistNodeLocator {
  /** Lexical node key (primary anchor) */
  nodeKey: string;
  /** SHA-256 hash of task text (fallback) */
  textHash: string;
  /** List item block ordinal (last resort fallback) */
  lineIndex: number;
}

/**
 * Toggle the __checked property on a checklist listitem node.
 *
 * Uses fallback chain: nodeKey -> textHash -> lineIndex
 *
 * @param content - The Lexical state to modify (mutates in place)
 * @param locator - Locator to find the target node
 * @returns true if toggle succeeded, false if node not found
 */
function toggleChecklistNode(content: LexicalState, locator: ChecklistNodeLocator): boolean {
  if (!content?.root?.children) {
    return false;
  }

  // Track candidates for fallback matching
  let textHashMatch: LexicalNode | null = null;
  let lineIndexMatch: LexicalNode | null = null;
  let currentLineIndex = 0;

  // First pass: try to find by nodeKey (most reliable)
  const nodeKeyResult = findNodeByKey(content.root.children, locator.nodeKey);
  if (nodeKeyResult) {
    return toggleNode(nodeKeyResult);
  }

  // Second pass: collect fallback candidates
  traverseNodes(content.root.children, (node) => {
    if (node.type === 'listitem' && '__checked' in node) {
      // Check textHash match
      const text = extractTextFromNode(node);
      const hash = computeTextHash(text);
      if (hash === locator.textHash && !textHashMatch) {
        textHashMatch = node;
      }

      // Track lineIndex
      if (currentLineIndex === locator.lineIndex && !lineIndexMatch) {
        lineIndexMatch = node;
      }
    }

    // Count all listitems for lineIndex tracking
    if (node.type === 'listitem') {
      currentLineIndex++;
    }
  });

  // Try textHash fallback
  if (textHashMatch) {
    return toggleNode(textHashMatch);
  }

  // Try lineIndex fallback (least reliable)
  if (lineIndexMatch) {
    return toggleNode(lineIndexMatch);
  }

  return false;
}

/**
 * Find a node by its __key property.
 */
function findNodeByKey(nodes: LexicalNode[], nodeKey: string): LexicalNode | null {
  for (const node of nodes) {
    if (node.__key === nodeKey) {
      return node;
    }
    if (Array.isArray(node.children)) {
      const found = findNodeByKey(node.children as LexicalNode[], nodeKey);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Traverse all nodes in a Lexical tree.
 */
function traverseNodes(nodes: LexicalNode[], callback: (node: LexicalNode) => void): void {
  for (const node of nodes) {
    callback(node);
    if (Array.isArray(node.children)) {
      traverseNodes(node.children as LexicalNode[], callback);
    }
  }
}

/**
 * Extract text content from a node and its children.
 */
function extractTextFromNode(node: LexicalNode): string {
  const textParts: string[] = [];
  traverseNodes([node], (n) => {
    if (n.type === 'text' && typeof n.text === 'string') {
      textParts.push(n.text as string);
    }
  });
  return textParts.join('');
}

/**
 * Toggle the __checked property on a checklist node.
 */
function toggleNode(node: LexicalNode): boolean {
  if (node.type === 'listitem' && '__checked' in node) {
    node.__checked = !node.__checked;
    return true;
  }
  return false;
}

function createWindow() {
  // Set window icon for Windows (macOS uses dock icon, Linux uses desktop file)
  const iconPath =
    process.platform === 'win32' ? path.join(__dirname, '../../../build/icon.ico') : undefined;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: true,
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
    // __dirname is electron/main/dist, so we need to go up 3 levels to reach renderer/dist
    mainWindow.loadFile(path.join(__dirname, '../../../renderer/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Setup context menu for spellcheck and editing operations
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu();

    // Add spelling suggestions if there's a misspelled word
    if (params.misspelledWord) {
      // Add spelling suggestions
      for (const suggestion of params.dictionarySuggestions) {
        menu.append(
          new MenuItem({
            label: suggestion,
            click: () => mainWindow?.webContents.replaceMisspelling(suggestion),
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
            mainWindow?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
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

  // Only enable auto-updates in production
  if (!isDev && mainWindow) {
    setupAutoUpdater(mainWindow);
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
      console.error('[main] Failed to set dock icon:', err);
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
  if (taskIndex) {
    try {
      await taskIndex.flush();
      console.log('Task index flushed successfully');
    } catch (error) {
      console.error('Failed to flush task index:', error);
    }
  }
});
