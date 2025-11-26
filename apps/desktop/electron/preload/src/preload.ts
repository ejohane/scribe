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
};

// Expose the API to the renderer via contextBridge
contextBridge.exposeInMainWorld('scribe', scribeAPI);

// Type declaration for TypeScript support in renderer
export type ScribeAPI = typeof scribeAPI;
