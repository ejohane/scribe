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

/**
 * Daily note API operations
 */
export interface DailyAPI {
  /**
   * Get or create today's daily note.
   * Idempotent: returns same note on repeat calls within same day.
   */
  getOrCreate(): Promise<Note>;

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
   * Create a new meeting note for today.
   * Auto-creates daily note if needed and links the meeting to it.
   * @param title - The meeting title (required, cannot be empty)
   */
  create(title: string): Promise<Note>;

  /**
   * Add a person as attendee to a meeting.
   * Idempotent: adding same person twice has no effect.
   * @param noteId - The meeting note ID
   * @param personId - The person note ID to add
   */
  addAttendee(noteId: NoteId, personId: NoteId): Promise<{ success: boolean }>;

  /**
   * Remove a person from a meeting's attendees.
   * Idempotent: removing non-existent attendee has no effect.
   * @param noteId - The meeting note ID
   * @param personId - The person note ID to remove
   */
  removeAttendee(noteId: NoteId, personId: NoteId): Promise<{ success: boolean }>;
}

/**
 * Result from findByDate API - a note with the reason it matched
 */
export interface DateBasedNoteResult {
  note: Note;
  reason: 'created' | 'updated';
}

/**
 * Shell API for system-level operations
 */
export interface ShellAPI {
  /**
   * Open a URL in the system's default browser.
   * Only http:// and https:// URLs are allowed for security.
   */
  openExternal(url: string): Promise<{ success: boolean }>;
}

export interface ScribeAPI {
  ping: () => Promise<{ message: string; timestamp: number }>;
  shell: ShellAPI;
  notes: {
    list: () => Promise<Note[]>;
    read: (id: NoteId) => Promise<Note>;
    save: (note: Note) => Promise<{ success: boolean }>;
    create: () => Promise<Note>;
    delete: (id: NoteId) => Promise<{ success: boolean }>;
    findByTitle: (title: string) => Promise<Note | null>;
    searchTitles: (query: string, limit?: number) => Promise<SearchResult[]>;
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
    ) => Promise<DateBasedNoteResult[]>;
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
  daily: DailyAPI;
  meeting: MeetingAPI;
}

declare global {
  interface Window {
    scribe: ScribeAPI;
  }
}

export {};
