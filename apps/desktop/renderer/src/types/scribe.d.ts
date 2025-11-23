// Type definitions for the Scribe API exposed via contextBridge

import type { Note, NoteId, SearchResult } from '@scribe/shared';

export interface ScribeAPI {
  ping: () => Promise<{ message: string; timestamp: number }>;
  notes: {
    list: () => Promise<Note[]>;
    read: (id: NoteId) => Promise<Note>;
    save: (note: Note) => Promise<{ success: boolean }>;
    create: () => Promise<Note>;
  };
  search: {
    query: (text: string) => Promise<SearchResult[]>;
  };
  graph: {
    forNote: (id: NoteId) => Promise<NoteId[]>;
    backlinks: (id: NoteId) => Promise<NoteId[]>;
  };
}

declare global {
  interface Window {
    scribe: ScribeAPI;
  }
}

export {};
