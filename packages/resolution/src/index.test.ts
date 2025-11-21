/**
 * Tests for note link resolution.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  resolveNoteLink,
  resolveLinkRef,
  resolveEmbedRef,
  normalizeForLookup,
  resolveHeadingLink,
  resolveLinkRefWithHeading,
  resolvePersonMention,
  resolvePersonMentionRef,
} from './index.js';
import { NoteRegistry } from '@scribe/domain-model';
import type {
  ParsedNote,
  LinkRef,
  EmbedRef,
  HeadingIndex,
  Heading,
  HeadingId,
  PeopleIndex,
  Person,
  PersonMentionRef,
} from '@scribe/domain-model';
import { generateHeadingId } from '@scribe/utils';

/**
 * Helper to create a minimal ParsedNote for testing.
 */
function createNote(overrides: Partial<ParsedNote>): ParsedNote {
  return {
    id: overrides.id || 'note-1',
    path: overrides.path || 'notes/test.md',
    fileName: overrides.fileName || 'test.md',
    resolvedTitle: overrides.resolvedTitle || 'Test Note',
    frontmatter: overrides.frontmatter || {},
    aliases: overrides.aliases || [],
    inlineTags: [],
    fmTags: [],
    allTags: [],
    headings: [],
    links: [],
    embeds: [],
    peopleMentions: [],
    plainText: '',
    ...overrides,
  };
}

describe('normalizeForLookup', () => {
  test('trims whitespace', () => {
    expect(normalizeForLookup('  Test  ')).toBe('test');
  });

  test('lowercases', () => {
    expect(normalizeForLookup('Test Note')).toBe('test note');
  });

  test('normalizes multiple spaces', () => {
    expect(normalizeForLookup('Test   Note')).toBe('test note');
  });

  test('handles empty string', () => {
    expect(normalizeForLookup('')).toBe('');
  });
});

