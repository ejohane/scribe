/**
 * Fuzzy Filter Tests
 *
 * Tests for fuzzy matching and command filtering utilities.
 */

import { describe, it, expect } from 'vitest';
import { fuzzyMatch, fuzzyScore, filterCommands } from './fuzzyFilter';
import type { CommandItem } from './types';

describe('fuzzyMatch', () => {
  it('matches exact strings', () => {
    expect(fuzzyMatch('Create Note', 'Create Note')).toBe(true);
    expect(fuzzyMatch('hello', 'hello')).toBe(true);
  });

  it('matches substrings', () => {
    expect(fuzzyMatch('Create Note', 'cre')).toBe(true);
    expect(fuzzyMatch('Create Note', 'note')).toBe(true);
  });

  it('matches characters in sequence', () => {
    expect(fuzzyMatch('Create Note', 'crn')).toBe(true);
    expect(fuzzyMatch('Create Note', 'cnt')).toBe(true);
    expect(fuzzyMatch('Create Note', 'cote')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(fuzzyMatch('Create Note', 'CREATE')).toBe(true);
    expect(fuzzyMatch('CREATE NOTE', 'create')).toBe(true);
    expect(fuzzyMatch('CrEaTe NoTe', 'cReAtE')).toBe(true);
  });

  it('rejects non-matching strings', () => {
    expect(fuzzyMatch('Create Note', 'xyz')).toBe(false);
    expect(fuzzyMatch('Create Note', 'ncr')).toBe(false); // n comes after c
    expect(fuzzyMatch('abc', 'abcd')).toBe(false); // query longer than text
  });

  it('handles empty strings', () => {
    expect(fuzzyMatch('Create Note', '')).toBe(true); // empty query matches anything
    expect(fuzzyMatch('', 'a')).toBe(false); // non-empty query can't match empty text
    expect(fuzzyMatch('', '')).toBe(true);
  });
});

describe('fuzzyScore', () => {
  it('returns 0 for empty query', () => {
    expect(fuzzyScore('Create Note', '')).toBe(0);
  });

  it('returns -1 for non-matching query', () => {
    expect(fuzzyScore('Create Note', 'xyz')).toBe(-1);
    expect(fuzzyScore('abc', 'abcd')).toBe(-1);
  });

  it('gives higher score for matches at word boundaries', () => {
    // "cn" matches "Create Note" at word boundaries
    const boundaryScore = fuzzyScore('Create Note', 'cn');
    // "re" matches in middle of "Create"
    const middleScore = fuzzyScore('Create Note', 're');
    expect(boundaryScore).toBeGreaterThan(middleScore);
  });

  it('gives higher score for consecutive matches', () => {
    // "cre" has 3 consecutive matches
    const consecutiveScore = fuzzyScore('Create Note', 'cre');
    // "crn" has non-consecutive matches
    const nonConsecutiveScore = fuzzyScore('Create Note', 'crn');
    expect(consecutiveScore).toBeGreaterThan(nonConsecutiveScore);
  });

  it('gives bonus for prefix matches', () => {
    const prefixScore = fuzzyScore('Create Note', 'crea');
    const nonPrefixScore = fuzzyScore('Create Note', 'note');
    expect(prefixScore).toBeGreaterThan(nonPrefixScore);
  });
});

describe('filterCommands', () => {
  const mockHandler = { execute: () => {} };

  const mockCommands: CommandItem[] = [
    {
      type: 'command',
      id: 'notes.new',
      label: 'New Note',
      description: 'Create a new note',
      icon: 'Plus',
      category: 'Notes',
      priority: 10,
      handler: mockHandler,
    },
    {
      type: 'command',
      id: 'notes.meeting',
      label: 'New Meeting',
      description: 'Create a meeting note',
      icon: 'Users',
      category: 'Notes',
      priority: 20,
      handler: mockHandler,
    },
    {
      type: 'command',
      id: 'settings.open',
      label: 'Open Settings',
      description: 'Open application settings',
      icon: 'Settings',
      category: 'General',
      priority: 100,
      handler: mockHandler,
    },
  ];

  it('returns all commands sorted by category then priority when query is empty', () => {
    const result = filterCommands(mockCommands, '');
    expect(result).toHaveLength(3);
    // Should be sorted: General first (alphabetically), then Notes
    expect(result[0].id).toBe('settings.open');
    expect(result[1].id).toBe('notes.new');
    expect(result[2].id).toBe('notes.meeting');
  });

  it('filters commands by label', () => {
    const result = filterCommands(mockCommands, 'new');
    expect(result).toHaveLength(2);
    expect(result.every((cmd) => cmd.label.toLowerCase().includes('new'))).toBe(true);
  });

  it('filters commands by fuzzy match', () => {
    const result = filterCommands(mockCommands, 'mtng');
    // "mtng" matches "New MeeTiNG" only (m-t-n-g sequence)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('notes.meeting');
  });

  it('returns empty array when no matches', () => {
    const result = filterCommands(mockCommands, 'xyz');
    expect(result).toHaveLength(0);
  });

  it('sorts results by score descending', () => {
    const result = filterCommands(mockCommands, 'new');
    // "New Note" should rank higher than "New Meeting" for "new"
    // because it's a closer match
    expect(result[0].label).toBe('New Note');
  });

  it('matches against description', () => {
    const result = filterCommands(mockCommands, 'settings');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('settings.open');
  });
});
