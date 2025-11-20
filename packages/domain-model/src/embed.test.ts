/**
 * Tests for EmbedRegistry.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { EmbedRegistry } from './embed.js';
import type { NoteId } from './primitives.js';
import type { ParsedEmbed } from './embed.js';

describe('EmbedRegistry', () => {
  let registry: EmbedRegistry;

  beforeEach(() => {
    registry = new EmbedRegistry();
  });

  test('should add embeds for a note', () => {
    const sourceNoteId = 'note:Source.md' as NoteId;
    const embeds: ParsedEmbed[] = [
      { rawText: '![[Plan]]', line: 5 },
      { rawText: '![[Goals]]', line: 10 },
    ];

    registry.addEmbedsForNote(sourceNoteId, embeds);

    expect(registry.size).toBe(2);
    expect(registry.getEmbedsFromNote(sourceNoteId)).toHaveLength(2);
  });

  test('should generate unique embed IDs', () => {
    const sourceNoteId = 'note:Source.md' as NoteId;
    const embeds: ParsedEmbed[] = [
      { rawText: '![[Plan]]', line: 5 },
      { rawText: '![[Plan]]', line: 10 }, // Duplicate
    ];

    registry.addEmbedsForNote(sourceNoteId, embeds);

    const embedIds = registry.getEmbedsFromNote(sourceNoteId);
    expect(embedIds).toHaveLength(2);
    expect(embedIds[0]).not.toBe(embedIds[1]); // Different IDs
  });

  test('should resolve embed targets', () => {
    const sourceNoteId = 'note:Source.md' as NoteId;
    const targetNoteId = 'note:Plan.md' as NoteId;
    const embeds: ParsedEmbed[] = [{ rawText: '![[Plan]]', line: 5 }];

    registry.addEmbedsForNote(sourceNoteId, embeds);
    const embedId = registry.getEmbedsFromNote(sourceNoteId)[0];

    registry.resolveEmbed(embedId, targetNoteId);

    const embed = registry.getEmbed(embedId);
    expect(embed!.targetNoteId).toBe(targetNoteId);
  });

  test('should maintain bidirectional mappings after resolution', () => {
    const sourceNoteId = 'note:Source.md' as NoteId;
    const targetNoteId = 'note:Plan.md' as NoteId;
    const embeds: ParsedEmbed[] = [{ rawText: '![[Plan]]', line: 5 }];

    registry.addEmbedsForNote(sourceNoteId, embeds);
    const embedId = registry.getEmbedsFromNote(sourceNoteId)[0];

    registry.resolveEmbed(embedId, targetNoteId);

    // Check embedsBySourceNote
    expect(registry.getEmbedsFromNote(sourceNoteId)).toEqual([embedId]);

    // Check embedsByTargetNote
    expect(registry.getEmbedsToNote(targetNoteId)).toEqual([embedId]);
  });

  test('should update embed resolution', () => {
    const sourceNoteId = 'note:Source.md' as NoteId;
    const oldTargetId = 'note:Plan.md' as NoteId;
    const newTargetId = 'note:Goals.md' as NoteId;
    const embeds: ParsedEmbed[] = [{ rawText: '![[Plan]]', line: 5 }];

    registry.addEmbedsForNote(sourceNoteId, embeds);
    const embedId = registry.getEmbedsFromNote(sourceNoteId)[0];

    // Initially resolve to oldTargetId
    registry.resolveEmbed(embedId, oldTargetId);
    expect(registry.getEmbedsToNote(oldTargetId)).toEqual([embedId]);

    // Re-resolve to newTargetId
    registry.resolveEmbed(embedId, newTargetId);
    expect(registry.getEmbedsToNote(oldTargetId)).toEqual([]); // Removed from old target
    expect(registry.getEmbedsToNote(newTargetId)).toEqual([embedId]); // Added to new target
  });

  test('should handle unresolved embeds', () => {
    const sourceNoteId = 'note:Source.md' as NoteId;
    const embeds: ParsedEmbed[] = [{ rawText: '![[NonExistent]]', line: 5 }];

    registry.addEmbedsForNote(sourceNoteId, embeds);
    const embedId = registry.getEmbedsFromNote(sourceNoteId)[0];

    const embed = registry.getEmbed(embedId);
    expect(embed!.targetNoteId).toBeUndefined();
  });

  test('should update embeds for a note', () => {
    const sourceNoteId = 'note:Source.md' as NoteId;

    const oldEmbeds: ParsedEmbed[] = [{ rawText: '![[Old]]', line: 5 }];
    registry.addEmbedsForNote(sourceNoteId, oldEmbeds);

    const newEmbeds: ParsedEmbed[] = [
      { rawText: '![[New]]', line: 5 },
      { rawText: '![[Another]]', line: 10 },
    ];
    registry.updateEmbedsForNote(sourceNoteId, newEmbeds);

    expect(registry.size).toBe(2);
    expect(registry.getEmbedsFromNote(sourceNoteId)).toHaveLength(2);
  });

  test('should remove embeds for a note', () => {
    const sourceNoteId = 'note:Source.md' as NoteId;
    const targetNoteId = 'note:Plan.md' as NoteId;
    const embeds: ParsedEmbed[] = [{ rawText: '![[Plan]]', line: 5 }];

    registry.addEmbedsForNote(sourceNoteId, embeds);
    const embedId = registry.getEmbedsFromNote(sourceNoteId)[0];
    registry.resolveEmbed(embedId, targetNoteId);

    registry.removeEmbedsForNote(sourceNoteId);

    expect(registry.size).toBe(0);
    expect(registry.getEmbedsFromNote(sourceNoteId)).toEqual([]);
    expect(registry.getEmbedsToNote(targetNoteId)).toEqual([]); // Cleaned up
  });

  test('should handle multiple embeds to same target', () => {
    const source1 = 'note:Source1.md' as NoteId;
    const source2 = 'note:Source2.md' as NoteId;
    const targetNoteId = 'note:Plan.md' as NoteId;

    registry.addEmbedsForNote(source1, [{ rawText: '![[Plan]]', line: 5 }]);
    registry.addEmbedsForNote(source2, [{ rawText: '![[Plan]]', line: 3 }]);

    const embed1 = registry.getEmbedsFromNote(source1)[0];
    const embed2 = registry.getEmbedsFromNote(source2)[0];

    registry.resolveEmbed(embed1, targetNoteId);
    registry.resolveEmbed(embed2, targetNoteId);

    expect(registry.getEmbedsToNote(targetNoteId)).toEqual([embed1, embed2]);
  });

  test('should store embed properties correctly', () => {
    const sourceNoteId = 'note:Source.md' as NoteId;
    const embeds: ParsedEmbed[] = [{ rawText: '![[Plan#Goals]]', line: 42 }];

    registry.addEmbedsForNote(sourceNoteId, embeds);
    const embedId = registry.getEmbedsFromNote(sourceNoteId)[0];

    const embed = registry.getEmbed(embedId);
    expect(embed).toBeDefined();
    expect(embed!.sourceNoteId).toBe(sourceNoteId);
    expect(embed!.rawText).toBe('![[Plan#Goals]]');
    expect(embed!.line).toBe(42);
  });

  test('should get all embeds', () => {
    const source1 = 'note:Source1.md' as NoteId;
    const source2 = 'note:Source2.md' as NoteId;

    registry.addEmbedsForNote(source1, [{ rawText: '![[Plan]]', line: 1 }]);
    registry.addEmbedsForNote(source2, [{ rawText: '![[Goals]]', line: 1 }]);

    const allEmbeds = registry.getAllEmbeds();
    expect(allEmbeds).toHaveLength(2);
  });

  test('should clear all embeds', () => {
    const sourceNoteId = 'note:Source.md' as NoteId;
    registry.addEmbedsForNote(sourceNoteId, [{ rawText: '![[Plan]]', line: 1 }]);

    registry.clear();

    expect(registry.size).toBe(0);
    expect(registry.getAllEmbeds()).toHaveLength(0);
  });
});