describe('resolveNoteLink', () => {
  let registry: NoteRegistry;

  beforeEach(() => {
    registry = new NoteRegistry();
  });

  describe('basic resolution', () => {
    test('resolves exact title match (case-insensitive)', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note);

      const result = resolveNoteLink('plan', registry);
      expect(result.status).toBe('resolved');
      expect(result.targetId).toBe('note-1');
      expect(result.candidates).toEqual([]);
    });

    test('resolves with different casing', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Project Plan',
      });
      registry.add(note);

      const result = resolveNoteLink('PROJECT plan', registry);
      expect(result.status).toBe('resolved');
      expect(result.targetId).toBe('note-1');
    });

    test('resolves with extra whitespace', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Project Plan',
      });
      registry.add(note);

      const result = resolveNoteLink('  project   plan  ', registry);
      expect(result.status).toBe('resolved');
      expect(result.targetId).toBe('note-1');
    });

    test('returns unresolved when no match found', () => {
      const result = resolveNoteLink('Nonexistent', registry);
      expect(result.status).toBe('unresolved');
      expect(result.targetId).toBeUndefined();
      expect(result.candidates).toEqual([]);
    });
  });

  describe('alias resolution', () => {
    test('resolves by alias', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Project Plan',
        aliases: ['Plan', 'The Plan'],
      });
      registry.add(note);

      const result = resolveNoteLink('the plan', registry);
      expect(result.status).toBe('resolved');
      expect(result.targetId).toBe('note-1');
    });

    test('prefers single alias match', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Project Plan',
        aliases: ['Strategy'],
      });
      registry.add(note);

      const result = resolveNoteLink('strategy', registry);
      expect(result.status).toBe('resolved');
      expect(result.targetId).toBe('note-1');
    });
  });

  describe('ambiguous resolution', () => {
    test('returns ambiguous when multiple notes have same title', () => {
      const note1 = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      const note2 = createNote({
        id: 'note-2',
        path: 'projects/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note1);
      registry.add(note2);

      const result = resolveNoteLink('plan', registry);
      expect(result.status).toBe('ambiguous');
      expect(result.targetId).toBeUndefined();
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates).toContain('note-1');
      expect(result.candidates).toContain('note-2');
    });

    test('returns ambiguous when multiple notes share same alias', () => {
      const note1 = createNote({
        id: 'note-1',
        path: 'notes/plan-a.md',
        resolvedTitle: 'Plan A',
        aliases: ['Strategy'],
      });
      const note2 = createNote({
        id: 'note-2',
        path: 'notes/plan-b.md',
        resolvedTitle: 'Plan B',
        aliases: ['Strategy'],
      });
      registry.add(note1);
      registry.add(note2);

      const result = resolveNoteLink('strategy', registry);
      expect(result.status).toBe('ambiguous');
      expect(result.candidates).toHaveLength(2);
    });

    test('returns ambiguous when title and alias match different notes', () => {
      const note1 = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      const note2 = createNote({
        id: 'note-2',
        path: 'notes/strategy.md',
        resolvedTitle: 'Strategy',
        aliases: ['Plan'],
      });
      registry.add(note1);
      registry.add(note2);

      const result = resolveNoteLink('plan', registry);
      expect(result.status).toBe('ambiguous');
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates).toContain('note-1');
      expect(result.candidates).toContain('note-2');
    });
  });

  describe('path-based resolution', () => {
    test('resolves path with slash', () => {
      const note = createNote({
        id: 'note-1',
        path: 'projects/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note);

      const result = resolveNoteLink('projects/plan', registry);
      expect(result.status).toBe('resolved');
      expect(result.targetId).toBe('note-1');
    });

    test('resolves path with .md extension', () => {
      const note = createNote({
        id: 'note-1',
        path: 'projects/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note);

      const result = resolveNoteLink('projects/plan.md', registry);
      expect(result.status).toBe('resolved');
      expect(result.targetId).toBe('note-1');
    });

    test('path resolution takes precedence over title match', () => {
      const note1 = createNote({
        id: 'note-1',
        path: 'projects/plan.md',
        resolvedTitle: 'Plan',
      });
      const note2 = createNote({
        id: 'note-2',
        path: 'notes/plan.md',
        resolvedTitle: 'notes/plan', // title happens to match path syntax
      });
      registry.add(note1);
      registry.add(note2);

      const result = resolveNoteLink('notes/plan', registry);
      expect(result.status).toBe('resolved');
      expect(result.targetId).toBe('note-2'); // path match wins
    });

    test('falls back to title match when path not found', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note);

      const result = resolveNoteLink('wrong/path', registry);
      expect(result.status).toBe('unresolved');
    });

    test('can disable path matching', () => {
      const note1 = createNote({
        id: 'note-1',
        path: 'projects/plan.md',
        resolvedTitle: 'projects/plan',
      });
      registry.add(note1);

      const result = resolveNoteLink('projects/plan', registry, {
        preferPathMatch: false,
      });
      // Should resolve by title instead of path
      expect(result.status).toBe('resolved');
      expect(result.targetId).toBe('note-1');
    });
  });

  describe('edge cases', () => {
    test('handles empty note name', () => {
      const result = resolveNoteLink('', registry);
      expect(result.status).toBe('unresolved');
    });

    test('handles note name with only whitespace', () => {
      const result = resolveNoteLink('   ', registry);
      expect(result.status).toBe('unresolved');
    });

    test('handles special characters in title', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan (2024)',
      });
      registry.add(note);

      const result = resolveNoteLink('Plan (2024)', registry);
      expect(result.status).toBe('resolved');
      expect(result.targetId).toBe('note-1');
    });
  });
});

describe('resolveLinkRef', () => {
  let registry: NoteRegistry;

  beforeEach(() => {
    registry = new NoteRegistry();
  });

  test('resolves LinkRef object', () => {
    const note = createNote({
      id: 'note-1',
      path: 'notes/plan.md',
      resolvedTitle: 'Plan',
    });
    registry.add(note);

    const link: LinkRef = {
      raw: '[[Plan]]',
      targetText: 'Plan',
      noteName: 'Plan',
      position: { line: 1, column: 0 },
    };

    const result = resolveLinkRef(link, registry);
    expect(result.status).toBe('resolved');
    expect(result.targetId).toBe('note-1');
  });

  test('resolves LinkRef with heading (ignores heading portion)', () => {
    const note = createNote({
      id: 'note-1',
      path: 'notes/plan.md',
      resolvedTitle: 'Plan',
    });
    registry.add(note);

    const link: LinkRef = {
      raw: '[[Plan#Introduction]]',
      targetText: 'Plan#Introduction',
      noteName: 'Plan',
      headingText: 'Introduction',
      position: { line: 1, column: 0 },
    };

    const result = resolveLinkRef(link, registry);
    expect(result.status).toBe('resolved');
    expect(result.targetId).toBe('note-1');
  });
});

