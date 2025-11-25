/**
 * Shared test utilities for CommandPalette tests
 *
 * This file contains:
 * - Mock note factory functions
 * - Default mock commands
 * - Shared constants
 * - Helper functions
 */

import { vi } from 'vitest';
import type { Note } from '@scribe/shared';
import type { Command } from '../../commands/types';

// Base timestamps for creating ordered notes
export const BASE_TIME = Date.now();

/**
 * Helper to create mock notes with specific properties
 */
export function createMockNote(overrides: Partial<Note> & { id: string }): Note {
  const now = Date.now();
  // Check if title was explicitly provided in metadata (including null)
  const hasExplicitTitle = overrides.metadata && 'title' in overrides.metadata;
  return {
    id: overrides.id,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    content: overrides.content ?? {
      root: {
        type: 'root',
        children: [],
      },
    },
    metadata: {
      title: hasExplicitTitle ? overrides.metadata!.title : `Note ${overrides.id}`,
      tags: overrides.metadata?.tags ?? [],
      links: overrides.metadata?.links ?? [],
    },
  };
}

/**
 * Default mock commands for tests
 */
export const mockCommands: Command[] = [
  {
    id: 'new-note',
    title: 'New Note',
    description: 'Create a new note',
    run: vi.fn(),
  },
  {
    id: 'open-note',
    title: 'Open Note',
    description: 'Open an existing note',
    run: vi.fn(),
  },
];

/**
 * Setup default window.scribe mock
 */
export function setupScribeMock(): void {
  (window as any).scribe = {
    notes: {
      list: vi.fn().mockResolvedValue([]),
    },
    search: {
      query: vi.fn().mockResolvedValue([]),
    },
  };
}

/**
 * Helper to wait for debounce (real timers)
 */
export const waitForDebounce = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 200)); // 150ms debounce + buffer
