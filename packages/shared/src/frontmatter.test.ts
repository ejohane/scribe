/**
 * Tests for frontmatter.ts - YAML frontmatter generation
 *
 * Tests cover:
 * - Basic frontmatter generation structure
 * - Title handling with special characters
 * - Tags array formatting
 * - Timestamp formatting
 * - Note type inclusion
 * - YAML escaping edge cases
 */

import { describe, it, expect } from 'vitest';
import { generateFrontmatter, escapeYamlString } from './frontmatter.js';
import type { Note } from './types.js';
import { createNoteId } from './types/note-types.js';

/**
 * Helper to create a minimal valid Note for testing
 */
function createTestNote(overrides: Partial<Note> = {}): Note {
  const base: Note = {
    id: createNoteId('test-note-1'),
    title: 'Test Note',
    createdAt: new Date('2025-01-15T10:30:00Z').getTime(),
    updatedAt: new Date('2025-01-15T14:45:00Z').getTime(),
    tags: [],
    content: {
      root: {
        type: 'root',
        children: [],
        format: '',
        indent: 0,
        version: 1,
      },
    },
    metadata: {
      title: null,
      tags: [],
      links: [],
      mentions: [],
    },
    type: undefined,
  };
  return { ...base, ...overrides } as Note;
}

describe('frontmatter', () => {
  describe('generateFrontmatter', () => {
    describe('structure', () => {
      it('generates valid YAML frontmatter with opening delimiter', () => {
        const note = createTestNote();
        const fm = generateFrontmatter(note);
        expect(fm).toMatch(/^---\n/);
      });

      it('generates valid YAML frontmatter with closing delimiter', () => {
        const note = createTestNote();
        const fm = generateFrontmatter(note);
        expect(fm).toMatch(/\n---$/);
      });

      it('contains all required fields', () => {
        const note = createTestNote();
        const fm = generateFrontmatter(note);
        expect(fm).toContain('title:');
        expect(fm).toContain('created:');
        expect(fm).toContain('updated:');
      });
    });

    describe('title handling', () => {
      it('includes title field with simple text', () => {
        const note = createTestNote({ title: 'My Note' });
        const fm = generateFrontmatter(note);
        expect(fm).toContain('title: "My Note"');
      });

      it('escapes double quotes in title', () => {
        const note = createTestNote({ title: 'The "Big" Meeting' });
        const fm = generateFrontmatter(note);
        expect(fm).toContain('title: "The \\"Big\\" Meeting"');
      });

      it('handles title with colons', () => {
        const note = createTestNote({ title: 'Meeting: Q1 Planning' });
        const fm = generateFrontmatter(note);
        expect(fm).toContain('title: "Meeting: Q1 Planning"');
      });

      it('handles title with backslashes', () => {
        const note = createTestNote({ title: 'Path\\to\\file' });
        const fm = generateFrontmatter(note);
        expect(fm).toContain('title: "Path\\\\to\\\\file"');
      });

      it('handles title with newlines', () => {
        const note = createTestNote({ title: 'Line 1\nLine 2' });
        const fm = generateFrontmatter(note);
        expect(fm).toContain('title: "Line 1\\nLine 2"');
      });

      it('handles empty title', () => {
        const note = createTestNote({ title: '' });
        const fm = generateFrontmatter(note);
        expect(fm).toContain('title: ""');
      });

      it('handles title with emoji', () => {
        const note = createTestNote({ title: 'Celebration Party' });
        const fm = generateFrontmatter(note);
        expect(fm).toContain('title: "Celebration Party"');
      });

      it('handles title with YAML special characters', () => {
        const note = createTestNote({ title: 'Test # with @ special {chars}' });
        const fm = generateFrontmatter(note);
        // Title is quoted, so special chars are safe
        expect(fm).toContain('title: "Test # with @ special {chars}"');
      });
    });

    describe('tags handling', () => {
      it('omits tags field when no tags present', () => {
        const note = createTestNote({ tags: [] });
        const fm = generateFrontmatter(note);
        expect(fm).not.toContain('tags:');
      });

      it('formats single tag as YAML array', () => {
        const note = createTestNote({ tags: ['important'] });
        const fm = generateFrontmatter(note);
        expect(fm).toContain('tags:');
        expect(fm).toContain('  - important');
      });

      it('formats multiple tags correctly', () => {
        const note = createTestNote({ tags: ['work', 'project', 'urgent'] });
        const fm = generateFrontmatter(note);
        expect(fm).toContain('tags:');
        expect(fm).toContain('  - work');
        expect(fm).toContain('  - project');
        expect(fm).toContain('  - urgent');
      });

      it('preserves tag order', () => {
        const note = createTestNote({ tags: ['alpha', 'beta', 'gamma'] });
        const fm = generateFrontmatter(note);
        const lines = fm.split('\n');
        const tagLines = lines.filter((l) => l.startsWith('  - '));
        expect(tagLines).toEqual(['  - alpha', '  - beta', '  - gamma']);
      });

      it('handles tags with special characters', () => {
        const note = createTestNote({ tags: ['c++', 'node.js', 'my-tag'] });
        const fm = generateFrontmatter(note);
        expect(fm).toContain('  - c++');
        expect(fm).toContain('  - node.js');
        expect(fm).toContain('  - my-tag');
      });
    });

    describe('timestamp handling', () => {
      it('includes created date in ISO-8601 format', () => {
        const note = createTestNote({
          createdAt: new Date('2025-01-15T10:30:00Z').getTime(),
        });
        const fm = generateFrontmatter(note);
        expect(fm).toContain('created: 2025-01-15T10:30:00.000Z');
      });

      it('includes updated date in ISO-8601 format', () => {
        const note = createTestNote({
          updatedAt: new Date('2025-01-15T14:45:00Z').getTime(),
        });
        const fm = generateFrontmatter(note);
        expect(fm).toContain('updated: 2025-01-15T14:45:00.000Z');
      });

      it('handles different created and updated times', () => {
        const note = createTestNote({
          createdAt: new Date('2025-01-10T08:00:00Z').getTime(),
          updatedAt: new Date('2025-01-15T16:30:00Z').getTime(),
        });
        const fm = generateFrontmatter(note);
        expect(fm).toContain('created: 2025-01-10T08:00:00.000Z');
        expect(fm).toContain('updated: 2025-01-15T16:30:00.000Z');
      });
    });

    describe('note type handling', () => {
      it('omits type field for regular notes (undefined type)', () => {
        const note = createTestNote({ type: undefined });
        const fm = generateFrontmatter(note);
        expect(fm).not.toContain('type:');
      });

      it('includes type field for person notes', () => {
        const note = createTestNote({ type: 'person' } as Partial<Note>);
        const fm = generateFrontmatter(note as Note);
        expect(fm).toContain('type: person');
      });

      it('includes type field for meeting notes', () => {
        const note = createTestNote({ type: 'meeting' } as Partial<Note>);
        const fm = generateFrontmatter(note as Note);
        expect(fm).toContain('type: meeting');
      });

      it('includes type field for daily notes', () => {
        const note = createTestNote({ type: 'daily' } as Partial<Note>);
        const fm = generateFrontmatter(note as Note);
        expect(fm).toContain('type: daily');
      });

      it('includes type field for project notes', () => {
        const note = createTestNote({ type: 'project' } as Partial<Note>);
        const fm = generateFrontmatter(note as Note);
        expect(fm).toContain('type: project');
      });
    });

    describe('complete frontmatter examples', () => {
      it('generates complete frontmatter for a regular note', () => {
        const note = createTestNote({
          title: 'My Note',
          tags: ['work', 'important'],
          createdAt: new Date('2025-01-15T10:30:00Z').getTime(),
          updatedAt: new Date('2025-01-15T14:45:00Z').getTime(),
        });
        const fm = generateFrontmatter(note);

        const expected = `---
title: "My Note"
tags:
  - work
  - important
created: 2025-01-15T10:30:00.000Z
updated: 2025-01-15T14:45:00.000Z
---`;
        expect(fm).toBe(expected);
      });

      it('generates complete frontmatter for a meeting note', () => {
        const note = createTestNote({
          title: 'Team Standup',
          tags: [],
          type: 'meeting',
          createdAt: new Date('2025-01-15T09:00:00Z').getTime(),
          updatedAt: new Date('2025-01-15T09:30:00Z').getTime(),
        } as Partial<Note>);
        const fm = generateFrontmatter(note as Note);

        const expected = `---
title: "Team Standup"
created: 2025-01-15T09:00:00.000Z
updated: 2025-01-15T09:30:00.000Z
type: meeting
---`;
        expect(fm).toBe(expected);
      });
    });
  });

  describe('escapeYamlString', () => {
    it('returns empty string unchanged', () => {
      expect(escapeYamlString('')).toBe('');
    });

    it('returns simple string unchanged', () => {
      expect(escapeYamlString('Hello World')).toBe('Hello World');
    });

    it('escapes backslashes', () => {
      expect(escapeYamlString('path\\to\\file')).toBe('path\\\\to\\\\file');
    });

    it('escapes double quotes', () => {
      expect(escapeYamlString('Say "Hello"')).toBe('Say \\"Hello\\"');
    });

    it('escapes newlines', () => {
      expect(escapeYamlString('Line 1\nLine 2')).toBe('Line 1\\nLine 2');
    });

    it('escapes multiple special characters together', () => {
      expect(escapeYamlString('Quote: "Hi"\nPath: C:\\')).toBe('Quote: \\"Hi\\"\\nPath: C:\\\\');
    });

    it('handles multiple consecutive special characters', () => {
      expect(escapeYamlString('\\\\test\\"\\n')).toBe('\\\\\\\\test\\\\\\"\\\\n');
    });

    it('handles Unicode characters', () => {
      expect(escapeYamlString('Hello  World')).toBe('Hello  World');
    });

    it('handles control characters that might be problematic', () => {
      // Tab characters should pass through (not escaped by current implementation)
      expect(escapeYamlString('Tab\there')).toBe('Tab\there');
    });
  });

  describe('YAML compatibility', () => {
    it('produces parseable YAML frontmatter', () => {
      const note = createTestNote({
        title: 'Test: "Complex" Title',
        tags: ['tag1', 'tag2'],
        createdAt: new Date('2025-01-15T10:30:00Z').getTime(),
        updatedAt: new Date('2025-01-15T14:45:00Z').getTime(),
      });

      const fm = generateFrontmatter(note);

      // Remove --- delimiters and parse
      const yamlContent = fm.replace(/^---\n/, '').replace(/\n---$/, '');

      // Verify structure is correct (basic YAML parsing check)
      expect(yamlContent).toContain('title:');
      expect(yamlContent).toContain('tags:');
      expect(yamlContent).toContain('created:');
      expect(yamlContent).toContain('updated:');

      // Each line should be valid YAML key-value or array item
      const lines = yamlContent.split('\n');
      for (const line of lines) {
        // Either a key: value line or an array item
        expect(line).toMatch(/^[a-z]+:|^  - /);
      }
    });

    it('field order is consistent', () => {
      const note = createTestNote({
        title: 'Test',
        tags: ['a'],
        type: 'meeting',
      } as Partial<Note>);

      const fm = generateFrontmatter(note as Note);
      const lines = fm.split('\n').filter((l) => l && l !== '---');

      // Verify field order: title, tags (with items), created, updated, type
      expect(lines[0]).toContain('title:');
      expect(lines[1]).toContain('tags:');
      expect(lines[2]).toContain('  - a');
      expect(lines[3]).toContain('created:');
      expect(lines[4]).toContain('updated:');
      expect(lines[5]).toContain('type:');
    });
  });
});