describe('resolveEmbedRef', () => {
  let registry: NoteRegistry;

  beforeEach(() => {
    registry = new NoteRegistry();
  });

  test('resolves EmbedRef object', () => {
    const note = createNote({
      id: 'note-1',
      path: 'notes/plan.md',
      resolvedTitle: 'Plan',
    });
    registry.add(note);

    const embed: EmbedRef = {
      raw: '![[Plan]]',
      noteName: 'Plan',
      position: { line: 1, column: 0 },
    };

    const result = resolveEmbedRef(embed, registry);
    expect(result.status).toBe('resolved');
    expect(result.targetId).toBe('note-1');
  });

  test('uses same resolution logic as links', () => {
    const note1 = createNote({
      id: 'note-1',
      path: 'notes/plan.md',
      resolvedTitle: 'Plan',
    });
    const note2 = createNote({
      id: 'note-2',
      path: 'projects/plan.md',
      resolvedTitle: 'Plan',
    });
    registry.add(note1);
    registry.add(note2);

    const embed: EmbedRef = {
      raw: '![[Plan]]',
      noteName: 'Plan',
      position: { line: 1, column: 0 },
    };

    const result = resolveEmbedRef(embed, registry);
    expect(result.status).toBe('ambiguous');
    expect(result.candidates).toHaveLength(2);
  });
});

describe('resolveHeadingLink', () => {
  let registry: NoteRegistry;
  let headingIndex: HeadingIndex;

  beforeEach(() => {
    registry = new NoteRegistry();
    headingIndex = {
      byId: new Map(),
      headingsByNote: new Map(),
    };
  });

  /**
   * Helper to add a heading to the index.
   */
  function addHeading(
    noteId: string,
    text: string,
    normalized: string,
    level: number = 2,
    line: number = 1
  ): void {
    const headingId = generateHeadingId(noteId, text);

    const heading: Heading = {
      id: headingId,
      noteId,
      level,
      text,
      normalized,
      line,
    };

    headingIndex.byId.set(headingId, heading);

    const headings = headingIndex.headingsByNote.get(noteId) || [];
    headings.push(headingId);
    headingIndex.headingsByNote.set(noteId, headings);
  }

  describe('successful resolution', () => {
    test('resolves note and heading', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note);
      addHeading('note-1', 'Goals and Scope', 'goals-and-scope');

      const result = resolveHeadingLink('Plan', 'Goals and Scope', registry, headingIndex);
      expect(result.status).toBe('resolved');
      expect(result.noteId).toBe('note-1');
      expect(result.headingId).toBeDefined();
    });

    test('handles case-insensitive heading matching', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note);
      addHeading('note-1', 'Goals and Scope', 'goals-and-scope');

      const result = resolveHeadingLink('plan', 'GOALS AND SCOPE', registry, headingIndex);
      expect(result.status).toBe('resolved');
      expect(result.noteId).toBe('note-1');
    });

    test('normalizes heading text with special characters', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note);
      addHeading('note-1', 'Q&A Section', 'qa-section');

      const result = resolveHeadingLink('Plan', 'Q&A Section', registry, headingIndex);
      expect(result.status).toBe('resolved');
      expect(result.noteId).toBe('note-1');
    });

    test('normalizes heading text with multiple spaces', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note);
      addHeading('note-1', 'Multiple   Spaces', 'multiple-spaces');

      const result = resolveHeadingLink('Plan', 'Multiple   Spaces', registry, headingIndex);
      expect(result.status).toBe('resolved');
      expect(result.noteId).toBe('note-1');
    });

    test('resolves when note has multiple headings', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note);
      addHeading('note-1', 'Introduction', 'introduction', 2, 1);
      addHeading('note-1', 'Goals and Scope', 'goals-and-scope', 2, 5);
      addHeading('note-1', 'Timeline', 'timeline', 2, 10);

      const result = resolveHeadingLink('Plan', 'Goals and Scope', registry, headingIndex);
      expect(result.status).toBe('resolved');
      expect(result.noteId).toBe('note-1');
    });
  });

  describe('heading not found', () => {
    test('returns unresolved when heading not in note', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note);
      addHeading('note-1', 'Introduction', 'introduction');

      const result = resolveHeadingLink('Plan', 'Nonexistent', registry, headingIndex);
      expect(result.status).toBe('unresolved');
      expect(result.noteId).toBe('note-1');
      expect(result.headingId).toBeUndefined();
    });

    test('returns unresolved when note has no headings', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note);

      const result = resolveHeadingLink('Plan', 'Any Heading', registry, headingIndex);
      expect(result.status).toBe('unresolved');
      expect(result.noteId).toBe('note-1');
      expect(result.headingId).toBeUndefined();
    });
  });

  describe('note resolution failures', () => {
    test('returns note-unresolved when note does not exist', () => {
      const result = resolveHeadingLink('Nonexistent', 'Introduction', registry, headingIndex);
      expect(result.status).toBe('note-unresolved');
      expect(result.noteId).toBeUndefined();
      expect(result.headingId).toBeUndefined();
    });

    test('returns ambiguous-note when multiple notes match', () => {
      const note1 = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      const note2 = createNote({
        id: 'note-2',
        path: 'projects/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note1);
      registry.add(note2);

      const result = resolveHeadingLink('Plan', 'Introduction', registry, headingIndex);
      expect(result.status).toBe('ambiguous-note');
      expect(result.noteId).toBeUndefined();
      expect(result.headingId).toBeUndefined();
      expect(result.noteCandidates).toHaveLength(2);
      expect(result.noteCandidates).toContain('note-1');
      expect(result.noteCandidates).toContain('note-2');
    });
  });

  describe('edge cases', () => {
    test('handles empty heading text', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note);
      addHeading('note-1', 'Introduction', 'introduction');

      const result = resolveHeadingLink('Plan', '', registry, headingIndex);
      expect(result.status).toBe('unresolved');
    });

    test('handles heading text with only whitespace', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note);
      addHeading('note-1', 'Introduction', 'introduction');

      const result = resolveHeadingLink('Plan', '   ', registry, headingIndex);
      expect(result.status).toBe('unresolved');
    });

    test('handles heading with underscores', () => {
      const note = createNote({
        id: 'note-1',
        path: 'notes/plan.md',
        resolvedTitle: 'Plan',
      });
      registry.add(note);
      addHeading('note-1', 'my_variable_name', 'my_variable_name');

      const result = resolveHeadingLink('Plan', 'my_variable_name', registry, headingIndex);
      expect(result.status).toBe('resolved');
      expect(result.noteId).toBe('note-1');
    });
  });
});

