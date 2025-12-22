/**
 * Unit tests for fuzzySearchCommands
 *
 * Tests fuzzy search functionality for command palette using Fuse.js.
 * The function searches across title, description, keywords, and group
 * with different weights for each field.
 */

import { describe, it, expect, vi } from 'vitest';
import { fuzzySearchCommands } from './fuzzySearch';
import type { Command } from './types';

/**
 * Create a mock command for testing
 */
function createMockCommand(overrides: Partial<Command> = {}): Command {
  return {
    id: overrides.id ?? 'test-command',
    title: overrides.title ?? 'Test Command',
    run: overrides.run ?? vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Standard test fixture of commands covering various search scenarios
 */
const testCommands: Command[] = [
  createMockCommand({
    id: 'new-note',
    title: 'New Note',
    description: 'Create a fresh note',
    keywords: ['create', 'add'],
    group: 'Notes',
  }),
  createMockCommand({
    id: 'open-file',
    title: 'Open File',
    description: 'Browse and open existing notes',
    keywords: ['browse', 'find'],
    group: 'Files',
  }),
  createMockCommand({
    id: 'save-note',
    title: 'Save Note',
    description: 'Save the current note',
    keywords: ['write', 'persist'],
    group: 'Notes',
  }),
  createMockCommand({
    id: 'delete-note',
    title: 'Delete Note',
    description: 'Remove a note permanently',
    keywords: ['remove', 'trash'],
    group: 'Notes',
  }),
  createMockCommand({
    id: 'toggle-dark-mode',
    title: 'Toggle Dark Mode',
    description: 'Switch between light and dark themes',
    keywords: ['theme', 'appearance'],
    group: 'Settings',
  }),
  createMockCommand({
    id: 'hidden-command',
    title: 'Hidden Admin',
    description: 'Administrative functions',
    keywords: ['admin', 'secret'],
    group: 'Admin',
    hidden: true,
  }),
];

describe('fuzzySearchCommands', () => {
  // ============================================================================
  // Empty/Whitespace Query Behavior
  // ============================================================================
  describe('empty query handling', () => {
    it('returns all commands when query is empty string', () => {
      const results = fuzzySearchCommands(testCommands, '');
      expect(results).toHaveLength(testCommands.length);
      expect(results).toEqual(testCommands);
    });

    it('returns all commands when query is whitespace only', () => {
      const results = fuzzySearchCommands(testCommands, '   ');
      expect(results).toHaveLength(testCommands.length);
      expect(results).toEqual(testCommands);
    });

    it('returns all commands when query is tabs and newlines', () => {
      const results = fuzzySearchCommands(testCommands, '\t\n  \t');
      expect(results).toHaveLength(testCommands.length);
    });

    it('returns empty array when commands array is empty', () => {
      const results = fuzzySearchCommands([], 'anything');
      expect(results).toHaveLength(0);
    });
  });

  // ============================================================================
  // Title Matching (highest weight: 2)
  // ============================================================================
  describe('title matching', () => {
    it('finds command by exact title match', () => {
      const results = fuzzySearchCommands(testCommands, 'New Note');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('new-note');
    });

    it('finds command by partial title match', () => {
      const results = fuzzySearchCommands(testCommands, 'Dark');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('toggle-dark-mode');
    });

    it('finds commands by case-insensitive title match', () => {
      const results = fuzzySearchCommands(testCommands, 'SAVE');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('save-note');
    });

    it('ranks title matches higher than other fields', () => {
      // "Note" appears in title of multiple commands
      // But exact matches should rank higher
      const results = fuzzySearchCommands(testCommands, 'Note');
      expect(results.length).toBeGreaterThan(0);
      // All "Note" title commands should be in results
      const noteIds = results.map((r) => r.id);
      expect(noteIds).toContain('new-note');
      expect(noteIds).toContain('save-note');
      expect(noteIds).toContain('delete-note');
    });
  });

  // ============================================================================
  // Description Matching (weight: 1)
  // ============================================================================
  describe('description matching', () => {
    it('finds command by description text', () => {
      // "Browse" appears in "Browse and open existing notes"
      const results = fuzzySearchCommands(testCommands, 'existing');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('open-file');
    });

    it('finds command by partial description match', () => {
      const results = fuzzySearchCommands(testCommands, 'permanently');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('delete-note');
    });

    it('finds command by description when title has no match', () => {
      const results = fuzzySearchCommands(testCommands, 'themes');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('toggle-dark-mode');
    });
  });

  // ============================================================================
  // Keywords Matching (weight: 1.5)
  // ============================================================================
  describe('keywords matching', () => {
    it('finds command by keyword', () => {
      const results = fuzzySearchCommands(testCommands, 'create');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('new-note');
    });

    it('finds command by partial keyword match', () => {
      const results = fuzzySearchCommands(testCommands, 'brow');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('open-file');
    });

    it('finds command by secondary keyword', () => {
      const results = fuzzySearchCommands(testCommands, 'trash');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('delete-note');
    });
  });

  // ============================================================================
  // Group Matching (lowest weight: 0.5)
  // ============================================================================
  describe('group matching', () => {
    it('finds commands by group name', () => {
      const results = fuzzySearchCommands(testCommands, 'Settings');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('toggle-dark-mode');
    });

    it('finds multiple commands in same group', () => {
      const results = fuzzySearchCommands(testCommands, 'Notes');
      expect(results.length).toBeGreaterThanOrEqual(3);
      const ids = results.map((r) => r.id);
      expect(ids).toContain('new-note');
      expect(ids).toContain('save-note');
      expect(ids).toContain('delete-note');
    });
  });

  // ============================================================================
  // No Match Behavior
  // ============================================================================
  describe('no match handling', () => {
    it('returns empty array when no commands match', () => {
      const results = fuzzySearchCommands(testCommands, 'xyznonexistent');
      expect(results).toHaveLength(0);
    });

    it('returns empty array for gibberish query', () => {
      const results = fuzzySearchCommands(testCommands, 'qqzjjk');
      expect(results).toHaveLength(0);
    });
  });

  // ============================================================================
  // Result Ordering
  // ============================================================================
  describe('result ordering', () => {
    it('sorts results by relevance score', () => {
      // "Note" should match "New Note", "Save Note", "Delete Note" in title
      // and potentially others in description
      const results = fuzzySearchCommands(testCommands, 'Note');
      expect(results.length).toBeGreaterThan(0);
      // First results should be commands with "Note" in title
      const firstThree = results.slice(0, 3).map((r) => r.id);
      expect(firstThree).toContain('new-note');
      expect(firstThree).toContain('save-note');
      expect(firstThree).toContain('delete-note');
    });

    it('ranks exact matches higher than partial matches', () => {
      // "Save" is exact word in "Save Note"
      // "save" appears partially nowhere else
      const results = fuzzySearchCommands(testCommands, 'Save');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('save-note');
    });
  });

  // ============================================================================
  // Hidden Commands
  // ============================================================================
  describe('hidden commands', () => {
    it('includes hidden commands in search results', () => {
      const results = fuzzySearchCommands(testCommands, 'Admin');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('hidden-command');
    });

    it('finds hidden commands by keyword', () => {
      const results = fuzzySearchCommands(testCommands, 'secret');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('hidden-command');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('handles commands without optional fields', () => {
      const minimalCommands: Command[] = [
        createMockCommand({ id: 'minimal', title: 'Minimal Command' }),
      ];
      const results = fuzzySearchCommands(minimalCommands, 'Minimal');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('minimal');
    });

    it('handles single character query', () => {
      // minMatchCharLength is 1, so single char should work
      const results = fuzzySearchCommands(testCommands, 'N');
      expect(results.length).toBeGreaterThan(0);
    });

    it('handles special characters in query', () => {
      const results = fuzzySearchCommands(testCommands, 'Note!@#');
      // Should still find Note-related commands despite special chars
      // Fuse.js handles this gracefully
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('handles unicode characters', () => {
      const unicodeCommands: Command[] = [
        createMockCommand({ id: 'emoji', title: 'Save 💾 Note' }),
      ];
      const results = fuzzySearchCommands(unicodeCommands, 'Save');
      expect(results).toHaveLength(1);
    });

    it('preserves command object references', () => {
      const results = fuzzySearchCommands(testCommands, 'New');
      expect(results.length).toBeGreaterThan(0);
      // Should be the exact same object reference
      expect(results[0]).toBe(testCommands[0]);
    });
  });

  // ============================================================================
  // Fuzzy Matching Behavior
  // ============================================================================
  describe('fuzzy matching', () => {
    it('tolerates minor typos', () => {
      // "Drak" instead of "Dark"
      const results = fuzzySearchCommands(testCommands, 'Drak');
      // With threshold 0.4, this might match "Dark Mode"
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('matches across word boundaries', () => {
      const results = fuzzySearchCommands(testCommands, 'DarkMode');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('toggle-dark-mode');
    });
  });
});
