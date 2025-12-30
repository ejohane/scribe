/**
 * IPC Contract: Single source of truth for Scribe's Electron IPC surface
 *
 * This module defines all IPC channel names and typed interfaces for communication
 * between the renderer process and main process via the preload bridge.
 *
 * Usage:
 * - Preload: Import and implement using `createPreloadBridge()`
 * - Renderer types: Re-export `ScribeAPI` for ambient type declarations
 * - Main process: Reference channel names for handler registration
 *
 * @module @scribe/shared/ipc-contract
 * @since 1.0.0
 */

import type {
  Note,
  NoteId,
  SearchResult,
  GraphNode,
  Task,
  TaskFilter,
  TaskChangeEvent,
} from './types.js';

import type { SyncStatus, SyncResult, SyncConflict, ConflictResolution } from './sync-types.js';

// ============================================================================
// Recent Opens Types
// ============================================================================

/** Entity types that can be tracked for recent opens */
export type RecentOpenEntityType = 'note' | 'meeting' | 'person' | 'daily';

/** Record of a recently opened entity */
export interface RecentOpenRecord {
  /** Unique identifier of the entity */
  entityId: string;
  /** Type of the entity */
  entityType: RecentOpenEntityType;
  /** Unix timestamp in milliseconds when the entity was last opened */
  openedAt: number;
}

/** API for recent opens tracking */
export interface RecentOpensAPI {
  /**
   * Record that an entity was opened.
   * Performs an upsert: creates a new record or updates the timestamp if already tracked.
   *
   * @param entityId - Unique identifier of the entity
   * @param entityType - Type of the entity being opened
   * @returns Success status
   */
  recordOpen(entityId: string, entityType: RecentOpenEntityType): Promise<{ success: boolean }>;

  /**
   * Get the N most recently opened entities.
   *
   * @param limit - Maximum number of records to return (default: 10)
   * @returns Array of recent open records sorted by openedAt descending
   */
  getRecent(limit?: number): Promise<RecentOpenRecord[]>;

  /**
   * Remove tracking for a deleted entity.
   * Should be called when an entity is permanently deleted.
   *
   * @param entityId - Unique identifier of the entity to remove
   * @returns Success status
   */
  removeTracking(entityId: string): Promise<{ success: boolean }>;
}

// ============================================================================
// IPC Channel Names
// ============================================================================

/**
 * All IPC channel names used by the Scribe application.
 * These are the string identifiers passed to ipcRenderer.invoke/send.
 */
