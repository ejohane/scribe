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

// ============================================================================
// Test Utilities
// ============================================================================
// These types help create type-safe partial mocks of the ScribeAPI in tests.
// Instead of using `(window as any).scribe`, use these utility types.
// ============================================================================

/**
 * Utility type that makes all properties and nested properties optional.
 * Useful for creating partial mocks in tests.
 *
 * @example
 * ```typescript
 * const partialMock: DeepPartial<ScribeAPI> = {
 *   notes: {
 *     list: vi.fn().mockResolvedValue([]),
 *   },
 * };
 * ```
 */
export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

/**
 * Partial mock type for ScribeAPI.
 * All namespaces and their methods are optional, making it easy to mock
 * only the methods your test needs.
 *
 * @example
 * ```typescript
 * import type { MockScribeAPI } from './types/scribe';
 *
 * const mock: MockScribeAPI = {
 *   notes: {
 *     read: vi.fn().mockResolvedValue(mockNote),
 *     save: vi.fn().mockResolvedValue({ success: true }),
 *   },
 *   app: {
 *     getLastOpenedNote: vi.fn().mockResolvedValue(null),
 *   },
 * };
 * window.scribe = mock as ScribeAPI;
 * ```
 */
export type MockScribeAPI = DeepPartial<ScribeAPI>;

/**
 * Helper function type signature for setting up window.scribe mock.
 * Tests can use this to create type-safe partial mocks.
 *
 * @example
 * ```typescript
 * function setupScribeMock(mock: MockScribeAPI): void {
 *   window.scribe = mock as ScribeAPI;
 * }
 *
 * // In test:
 * setupScribeMock({
 *   notes: { list: vi.fn().mockResolvedValue([]) },
 * });
 * ```
 */
export type SetupScribeMock = (mock: MockScribeAPI) => void;

declare global {
  /** App version injected at build time by Vite */
  const __APP_VERSION__: string;

  interface Window {
    scribe: ScribeAPI;
  }
}

export {};
