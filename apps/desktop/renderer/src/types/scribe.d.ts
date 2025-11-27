// Type definitions for the Scribe API exposed via contextBridge

import type { Note, NoteId, SearchResult, GraphNode } from '@scribe/shared';

export interface PeopleAPI {
  /** List all people */
  list(): Promise<Note[]>;

  /** Create a new person with the given name */
  create(name: string): Promise<Note>;

  /** Search people by name (for autocomplete) */
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

export interface ScribeAPI {
  ping: () => Promise<{ message: string; timestamp: number }>;
  notes: {
    list: () => Promise<Note[]>;
    read: (id: NoteId) => Promise<Note>;
    save: (note: Note) => Promise<{ success: boolean }>;
    create: () => Promise<Note>;
    delete: (id: NoteId) => Promise<{ success: boolean }>;
    findByTitle: (title: string) => Promise<Note | null>;
    searchTitles: (query: string, limit?: number) => Promise<SearchResult[]>;
  };
  search: {
    query: (text: string) => Promise<SearchResult[]>;
  };
  graph: {
    forNote: (id: NoteId) => Promise<GraphNode[]>;
    backlinks: (id: NoteId) => Promise<GraphNode[]>;
    notesWithTag: (tag: string) => Promise<GraphNode[]>;
  };
  app: {
    openDevTools: () => Promise<{ success: boolean }>;
    getLastOpenedNote: () => Promise<NoteId | null>;
    setLastOpenedNote: (noteId: NoteId | null) => Promise<{ success: boolean }>;
    getConfig: () => Promise<Record<string, unknown>>;
    setConfig: (config: Record<string, unknown>) => Promise<{ success: boolean }>;
  };
  people: PeopleAPI;
}

declare global {
  interface Window {
    scribe: ScribeAPI;
  }
}

export {};