export const IPC_CHANNELS = {
  // Core
  PING: 'ping',

  // Notes
  NOTES_LIST: 'notes:list',
  NOTES_READ: 'notes:read',
  NOTES_CREATE: 'notes:create',
  NOTES_SAVE: 'notes:save',
  NOTES_DELETE: 'notes:delete',
  NOTES_FIND_BY_TITLE: 'notes:findByTitle',
  NOTES_SEARCH_TITLES: 'notes:searchTitles',
  NOTES_FIND_BY_DATE: 'notes:findByDate',

  // Search
  SEARCH_QUERY: 'search:query',

  // Graph
  GRAPH_FOR_NOTE: 'graph:forNote',
  GRAPH_BACKLINKS: 'graph:backlinks',
  GRAPH_NOTES_WITH_TAG: 'graph:notesWithTag',

  // Shell
  SHELL_OPEN_EXTERNAL: 'shell:openExternal',

  // App
  APP_OPEN_DEV_TOOLS: 'app:openDevTools',
  APP_GET_LAST_OPENED_NOTE: 'app:getLastOpenedNote',
  APP_SET_LAST_OPENED_NOTE: 'app:setLastOpenedNote',
  APP_GET_CONFIG: 'app:getConfig',
  APP_SET_CONFIG: 'app:setConfig',
  APP_RELAUNCH: 'app:relaunch',

  // People
  PEOPLE_LIST: 'people:list',
  PEOPLE_CREATE: 'people:create',
  PEOPLE_SEARCH: 'people:search',

  // Daily
  DAILY_GET_OR_CREATE: 'daily:getOrCreate',
  DAILY_FIND: 'daily:find',

  // Meeting
  MEETING_CREATE: 'meeting:create',
  MEETING_ADD_ATTENDEE: 'meeting:addAttendee',
  MEETING_REMOVE_ATTENDEE: 'meeting:removeAttendee',

  // Dictionary
  DICTIONARY_ADD_WORD: 'dictionary:addWord',
  DICTIONARY_REMOVE_WORD: 'dictionary:removeWord',
  DICTIONARY_GET_LANGUAGES: 'dictionary:getLanguages',
  DICTIONARY_SET_LANGUAGES: 'dictionary:setLanguages',
  DICTIONARY_GET_AVAILABLE_LANGUAGES: 'dictionary:getAvailableLanguages',

  // Tasks
  TASKS_LIST: 'tasks:list',
  TASKS_TOGGLE: 'tasks:toggle',
  TASKS_REORDER: 'tasks:reorder',
  TASKS_GET: 'tasks:get',
  TASKS_CHANGED: 'tasks:changed',

  // Update
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install',
  UPDATE_CHECKING: 'update:checking',
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_NOT_AVAILABLE: 'update:not-available',
  UPDATE_DOWNLOADED: 'update:downloaded',
  UPDATE_ERROR: 'update:error',

  // CLI
  CLI_INSTALL: 'cli:install',
  CLI_IS_INSTALLED: 'cli:is-installed',
  CLI_UNINSTALL: 'cli:uninstall',
  CLI_GET_STATUS: 'cli:get-status',

  // Export
  EXPORT_TO_MARKDOWN: 'export:toMarkdown',

  // Dialog
  DIALOG_SELECT_FOLDER: 'dialog:selectFolder',

  // Vault
  VAULT_GET_PATH: 'vault:getPath',
  VAULT_SET_PATH: 'vault:setPath',
  VAULT_CREATE: 'vault:create',
  VAULT_VALIDATE: 'vault:validate',

  // Sync
  SYNC_GET_STATUS: 'sync:getStatus',
  SYNC_TRIGGER: 'sync:trigger',
  SYNC_GET_CONFLICTS: 'sync:getConflicts',
  SYNC_RESOLVE_CONFLICT: 'sync:resolveConflict',
  SYNC_ENABLE: 'sync:enable',
  SYNC_DISABLE: 'sync:disable',
  SYNC_STATUS_CHANGED: 'sync:statusChanged',

  // Recent Opens
  RECENT_OPENS_RECORD: 'recentOpens:record',
  RECENT_OPENS_GET: 'recentOpens:get',
  RECENT_OPENS_REMOVE: 'recentOpens:remove',
} as const;

// ============================================================================
// API Response Types
// ============================================================================

/** Standard success response for mutating operations */
export interface SuccessResponse {
  success: boolean;
}

/** Result from findByDate API - a note with the reason it matched */
export interface DateBasedNoteResult {
  note: Note;
  reason: 'created' | 'updated';
}

/** Update info payload */
export interface UpdateInfo {
  version: string;
}

/** Update error payload */
export interface UpdateError {
  message: string;
}

/**
 * Result of an export operation
 */
export interface ExportResult {
  /** Whether the export succeeded */
  success: boolean;
  /** Path where file was saved (if successful and not cancelled) */
  filePath?: string;
  /** Whether the user cancelled the save dialog */
  cancelled?: boolean;
  /** Error message if export failed */
  error?: string;
}

// ============================================================================
// API Namespace Interfaces
// ============================================================================

/**
 * Notes API for CRUD operations on notes
 */
export interface NotesAPI {
  /** List all notes */
  list(): Promise<Note[]>;

  /** Read a single note by ID */
  read(id: NoteId): Promise<Note>;

  /** Create a new note */
  create(): Promise<Note>;

  /** Save a note (create or update) */
  save(note: Note): Promise<SuccessResponse>;

  /** Delete a note by ID */
  delete(id: NoteId): Promise<SuccessResponse>;

  /**
   * Find a note by title (for wiki-link resolution)
   * Returns exact match first, then case-insensitive match.
   * If multiple matches, returns the most recently updated note.
   */
  findByTitle(title: string): Promise<Note | null>;

  /**
   * Search note titles (for wiki-link autocomplete)
   * Returns notes whose titles contain the query string.
   */
  searchTitles(query: string, limit?: number): Promise<SearchResult[]>;

  /**
   * Find notes by creation/update date (for date-based linked mentions)
   * @param date - Date string in "MM-dd-yyyy" format
   * @param includeCreated - Include notes created on this date
   * @param includeUpdated - Include notes updated on this date
   * @returns Array of notes with their match reason ('created' | 'updated')
   */
  findByDate(
    date: string,
    includeCreated: boolean,
    includeUpdated: boolean
  ): Promise<DateBasedNoteResult[]>;
}

