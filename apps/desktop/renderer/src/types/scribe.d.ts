/**
 * Type definitions for the Scribe API exposed via contextBridge.
 *
 * This file augments the global Window interface with the ScribeAPI type
 * from the shared IPC contract. The contract in @scribe/shared is the
 * single source of truth for the IPC API surface.
 *
 * @see packages/shared/src/ipc-contract.ts for API documentation
 */

import type { ScribeAPI, DateBasedNoteResult } from '@scribe/shared';

// Re-export types that renderer code may need to import
export type { ScribeAPI, DateBasedNoteResult };

// Re-export namespace interfaces for backward compatibility
export type {
  NotesAPI,
  SearchAPI,
  GraphAPI,
  ShellAPI,
  AppAPI,
  PeopleAPI,
  DailyAPI,
  MeetingAPI,
  DictionaryAPI,
  TasksAPI,
  UpdateAPI,
} from '@scribe/shared';

declare global {
  /** App version injected at build time by Vite */
  const __APP_VERSION__: string;

  interface Window {
    scribe: ScribeAPI;
  }
}

export {};