describe('resolveLinkRefWithHeading', () => {
  let registry: NoteRegistry;
  let headingIndex: HeadingIndex;

  beforeEach(() => {
    registry = new NoteRegistry();
    headingIndex = {
      byId: new Map(),
      headingsByNote: new Map(),
    };
  });

  function addHeading(noteId: string, text: string, normalized: string, level: number = 2): void {
    const headingId = generateHeadingId(noteId, text);
    const heading: Heading = {
      id: headingId,
      noteId,
      level,
      text,
      normalized,
      line: 1,
    };
    headingIndex.byId.set(headingId, heading);
    const headings = headingIndex.headingsByNote.get(noteId) || [];
    headings.push(headingId);
    headingIndex.headingsByNote.set(noteId, headings);
  }

  test('resolves link with heading', () => {
    const note = createNote({
      id: 'note-1',
      path: 'notes/plan.md',
      resolvedTitle: 'Plan',
    });
    registry.add(note);
    addHeading('note-1', 'Goals', 'goals');

    const link: LinkRef = {
      raw: '[[Plan#Goals]]',
      targetText: 'Plan#Goals',
      noteName: 'Plan',
      headingText: 'Goals',
      position: { line: 1, column: 0 },
    };

    const result = resolveLinkRefWithHeading(link, registry, headingIndex);
    expect(result.status).toBe('resolved');
    expect((result as any).noteId).toBe('note-1');
    expect((result as any).headingId).toBeDefined();
  });

  test('resolves link without heading (returns LinkResolutionResult)', () => {
    const note = createNote({
      id: 'note-1',
      path: 'notes/plan.md',
      resolvedTitle: 'Plan',
    });
    registry.add(note);

    const link: LinkRef = {
      raw: '[[Plan]]',
      targetText: 'Plan',
      noteName: 'Plan',
      position: { line: 1, column: 0 },
    };

    const result = resolveLinkRefWithHeading(link, registry, headingIndex);
    expect(result.status).toBe('resolved');
    expect((result as any).targetId).toBe('note-1');
  });

  test('handles unresolved heading', () => {
    const note = createNote({
      id: 'note-1',
      path: 'notes/plan.md',
      resolvedTitle: 'Plan',
    });
    registry.add(note);

    const link: LinkRef = {
      raw: '[[Plan#Nonexistent]]',
      targetText: 'Plan#Nonexistent',
      noteName: 'Plan',
      headingText: 'Nonexistent',
      position: { line: 1, column: 0 },
    };

    const result = resolveLinkRefWithHeading(link, registry, headingIndex);
    expect(result.status).toBe('unresolved');
    expect((result as any).noteId).toBe('note-1');
  });
});