/**
 * Search API for full-text search operations
 */
export interface SearchAPI {
  /** Search notes by text query */
  query(text: string): Promise<SearchResult[]>;
}

/**
 * Graph API for note relationship queries
 */
export interface GraphAPI {
  /** Get graph neighbors for a note (both incoming and outgoing connections) */
  forNote(id: NoteId): Promise<GraphNode[]>;

  /** Get backlinks for a note (notes that link to this note) */
  backlinks(id: NoteId): Promise<GraphNode[]>;

  /** Get all notes with a specific tag */
  notesWithTag(tag: string): Promise<GraphNode[]>;
}

/**
 * Shell API for system-level operations
 */
export interface ShellAPI {
  /**
   * Open a URL in the system's default browser.
   * Only http:// and https:// URLs are allowed for security.
   */
  openExternal(url: string): Promise<SuccessResponse>;
}

/**
 * App API for application-level operations
 */
export interface AppAPI {
  /** Open developer tools */
  openDevTools(): Promise<SuccessResponse>;

  /** Get the last opened note ID */
  getLastOpenedNote(): Promise<NoteId | null>;

  /** Set the last opened note ID */
  setLastOpenedNote(noteId: NoteId | null): Promise<SuccessResponse>;

  /** Get app configuration */
  getConfig(): Promise<Record<string, unknown>>;

  /** Set app configuration (merges with existing) */
  setConfig(config: Record<string, unknown>): Promise<SuccessResponse>;

  /** Relaunch the application (for vault switching and updates) */
  relaunch(): Promise<void>;
}

/**
 * People API for managing person notes
 */
export interface PeopleAPI {
  /** List all people */
  list(): Promise<Note[]>;

  /** Create a new person with the given name */
  create(name: string): Promise<Note>;

  /** Search people by name (for autocomplete) */
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

/**
 * Daily note API operations
 */
export interface DailyAPI {
  /**
   * Get or create a daily note for a specific date.
   * If no date is provided, uses today's date.
   * Idempotent: returns same note on repeat calls for the same date.
   * @param date - Optional date to get/create the daily note for
   */
  getOrCreate(date?: Date): Promise<Note>;

  /**
   * Find daily note for a specific date.
   * @param date - ISO date string "YYYY-MM-DD"
   * @returns The daily note or null if not found
   */
  find(date: string): Promise<Note | null>;
}

/**
 * Meeting note API operations
 */
export interface MeetingAPI {
  /**
   * Create a new meeting note for a specific date.
   * Auto-creates the daily note for that date if needed and links the meeting to it.
   *
   * @param title - The meeting title (required, cannot be empty)
   * @param date - Optional ISO date string (YYYY-MM-DD). Defaults to today if not provided.
   * @returns The newly created meeting note
   *
   * @example
   * // Create meeting for today (default)
   * const note = await window.scribe.meeting.create('Sprint Planning');
   *
   * @example
   * // Create meeting for a specific date
   * const note = await window.scribe.meeting.create('Retro', '2025-12-25');
   */
  create(title: string, date?: string): Promise<Note>;

  /**
   * Add a person as attendee to a meeting.
   * Idempotent: adding same person twice has no effect.
   * @param noteId - The meeting note ID
   * @param personId - The person note ID to add
   */
  addAttendee(noteId: NoteId, personId: NoteId): Promise<SuccessResponse>;

  /**
   * Remove a person from a meeting's attendees.
   * Idempotent: removing non-existent attendee has no effect.
   * @param noteId - The meeting note ID
   * @param personId - The person note ID to remove
   */
  removeAttendee(noteId: NoteId, personId: NoteId): Promise<SuccessResponse>;
}

/**
 * Dictionary/Spellcheck API for managing custom dictionary
 */
export interface DictionaryAPI {
  /** Add a word to the spellcheck dictionary */
  addWord(word: string): Promise<SuccessResponse>;

  /** Remove a word from the spellcheck dictionary */
  removeWord(word: string): Promise<SuccessResponse>;

  /** Get the currently active spellcheck languages */
  getLanguages(): Promise<string[]>;

  /** Set the active spellcheck languages */
  setLanguages(languages: string[]): Promise<SuccessResponse>;

