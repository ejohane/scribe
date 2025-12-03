import { contextBridge, ipcRenderer } from 'electron';
import type { Note, NoteId, SearchResult, GraphNode } from '@scribe/shared';

/**
 * Scribe API exposed to the renderer process
 *
 * This is the complete API surface that the renderer can use to interact
 * with the engine via IPC. All privileged operations are routed through
 * this secure boundary.
 */
const scribeAPI = {
  // Ping test API
  ping: (): Promise<{ message: string; timestamp: number }> => ipcRenderer.invoke('ping'),

  // Notes API
  notes: {
    /**
     * List all notes
     */
    list: (): Promise<Note[]> => ipcRenderer.invoke('notes:list'),

    /**
     * Read a single note by ID
     */
    read: (id: NoteId): Promise<Note> => ipcRenderer.invoke('notes:read', id),

    /**
     * Create a new note
     */
    create: (): Promise<Note> => ipcRenderer.invoke('notes:create'),

    /**
     * Save a note (create or update)
     */
    save: (note: Note): Promise<{ success: boolean }> => ipcRenderer.invoke('notes:save', note),

    /**
     * Delete a note by ID
     */
    delete: (id: NoteId): Promise<{ success: boolean }> => ipcRenderer.invoke('notes:delete', id),

    /**
     * Find a note by title (for wiki-link resolution)
     * Returns exact match first, then case-insensitive match.
     * If multiple matches, returns the most recently updated note.
     */
    findByTitle: (title: string): Promise<Note | null> =>
      ipcRenderer.invoke('notes:findByTitle', title),

    /**
     * Search note titles (for wiki-link autocomplete)
     * Returns notes whose titles contain the query string.
     */
    searchTitles: (query: string, limit?: number): Promise<SearchResult[]> =>
      ipcRenderer.invoke('notes:searchTitles', query, limit ?? 10),

    /**
     * Find notes by creation/update date (for date-based linked mentions)
     * @param date - Date string in "MM-dd-yyyy" format
     * @param includeCreated - Include notes created on this date
     * @param includeUpdated - Include notes updated on this date
     * @returns Array of notes with their match reason ('created' | 'updated')
     */
    findByDate: (
      date: string,
      includeCreated: boolean,
      includeUpdated: boolean
    ): Promise<Array<{ note: Note; reason: 'created' | 'updated' }>> =>
      ipcRenderer.invoke('notes:findByDate', { date, includeCreated, includeUpdated }),
  },

  // Search API (placeholder for future implementation)
  search: {
    /**
     * Search notes by text query
     */
    query: (text: string): Promise<SearchResult[]> => ipcRenderer.invoke('search:query', text),
  },

  // Graph API
  graph: {
    /**
     * Get graph neighbors for a note (both incoming and outgoing connections)
     */
    forNote: (id: NoteId): Promise<GraphNode[]> => ipcRenderer.invoke('graph:forNote', id),

    /**
     * Get backlinks for a note (notes that link to this note)
     */
    backlinks: (id: NoteId): Promise<GraphNode[]> => ipcRenderer.invoke('graph:backlinks', id),

    /**
     * Get all notes with a specific tag
     */
    notesWithTag: (tag: string): Promise<GraphNode[]> =>
      ipcRenderer.invoke('graph:notesWithTag', tag),
  },

  // Shell API
  shell: {
    /**
     * Open a URL in the default external browser
     * Only http:// and https:// URLs are allowed
     */
    openExternal: (url: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('shell:openExternal', url),
  },

  // App API
  app: {
    /**
     * Open developer tools
     */
    openDevTools: (): Promise<{ success: boolean }> => ipcRenderer.invoke('app:openDevTools'),

    /**
     * Get the last opened note ID
     */
    getLastOpenedNote: (): Promise<NoteId | null> => ipcRenderer.invoke('app:getLastOpenedNote'),

    /**
     * Set the last opened note ID
     */
    setLastOpenedNote: (noteId: NoteId | null): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('app:setLastOpenedNote', noteId),

    /**
     * Get app configuration
     */
    getConfig: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('app:getConfig'),

    /**
     * Set app configuration (merges with existing)
     */
    setConfig: (config: Record<string, unknown>): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('app:setConfig', config),
  },

  // People API
  people: {
    /**
     * List all people
     */
    list: (): Promise<Note[]> => ipcRenderer.invoke('people:list'),

    /**
     * Create a new person
     */
    create: (name: string): Promise<Note> => ipcRenderer.invoke('people:create', name),

    /**
     * Search people by name (for autocomplete)
     */
    search: (query: string, limit?: number): Promise<SearchResult[]> =>
      ipcRenderer.invoke('people:search', query, limit ?? 10),
  },

  /**
   * Daily note operations
   */
  daily: {
    /**
     * Get or create today's daily note.
     * Idempotent: returns same note on repeat calls within same day.
     */
    getOrCreate: (): Promise<Note> => ipcRenderer.invoke('daily:getOrCreate'),

    /**
     * Find daily note for a specific date.
     * @param date - ISO date string "YYYY-MM-DD"
     * @returns The daily note or null if not found
     */
    find: (date: string): Promise<Note | null> => ipcRenderer.invoke('daily:find', { date }),
  },

  /**
   * Meeting note operations
   */
  meeting: {
    /**
     * Create a new meeting note for today.
     * Auto-creates daily note if needed and links the meeting to it.
     * @param title - The meeting title (required, cannot be empty)
     */
    create: (title: string): Promise<Note> => ipcRenderer.invoke('meeting:create', { title }),

    /**
     * Add a person as attendee to a meeting.
     * Idempotent: adding same person twice has no effect.
     * @param noteId - The meeting note ID
     * @param personId - The person note ID to add
     */
    addAttendee: (noteId: NoteId, personId: NoteId): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('meeting:addAttendee', { noteId, personId }),

    /**
     * Remove a person from a meeting's attendees.
     * Idempotent: removing non-existent attendee has no effect.
     * @param noteId - The meeting note ID
     * @param personId - The person note ID to remove
     */
    removeAttendee: (noteId: NoteId, personId: NoteId): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('meeting:removeAttendee', { noteId, personId }),
  },
};

// Expose the API to the renderer via contextBridge
contextBridge.exposeInMainWorld('scribe', scribeAPI);

// Type declaration for TypeScript support in renderer
export type ScribeAPI = typeof scribeAPI;
