/**
 * Tests for UnlinkedMentionRegistry.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { UnlinkedMentionRegistry } from './unlinked-mentions.js';
import type { NoteId } from './primitives.js';
import type { UnlinkedMention, UnlinkedMentionOccurrence } from './unlinked-mentions.js';

describe('UnlinkedMentionRegistry', () => {
  let registry: UnlinkedMentionRegistry;

  beforeEach(() => {
    registry = new UnlinkedMentionRegistry();
  });

  test('should add unlinked mentions for a note', () => {
    const noteId = 'note:Source.md' as NoteId;
    const mentions: UnlinkedMention[] = [
      {
        noteId,
        candidateTargetId: 'note:Target1.md' as NoteId,
        occurrences: [{ line: 5, startColumn: 10, endColumn: 17 }],
      },
      {
        noteId,
        candidateTargetId: 'note:Target2.md' as NoteId,
        occurrences: [{ line: 10, startColumn: 5, endColumn: 12 }],
      },
    ];

    registry.addMentionsForNote(noteId, mentions);

    expect(registry.size).toBe(1);
    expect(registry.getMentionsInNote(noteId)).toHaveLength(2);
  });

  test('should maintain bidirectional mappings', () => {
    const sourceNote = 'note:Source.md' as NoteId;
    const targetNote = 'note:Target.md' as NoteId;

    const mentions: UnlinkedMention[] = [
      {
        noteId: sourceNote,
        candidateTargetId: targetNote,
        occurrences: [{ line: 5, startColumn: 10, endColumn: 17 }],
      },
    ];

    registry.addMentionsForNote(sourceNote, mentions);

    // Check byNote (outgoing)
    expect(registry.getMentionsInNote(sourceNote)).toHaveLength(1);

    // Check byTarget (incoming)
    const incomingMentions = registry.getMentionsOfNote(targetNote);
    expect(incomingMentions).toHaveLength(1);
    expect(incomingMentions[0].noteId).toBe(sourceNote);
  });

  test('should handle multiple notes mentioning same target', () => {
    const source1 = 'note:Source1.md' as NoteId;
    const source2 = 'note:Source2.md' as NoteId;
    const target = 'note:Target.md' as NoteId;

    const mentions1: UnlinkedMention[] = [
      {
        noteId: source1,
        candidateTargetId: target,
        occurrences: [{ line: 5, startColumn: 10, endColumn: 17 }],
      },
    ];

    const mentions2: UnlinkedMention[] = [
      {
        noteId: source2,
        candidateTargetId: target,
        occurrences: [{ line: 3, startColumn: 5, endColumn: 12 }],
      },
    ];

    registry.addMentionsForNote(source1, mentions1);
    registry.addMentionsForNote(source2, mentions2);

    const incomingMentions = registry.getMentionsOfNote(target);
    expect(incomingMentions).toHaveLength(2);
    expect(incomingMentions.map((m) => m.noteId)).toEqual([source1, source2]);
  });

  test('should update mentions for a note', () => {
    const noteId = 'note:Source.md' as NoteId;

    const oldMentions: UnlinkedMention[] = [
      {
        noteId,
        candidateTargetId: 'note:Old.md' as NoteId,
        occurrences: [{ line: 5, startColumn: 10, endColumn: 13 }],
      },
    ];

    registry.addMentionsForNote(noteId, oldMentions);
    expect(registry.getMentionsInNote(noteId)).toHaveLength(1);

    const newMentions: UnlinkedMention[] = [
      {
        noteId,
        candidateTargetId: 'note:New1.md' as NoteId,
        occurrences: [{ line: 7, startColumn: 10, endColumn: 14 }],
      },
      {
        noteId,
        candidateTargetId: 'note:New2.md' as NoteId,
        occurrences: [{ line: 12, startColumn: 5, endColumn: 9 }],
      },
    ];

    registry.updateMentionsForNote(noteId, newMentions);

    expect(registry.getMentionsInNote(noteId)).toHaveLength(2);
    expect(registry.getMentionsOfNote('note:Old.md' as NoteId)).toHaveLength(0); // Cleaned up
  });

  test('should remove mentions for a note', () => {
    const noteId = 'note:Source.md' as NoteId;
    const targetId = 'note:Target.md' as NoteId;

    const mentions: UnlinkedMention[] = [
      {
        noteId,
        candidateTargetId: targetId,
        occurrences: [{ line: 5, startColumn: 10, endColumn: 17 }],
      },
    ];

    registry.addMentionsForNote(noteId, mentions);
    expect(registry.getMentionsInNote(noteId)).toHaveLength(1);

    registry.removeMentionsForNote(noteId);

    expect(registry.getMentionsInNote(noteId)).toHaveLength(0);
    expect(registry.getMentionsOfNote(targetId)).toHaveLength(0); // Cleaned up
  });

  test('should handle multiple occurrences of same target', () => {
    const noteId = 'note:Source.md' as NoteId;
    const targetId = 'note:Target.md' as NoteId;

    const mentions: UnlinkedMention[] = [
      {
        noteId,
        candidateTargetId: targetId,
        occurrences: [
          { line: 5, startColumn: 10, endColumn: 17 },
          { line: 10, startColumn: 5, endColumn: 12 },
          { line: 15, startColumn: 8, endColumn: 15 },
        ],
      },
    ];

    registry.addMentionsForNote(noteId, mentions);

    const mentionsInNote = registry.getMentionsInNote(noteId);
    expect(mentionsInNote).toHaveLength(1);
    expect(mentionsInNote[0].occurrences).toHaveLength(3);
  });

  test('should get all mentions', () => {
    const note1 = 'note:Source1.md' as NoteId;
    const note2 = 'note:Source2.md' as NoteId;

    registry.addMentionsForNote(note1, [
      {
        noteId: note1,
        candidateTargetId: 'note:Target1.md' as NoteId,
        occurrences: [{ line: 5, startColumn: 10, endColumn: 17 }],
      },
    ]);

    registry.addMentionsForNote(note2, [
      {
        noteId: note2,
        candidateTargetId: 'note:Target2.md' as NoteId,
        occurrences: [{ line: 3, startColumn: 5, endColumn: 12 }],
      },
    ]);

    const allMentions = registry.getAllMentions();
    expect(allMentions).toHaveLength(2);
  });

  test('should recompute all mentions from scratch', () => {
    const note1 = 'note:Source1.md' as NoteId;
    const note2 = 'note:Source2.md' as NoteId;

    // Add some initial mentions
    registry.addMentionsForNote(note1, [
      {
        noteId: note1,
        candidateTargetId: 'note:Old.md' as NoteId,
        occurrences: [{ line: 5, startColumn: 10, endColumn: 13 }],
      },
    ]);

    expect(registry.size).toBe(1);

    // Recompute with new data
    const newMentionsMap = new Map<NoteId, UnlinkedMention[]>();
    newMentionsMap.set(note1, [
      {
        noteId: note1,
        candidateTargetId: 'note:Target1.md' as NoteId,
        occurrences: [{ line: 7, startColumn: 10, endColumn: 17 }],
      },
    ]);
    newMentionsMap.set(note2, [
      {
        noteId: note2,
        candidateTargetId: 'note:Target2.md' as NoteId,
        occurrences: [{ line: 3, startColumn: 5, endColumn: 12 }],
      },
    ]);

    registry.recompute(newMentionsMap);

    expect(registry.size).toBe(2);
    expect(registry.getMentionsInNote(note1)[0].candidateTargetId).toBe('note:Target1.md');
    expect(registry.getMentionsOfNote('note:Old.md' as NoteId)).toHaveLength(0); // Old data cleared
  });

  test('should return empty arrays for non-existent notes', () => {
    expect(registry.getMentionsInNote('note:NonExistent.md' as NoteId)).toEqual([]);
    expect(registry.getMentionsOfNote('note:NonExistent.md' as NoteId)).toEqual([]);
  });

  test('should clear all mentions', () => {
    const noteId = 'note:Source.md' as NoteId;
    registry.addMentionsForNote(noteId, [
      {
        noteId,
        candidateTargetId: 'note:Target.md' as NoteId,
        occurrences: [{ line: 5, startColumn: 10, endColumn: 17 }],
      },
    ]);

    registry.clear();

    expect(registry.size).toBe(0);
    expect(registry.getAllMentions()).toHaveLength(0);
  });

  test('should handle complex mention removal scenarios', () => {
    const source1 = 'note:Source1.md' as NoteId;
    const source2 = 'note:Source2.md' as NoteId;
    const target = 'note:Target.md' as NoteId;

    registry.addMentionsForNote(source1, [
      {
        noteId: source1,
        candidateTargetId: target,
        occurrences: [{ line: 5, startColumn: 10, endColumn: 17 }],
      },
    ]);

    registry.addMentionsForNote(source2, [
      {
        noteId: source2,
        candidateTargetId: target,
        occurrences: [{ line: 3, startColumn: 5, endColumn: 12 }],
      },
    ]);

    expect(registry.getMentionsOfNote(target)).toHaveLength(2);

    // Remove mentions from source1
    registry.removeMentionsForNote(source1);

    // Target should still have mentions from source2
    expect(registry.getMentionsOfNote(target)).toHaveLength(1);
    expect(registry.getMentionsOfNote(target)[0].noteId).toBe(source2);
  });
});