describe('resolvePersonMention', () => {
  let peopleIndex: PeopleIndex;

  beforeEach(() => {
    peopleIndex = {
      byId: new Map(),
      byName: new Map(),
      mentionsByPerson: new Map(),
      peopleByNote: new Map(),
    };
  });

  /**
   * Helper to add a person to the index.
   */
  function addPerson(id: string, name: string): void {
    const person: Person = {
      id,
      noteId: `people/${id}.md`,
      path: `people/${id}.md`,
      name,
      metadata: {},
    };

    peopleIndex.byId.set(id, person);
    peopleIndex.byName.set(name, id);
  }

  describe('successful resolution', () => {
    test('resolves existing person by name', () => {
      addPerson('erik', 'Erik');

      const result = resolvePersonMention('Erik', peopleIndex);
      expect(result.status).toBe('resolved');
      expect(result.personId).toBe('erik');
      expect(result.normalizedName).toBe('Erik');
    });

    test('resolves person with trimmed whitespace', () => {
      addPerson('erik', 'Erik');

      const result = resolvePersonMention('  Erik  ', peopleIndex);
      expect(result.status).toBe('resolved');
      expect(result.personId).toBe('erik');
      expect(result.normalizedName).toBe('Erik');
    });

    test('resolves person with multi-word name', () => {
      addPerson('john-doe', 'John Doe');

      const result = resolvePersonMention('John Doe', peopleIndex);
      expect(result.status).toBe('resolved');
      expect(result.personId).toBe('john-doe');
      expect(result.normalizedName).toBe('John Doe');
    });

    test('resolves multiple different people', () => {
      addPerson('erik', 'Erik');
      addPerson('alice', 'Alice');
      addPerson('bob', 'Bob');

      const result1 = resolvePersonMention('Erik', peopleIndex);
      expect(result1.status).toBe('resolved');
      expect(result1.personId).toBe('erik');

      const result2 = resolvePersonMention('Alice', peopleIndex);
      expect(result2.status).toBe('resolved');
      expect(result2.personId).toBe('alice');

      const result3 = resolvePersonMention('Bob', peopleIndex);
      expect(result3.status).toBe('resolved');
      expect(result3.personId).toBe('bob');
    });
  });

  describe('unresolved cases', () => {
    test('returns unresolved when person does not exist', () => {
      const result = resolvePersonMention('Nonexistent', peopleIndex);
      expect(result.status).toBe('unresolved');
      expect(result.personId).toBeUndefined();
      expect(result.normalizedName).toBe('Nonexistent');
    });

    test('returns normalized name for creating new person', () => {
      const result = resolvePersonMention('  New Person  ', peopleIndex);
      expect(result.status).toBe('unresolved');
      expect(result.normalizedName).toBe('New Person');
    });

    test('returns unresolved for empty name', () => {
      const result = resolvePersonMention('', peopleIndex);
      expect(result.status).toBe('unresolved');
      expect(result.normalizedName).toBe('');
    });

    test('returns unresolved when index is empty', () => {
      const result = resolvePersonMention('Anyone', peopleIndex);
      expect(result.status).toBe('unresolved');
      expect(result.personId).toBeUndefined();
    });
  });

  describe('case sensitivity', () => {
    test('is case-sensitive for person names', () => {
      addPerson('erik', 'Erik');

      const result = resolvePersonMention('erik', peopleIndex);
      expect(result.status).toBe('unresolved');
      expect(result.normalizedName).toBe('erik');
    });

    test('requires exact case match', () => {
      addPerson('alice', 'Alice');

      const resultLower = resolvePersonMention('alice', peopleIndex);
      expect(resultLower.status).toBe('unresolved');

      const resultUpper = resolvePersonMention('ALICE', peopleIndex);
      expect(resultUpper.status).toBe('unresolved');

      const resultCorrect = resolvePersonMention('Alice', peopleIndex);
      expect(resultCorrect.status).toBe('resolved');
    });

    test('preserves casing in normalized name', () => {
      const result1 = resolvePersonMention('Erik', peopleIndex);
      expect(result1.normalizedName).toBe('Erik');

      const result2 = resolvePersonMention('ERIK', peopleIndex);
      expect(result2.normalizedName).toBe('ERIK');

      const result3 = resolvePersonMention('erik', peopleIndex);
      expect(result3.normalizedName).toBe('erik');
    });
  });

  describe('edge cases', () => {
    test('handles single character names', () => {
      addPerson('a', 'A');

      const result = resolvePersonMention('A', peopleIndex);
      expect(result.status).toBe('resolved');
      expect(result.personId).toBe('a');
    });

    test('handles names with special characters', () => {
      addPerson('oneal', "O'Neal");

      const result = resolvePersonMention("O'Neal", peopleIndex);
      expect(result.status).toBe('resolved');
      expect(result.personId).toBe('oneal');
    });

    test('handles names with hyphens', () => {
      addPerson('jean-luc', 'Jean-Luc');

      const result = resolvePersonMention('Jean-Luc', peopleIndex);
      expect(result.status).toBe('resolved');
      expect(result.personId).toBe('jean-luc');
    });

    test('handles names with numbers', () => {
      addPerson('r2d2', 'R2D2');

      const result = resolvePersonMention('R2D2', peopleIndex);
      expect(result.status).toBe('resolved');
      expect(result.personId).toBe('r2d2');
    });

    test('handles very long names', () => {
      const longName = 'Alexander Hamilton Washington Jefferson';
      addPerson('alexander', longName);

      const result = resolvePersonMention(longName, peopleIndex);
      expect(result.status).toBe('resolved');
      expect(result.personId).toBe('alexander');
    });

    test('handles whitespace-only name', () => {
      const result = resolvePersonMention('   ', peopleIndex);
      expect(result.status).toBe('unresolved');
      expect(result.normalizedName).toBe('');
    });
  });
});