  /** Get all available spellcheck languages that can be enabled */
  getAvailableLanguages(): Promise<string[]>;
}

/**
 * Tasks API for task management
 */
export interface TasksAPI {
  /**
   * List tasks with optional filtering and pagination
   * @param filter - Optional filter criteria
   * @returns Tasks and optional nextCursor for pagination
   */
  list(filter?: TaskFilter): Promise<{ tasks: Task[]; nextCursor?: string }>;

  /**
   * Toggle a task's completion state
   * @param taskId - The task ID to toggle
   * @returns Success status and updated task
   */
  toggle(taskId: string): Promise<{ success: boolean; task?: Task; error?: string }>;

  /**
   * Reorder tasks by priority
   * @param taskIds - Array of task IDs in new priority order
   * @returns Success status
   */
  reorder(taskIds: string[]): Promise<SuccessResponse>;

  /**
   * Get a single task by ID
   * @param taskId - The task ID to retrieve
   * @returns The task or null if not found
   */
  get(taskId: string): Promise<Task | null>;

  /**
   * Subscribe to task change events
   * @param callback - Called when tasks change
   * @returns Unsubscribe function for cleanup
   */
  onChange(callback: (events: TaskChangeEvent[]) => void): () => void;
}

/**
 * Update API for auto-update functionality
 */
export interface UpdateAPI {
  /** Manually trigger update check */
  check(): Promise<void>;

  /** Quit and install downloaded update */
  install(): void;

  /** Subscribe to checking event, returns unsubscribe function */
  onChecking(callback: () => void): () => void;

  /** Subscribe to available event with version info */
  onAvailable(callback: (info: UpdateInfo) => void): () => void;

  /** Subscribe to not-available event */
  onNotAvailable(callback: () => void): () => void;

  /** Subscribe to downloaded event with version info */
  onDownloaded(callback: (info: UpdateInfo) => void): () => void;

  /** Subscribe to error event with error message */
  onError(callback: (error: UpdateError) => void): () => void;
}

/**
 * Result of a CLI installation operation.
 */
export interface CLIInstallResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Human-readable message describing the result */
  message: string;
  /** Whether the user needs to add ~/.local/bin to their PATH */
  needsPathSetup?: boolean;
}

/**
 * Status of the CLI installation.
 */
export interface CLIStatus {
  /** Whether the CLI is installed (symlink exists) */
  installed: boolean;
  /** Whether the installed CLI is linked to this app's binary */
  linkedToThisApp: boolean;
  /** Whether the CLI binary exists in the app bundle */
  binaryExists: boolean;
  /** Whether ~/.local/bin is in the user's PATH */
  pathConfigured: boolean;
  /** Path to the CLI binary in the app bundle */
  binaryPath: string;
  /** Target path where the CLI is/will be installed */
  targetPath: string;
}

/**
 * CLI API for managing the Scribe command-line interface
 */
export interface CLIAPI {
  /**
   * Install the CLI by creating a symlink to ~/.local/bin/scribe.
   * The symlink points to the CLI binary in the app bundle.
   */
  install(): Promise<CLIInstallResult>;

  /**
   * Check if the CLI is currently installed.
   */
  isInstalled(): Promise<boolean>;

  /**
   * Uninstall the CLI by removing the symlink.
   * Only removes if the symlink points to this app's binary.
   */
  uninstall(): Promise<CLIInstallResult>;

  /**
   * Get detailed status of the CLI installation.
   */
  getStatus(): Promise<CLIStatus>;
}

/**
 * Export API for saving notes to external formats
 */
export interface ExportAPI {
  /**
   * Export a note to Markdown format.
   * Opens a native file save dialog for the user to choose the destination.
   *
   * @param noteId - ID of the note to export
   * @returns Export result with file path or cancellation status
   */
  toMarkdown(noteId: NoteId): Promise<ExportResult>;
}

/**
 * Options for the folder picker dialog
 */
export interface FolderPickerOptions {
  /** Dialog window title */
  title?: string;
  /** Initial directory to display */
  defaultPath?: string;
}

/**
 * Dialog API for native OS dialogs
 */
export interface DialogAPI {
  /**
   * Open the native OS folder picker dialog.
   *
   * @param options - Optional configuration for the dialog
   * @returns The selected folder path, or null if cancelled
   */
  selectFolder(options?: FolderPickerOptions): Promise<string | null>;
}

/**
 * Result of vault switching operation
 */
export interface VaultSwitchResult {
  success: boolean;
  path: string;
  error?: string;
  /** Whether app restart is required (always true in MVP) */
  requiresRestart?: boolean;
}

