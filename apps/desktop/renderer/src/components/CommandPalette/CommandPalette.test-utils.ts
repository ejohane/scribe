/**
 * Shared test utilities for CommandPalette tests
 *
 * This file contains:
 * - Mock note factory functions
 * - Default mock commands
 * - Shared constants
 * - Helper functions
 * - CSS class name exports for testing
 * - Test IDs for component selection
 */

import { vi } from 'vitest';
import type { Note } from '@scribe/shared';
import type { Command } from '../../commands/types';
import * as styles from './CommandPalette.css';

// Re-export styles for use in tests
export { styles };

// Test IDs for data-testid attributes - use these instead of placeholder text
export const TEST_IDS = {
  /** Main command palette container - also has data-mode attribute */
  container: 'command-palette',
  /** Search/filter input field */
  input: 'command-palette-input',
  /** Back button (visible in file-browse, delete-browse, person-browse modes) */
  backButton: 'command-palette-back-button',
  /** Results container */
  results: 'command-palette-results',
} as const;

// CSS class selector helpers for tests
export const CSS = {
  paletteItem: `.${styles.paletteItem}`,
  paletteItemSelected: `.${styles.paletteItemSelected}`,
  resultsContainer: `.${styles.resultsContainer}`,
  noResults: `.${styles.noResults}`,
  deleteIcon: `.${styles.deleteIcon}`,
  deleteConfirmation: `.${styles.deleteConfirmation}`,
  cancelButton: `.${styles.cancelButton}`,
  confirmButton: `.${styles.confirmButton}`,
  backButton: `.${styles.backButton}`,
  paletteInput: `.${styles.paletteInput}`,
  overlayPositioning: `.${styles.overlayPositioning}`,
};

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
      mentions: overrides.metadata?.mentions ?? [],
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
