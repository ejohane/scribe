/**
 * Type definitions for Scribe CLI responses
 */

// Common note shape used across responses
export interface NoteReference {
  id: string;
  title: string;
  url: string;
}

// Daily show response
export interface DailyShowResponse {
  date: string;
  note: {
    id: string;
    title: string;
    url: string;
    content: {
      text: string;
      format: string;
    };
  } | null;
  found: boolean;
}

// Daily create response
export interface DailyCreateResponse {
  date: string;
  note: {
    id: string;
    title: string;
    createdAt: string;
    url: string;
  };
  created: boolean;
}

// Daily append response
export interface DailyAppendResponse {
  success: boolean;
  date: string;
  note: NoteReference;
  created: boolean;
  appended: {
    text: string;
    source: string;
  };
}

// Search response
export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  score: number;
  matches: Array<{
    field: string;
    count: number;
  }>;
  url: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

// People list response
export interface Person {
  id: string;
  name: string;
  mentionCount: number;
  lastMentioned: number;
  url: string;
}

export interface PeopleListResponse {
  people: Person[];
  total: number;
}

// Notes list response (for recent notes)
export interface NoteListItem {
  id: string;
  title: string;
  type?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface NotesListResponse {
  notes: NoteListItem[];
  total: number;
  limit: number;
  offset: number;
}

// Open command response
export interface OpenResponse {
  success: boolean;
  noteId?: string;
  title?: string;
  url?: string;
  action?: string;
  error?: string;
  date?: string;
}

// Raycast preferences
export interface Preferences {
  vaultPath?: string;
  cliPath?: string;
}