/**
 * Result of vault creation operation
 */
export interface VaultCreateResult {
  success: boolean;
  path: string;
  error?: string;
}

/**
 * Result of vault validation
 */
export interface VaultValidationResult {
  valid: boolean;
  missingDirs?: string[];
}

/**
 * Vault API for vault management operations
 */
export interface VaultAPI {
  /**
   * Get the current vault path.
   *
   * @returns The absolute path to the current vault
   */
  getPath(): Promise<string>;

  /**
   * Set the vault path (switch vaults).
   * Note: Requires app restart to take effect.
   *
   * @param path - The new vault path
   * @returns Result of the switch operation
   */
  setPath(path: string): Promise<VaultSwitchResult>;

  /**
   * Create a new vault at the specified path.
   *
   * @param path - Path where to create the vault
   * @returns Result of the creation operation
   */
  create(path: string): Promise<VaultCreateResult>;

  /**
   * Validate if a path is a valid vault.
   *
   * @param path - Path to validate
   * @returns Validation result
   */
  validate(path: string): Promise<VaultValidationResult>;
}

/**
 * Sync API for multi-device synchronization
 */
export interface SyncAPI {
  /**
   * Get the current sync status.
   *
   * @returns Current sync status including state, pending changes, and conflicts
   */
  getStatus(): Promise<SyncStatus>;

  /**
   * Manually trigger a sync cycle.
   * Pushes local changes and pulls remote changes.
   *
   * @returns Result of the sync operation
   */
  trigger(): Promise<SyncResult>;

  /**
   * Get list of unresolved conflicts.
   *
   * @returns Array of conflicts awaiting resolution
   */
  getConflicts(): Promise<SyncConflict[]>;

  /**
   * Resolve a sync conflict.
   *
   * @param noteId - ID of the note with the conflict
   * @param resolution - How to resolve the conflict (keep_local, keep_remote, or keep_both)
   * @returns Success status
   */
  resolveConflict(noteId: string, resolution: ConflictResolution): Promise<{ success: boolean }>;

  /**
   * Enable sync for the current vault.
   *
   * @param options - Sync configuration options
   * @param options.apiKey - API key for authentication
   * @param options.serverUrl - Optional custom server URL
   * @returns Success status with optional error message
   */
  enable(options: {
    apiKey: string;
    serverUrl?: string;
  }): Promise<{ success: boolean; error?: string }>;

  /**
   * Disable sync for the current vault.
   *
   * @returns Success status
   */
  disable(): Promise<{ success: boolean }>;

  /**
   * Subscribe to sync status changes.
   * Called whenever the sync state changes (e.g., idle -> syncing -> idle).
   *
   * @param callback - Function called with new status on each change
   * @returns Unsubscribe function for cleanup
   */
  onStatusChange(callback: (status: SyncStatus) => void): () => void;
}

// ============================================================================
// Complete Scribe API Interface
// ============================================================================

/**
 * Complete Scribe API exposed to the renderer process via contextBridge.
 *
 * This interface is the single source of truth for the IPC API surface.
 * The preload script implements this interface, and the renderer consumes it
 * via `window.scribe`.
 */
export interface ScribeAPI {
  /** Simple ping for testing IPC connectivity */
  ping(): Promise<{ message: string; timestamp: number }>;

  /** Notes CRUD operations */
  notes: NotesAPI;

  /** Full-text search */
  search: SearchAPI;

  /** Graph/relationship queries */
  graph: GraphAPI;

  /** System shell operations */
  shell: ShellAPI;

  /** App-level operations */
  app: AppAPI;

  /** Person note management */
  people: PeopleAPI;

  /** Daily note operations */
  daily: DailyAPI;

  /** Meeting note operations */
  meeting: MeetingAPI;

  /** Dictionary/spellcheck management */
  dictionary: DictionaryAPI;

  /** Task management */
  tasks: TasksAPI;

  /** Auto-update functionality */
  update: UpdateAPI;

  /** CLI installation management */
  cli: CLIAPI;

  /** Export notes to external formats */
  export: ExportAPI;

  /** Native OS dialogs */
  dialog: DialogAPI;

  /** Vault management */
  vault: VaultAPI;

  /** Sync API for multi-device synchronization */
  sync: SyncAPI;

  /** Recent opens tracking */
  recentOpens: RecentOpensAPI;
}