describe('resolvePersonMentionRef', () => {
  let peopleIndex: PeopleIndex;

  beforeEach(() => {
    peopleIndex = {
      byId: new Map(),
      byName: new Map(),
      mentionsByPerson: new Map(),
      peopleByNote: new Map(),
    };
  });

  function addPerson(id: string, name: string): void {
    const person: Person = {
      id,
      noteId: `people/${id}.md`,
      path: `people/${id}.md`,
      name,
      metadata: {},
    };
    peopleIndex.byId.set(id, person);
    peopleIndex.byName.set(name, person.id);
  }

  test('resolves PersonMentionRef object', () => {
    addPerson('erik', 'Erik');

    const mention: PersonMentionRef = {
      raw: '@Erik',
      personName: 'Erik',
      position: { line: 1, column: 0 },
    };

    const result = resolvePersonMentionRef(mention, peopleIndex);
    expect(result.status).toBe('resolved');
    expect(result.personId).toBe('erik');
    expect(result.normalizedName).toBe('Erik');
  });

  test('handles unresolved PersonMentionRef', () => {
    const mention: PersonMentionRef = {
      raw: '@Unknown',
      personName: 'Unknown',
      position: { line: 5, column: 10 },
    };

    const result = resolvePersonMentionRef(mention, peopleIndex);
    expect(result.status).toBe('unresolved');
    expect(result.personId).toBeUndefined();
    expect(result.normalizedName).toBe('Unknown');
  });

  test('trims whitespace from PersonMentionRef', () => {
    addPerson('alice', 'Alice');

    const mention: PersonMentionRef = {
      raw: '@  Alice  ',
      personName: '  Alice  ',
      position: { line: 1, column: 0 },
    };

    const result = resolvePersonMentionRef(mention, peopleIndex);
    expect(result.status).toBe('resolved');
    expect(result.personId).toBe('alice');
  });
});
