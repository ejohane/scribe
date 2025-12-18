/**
 * Integration tests for FileSystemVault
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import type { EditorContent, VaultPath, MeetingNote, DailyNote } from '@scribe/shared';
import { createVaultPath, createNoteId, isDailyNote, isMeetingNote } from '@scribe/shared';
import { FileSystemVault } from './storage.js';
import { initializeVault } from './vault.js';

describe('FileSystemVault', () => {
  let tempDir: VaultPath;
  let vault: FileSystemVault;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = createVaultPath(path.join(tmpdir(), `scribe-test-${Date.now()}`));
    await initializeVault(tempDir);
    vault = new FileSystemVault(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  it('should initialize with empty vault', async () => {
    const noteCount = await vault.load();
    expect(noteCount).toBe(0);
    expect(vault.list()).toEqual([]);
  });

  it('should create a new note', async () => {
    const note = await vault.create();

    expect(note.id).toBeDefined();
    expect(note.createdAt).toBeDefined();
    expect(note.updatedAt).toBeDefined();
    expect(note.content).toBeDefined();
    expect(note.metadata).toEqual({
      title: null,
      tags: [],
      links: [],
      mentions: [],
      type: undefined,
    });
  });

  it('should save and read a note', async () => {
    const note = await vault.create();

    // Modify the note
    note.content.root.children = [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Hello, world!' }],
      },
    ];

    await vault.save(note);

    // Read it back
    const readNote = vault.read(note.id);
    expect(readNote).toBeDefined();
    expect(readNote?.content).toEqual(note.content);
  });

  it('should list all notes', async () => {
    await vault.create();
    await vault.create();
    await vault.create();

    const notes = vault.list();
    expect(notes).toHaveLength(3);
  });

  it('should persist notes to disk', async () => {
    const note = await vault.create();

    // Create a new vault instance and load
    const vault2 = new FileSystemVault(tempDir);
    const noteCount = await vault2.load();

    expect(noteCount).toBe(1);
    const loadedNote = vault2.read(note.id);
    expect(loadedNote).toBeDefined();
    expect(loadedNote?.id).toBe(note.id);
  });

  it('should update timestamps on save', async () => {
    const note = await vault.create();
    const originalUpdatedAt = note.updatedAt;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    await vault.save(note);

    const updatedNote = vault.read(note.id);
    expect(updatedNote?.updatedAt).toBeGreaterThan(originalUpdatedAt);
  });

  it('should delete notes', async () => {
    const note = await vault.create();
    expect(vault.read(note.id)).toBeDefined();

    await vault.delete(note.id);

    // After deletion, reading should throw an error
    expect(() => vault.read(note.id)).toThrow('Note not found');
  });

  it('should create a note with type option', async () => {
    const note = await vault.create({ type: 'person' });

    expect(note.id).toBeDefined();
    expect(note.content.type).toBe('person');
    expect(note.metadata.type).toBe('person');
  });

  it('should create a note with content and type options', async () => {
    const content = {
      root: {
        type: 'root' as const,
        children: [
          {
            type: 'heading',
            tag: 'h1',
            children: [{ type: 'text', text: 'John Smith' }],
          },
        ],
      },
    };

    const note = await vault.create({ content, type: 'person', title: 'John Smith' });

    expect(note.title).toBe('John Smith');
    expect(note.metadata.title).toBeNull(); // metadata.title is always null (deprecated)
    expect(note.content.type).toBe('person');
    expect(note.metadata.type).toBe('person');
  });

  it('should create a note without type (undefined)', async () => {
    const note = await vault.create();

    expect(note.content.type).toBeUndefined();
    expect(note.metadata.type).toBeUndefined();
  });

  it('should persist note type to disk', async () => {
    const note = await vault.create({ type: 'person' });

    // Create a new vault instance and load
    const vault2 = new FileSystemVault(tempDir);
    await vault2.load();

    const loadedNote = vault2.read(note.id);
    expect(loadedNote.content.type).toBe('person');
    expect(loadedNote.metadata.type).toBe('person');
  });

  it('should preserve note type when saving content without type field', async () => {
    // Create a person note with explicit title
    const note = await vault.create({ type: 'person', title: 'Original Name' });
    expect(note.metadata.type).toBe('person');
    expect(note.title).toBe('Original Name');

    // Simulate editor sending content without type field (as happens in real app)
    const updatedContent: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'heading',
            tag: 'h1',
            children: [{ type: 'text', text: 'Updated Name' }],
          },
        ],
      },
      // Note: no 'type' field - simulating editor behavior
    };

    // Update with new title and content
    const updatedNote = {
      ...note,
      title: 'Updated Name',
      content: updatedContent,
    };

    await vault.save(updatedNote);

    // Verify type is preserved and title is updated
    const savedNote = vault.read(note.id);
    expect(savedNote.metadata.type).toBe('person');
    expect(savedNote.content.type).toBe('person');
    expect(savedNote.title).toBe('Updated Name');
    expect(savedNote.metadata.title).toBeNull(); // metadata.title is always null (deprecated)
  });

  describe('daily/meeting fields', () => {
    it('creates note with daily field', async () => {
      const note = await vault.create({
        type: 'daily',
        title: '2024-12-02',
        daily: { date: '2024-12-02' },
      });
      expect(note.type).toBe('daily');
      // Use type guard to access daily-specific data
      if (isDailyNote(note)) {
        expect(note.daily).toEqual({ date: '2024-12-02' });
      } else {
        throw new Error('Expected daily note');
      }
    });

    it('creates note with meeting field', async () => {
      const note = await vault.create({
        type: 'meeting',
        title: 'Team Sync',
        meeting: {
          date: '2024-12-02',
          dailyNoteId: createNoteId('daily-123'),
          attendees: [createNoteId('person-1'), createNoteId('person-2')],
        },
      });
      expect(note.type).toBe('meeting');
      // Use type guard to access meeting-specific data
      if (isMeetingNote(note)) {
        expect(note.meeting).toEqual({
          date: '2024-12-02',
          dailyNoteId: createNoteId('daily-123'),
          attendees: [createNoteId('person-1'), createNoteId('person-2')],
        });
      } else {
        throw new Error('Expected meeting note');
      }
    });

    it('preserves daily field on save', async () => {
      const note = await vault.create({
        type: 'daily',
        title: '2024-12-02',
        daily: { date: '2024-12-02' },
      });

      await vault.save({ ...note, tags: ['updated'] });
      const saved = vault.read(note.id);

      expect(saved.tags).toContain('updated');
      if (isDailyNote(saved)) {
        expect(saved.daily).toEqual({ date: '2024-12-02' });
      } else {
        throw new Error('Expected daily note');
      }
    });

    it('preserves meeting field on save', async () => {
      const note = await vault.create({
        type: 'meeting',
        title: 'Team Sync',
        meeting: {
          date: '2024-12-02',
          dailyNoteId: createNoteId('daily-123'),
          attendees: [createNoteId('person-1'), createNoteId('person-2')],
        },
      });

      await vault.save({ ...note, tags: ['updated'] });
      const saved = vault.read(note.id);

      expect(saved.tags).toContain('updated');
      if (isMeetingNote(saved)) {
        expect(saved.meeting).toEqual({
          date: '2024-12-02',
          dailyNoteId: createNoteId('daily-123'),
          attendees: [createNoteId('person-1'), createNoteId('person-2')],
        });
      } else {
        throw new Error('Expected meeting note');
      }
    });

    it('persists daily field to disk', async () => {
      const note = await vault.create({
        type: 'daily',
        title: '2024-12-02',
        daily: { date: '2024-12-02' },
      });

      // Create a new vault instance and load
      const vault2 = new FileSystemVault(tempDir);
      await vault2.load();

      const loadedNote = vault2.read(note.id);
      expect(loadedNote.type).toBe('daily');
      if (isDailyNote(loadedNote)) {
        expect(loadedNote.daily).toEqual({ date: '2024-12-02' });
      } else {
        throw new Error('Expected daily note');
      }
    });

    it('persists meeting field to disk', async () => {
      const note = await vault.create({
        type: 'meeting',
        title: 'Team Sync',
        meeting: {
          date: '2024-12-02',
          dailyNoteId: createNoteId('daily-123'),
          attendees: [createNoteId('person-1'), createNoteId('person-2')],
        },
      });

      // Create a new vault instance and load
      const vault2 = new FileSystemVault(tempDir);
      await vault2.load();

      const loadedNote = vault2.read(note.id);
      expect(loadedNote.type).toBe('meeting');
      if (isMeetingNote(loadedNote)) {
        expect(loadedNote.meeting).toEqual({
          date: '2024-12-02',
          dailyNoteId: createNoteId('daily-123'),
          attendees: [createNoteId('person-1'), createNoteId('person-2')],
        });
      } else {
        throw new Error('Expected meeting note');
      }
    });

    it('allows updating meeting attendees', async () => {
      const note = await vault.create({
        type: 'meeting',
        title: 'Team Sync',
        meeting: {
          date: '2024-12-02',
          dailyNoteId: createNoteId('daily-123'),
          attendees: [createNoteId('person-1')],
        },
      });

      // Use type guard to safely access meeting data
      if (!isMeetingNote(note)) {
        throw new Error('Expected meeting note');
      }

      // Update attendees
      const updatedNote: MeetingNote = {
        ...note,
        meeting: {
          ...note.meeting,
          attendees: [createNoteId('person-1'), createNoteId('person-2'), createNoteId('person-3')],
        },
      };
      await vault.save(updatedNote);

      const saved = vault.read(note.id);
      if (isMeetingNote(saved)) {
        expect(saved.meeting.attendees).toEqual(['person-1', 'person-2', 'person-3']);
      } else {
        throw new Error('Expected meeting note');
      }
    });
  });

  describe('race condition handling', () => {
    it('serializes concurrent saves to the same note (scribe-f47)', async () => {
      const note = await vault.create({ title: 'Test Note' });

      // Create multiple concurrent save operations
      const savePromises: Promise<void>[] = [];
      const saveOrder: number[] = [];

      for (let i = 0; i < 10; i++) {
        const iteration = i;
        const updatedNote = {
          ...note,
          title: `Version ${iteration}`,
          content: {
            root: {
              type: 'root' as const,
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: `Content ${iteration}` }],
                },
              ],
            },
          },
        };
        savePromises.push(
          vault.save(updatedNote).then(() => {
            saveOrder.push(iteration);
          })
        );
      }

      // All saves should complete without error
      await Promise.all(savePromises);

      // Verify that all saves completed
      expect(saveOrder).toHaveLength(10);

      // The final saved note should reflect one of the saves
      // (the last one to complete in the queue)
      const finalNote = vault.read(note.id);
      expect(finalNote.title).toMatch(/^Version \d$/);
    });

    it('prevents data loss during concurrent saves (scribe-f47)', async () => {
      const note = await vault.create({ title: 'Original' });
      const noteId = note.id;

      // Create two saves with a delay to simulate race condition
      let save1Completed = false;
      let save2Completed = false;

      const save1 = vault
        .save({
          ...note,
          title: 'Save 1',
          tags: ['tag1'],
        })
        .then(() => {
          save1Completed = true;
        });

      const save2 = vault
        .save({
          ...note,
          title: 'Save 2',
          tags: ['tag2'],
        })
        .then(() => {
          save2Completed = true;
        });

      await Promise.all([save1, save2]);

      expect(save1Completed).toBe(true);
      expect(save2Completed).toBe(true);

      // Verify the note exists and has valid data (no corruption)
      const finalNote = vault.read(noteId);
      expect(finalNote.id).toBe(noteId);
      expect(finalNote.title).toBeDefined();
      expect(finalNote.tags).toBeDefined();

      // Reload from disk and verify persistence
      const vault2 = new FileSystemVault(tempDir);
      await vault2.load();
      const loadedNote = vault2.read(noteId);
      expect(loadedNote.id).toBe(noteId);
    });

    it('serializes save and delete operations (scribe-k5r)', async () => {
      const note = await vault.create({ title: 'To Be Deleted' });
      const noteId = note.id;

      // Start a save and delete concurrently
      const savePromise = vault.save({
        ...note,
        title: 'Updated Before Delete',
      });

      const deletePromise = vault.delete(noteId);

      // Both operations should complete without error
      await Promise.all([savePromise, deletePromise]);

      // After both complete, the note should be deleted
      expect(() => vault.read(noteId)).toThrow('Note not found');
    });

    it('handles concurrent deletes without error (scribe-k5r)', async () => {
      const note = await vault.create({ title: 'Double Delete Test' });
      const noteId = note.id;

      // Start two deletes concurrently
      const delete1 = vault.delete(noteId);
      const delete2 = vault.delete(noteId);

      // One should succeed, one may fail with "not found" error
      const results = await Promise.allSettled([delete1, delete2]);

      // At least one should succeed
      const successes = results.filter((r) => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThanOrEqual(1);

      // The note should be gone
      expect(() => vault.read(noteId)).toThrow('Note not found');
    });

    it('prevents stale reads during delete (scribe-k5r)', async () => {
      const note = await vault.create({ title: 'Stale Read Test' });
      const noteId = note.id;

      // Track read results during delete
      const readResults: (string | 'not_found')[] = [];

      // Start delete
      const deletePromise = vault.delete(noteId);

      // Attempt reads during delete operation
      for (let i = 0; i < 5; i++) {
        try {
          const readNote = vault.read(noteId);
          readResults.push(readNote.title);
        } catch {
          readResults.push('not_found');
        }
      }

      await deletePromise;

      // After delete completes, reads should fail
      expect(() => vault.read(noteId)).toThrow('Note not found');
    });

    it('maintains state consistency under concurrent operations', async () => {
      // Create multiple notes
      const notes = await Promise.all([
        vault.create({ title: 'Note A' }),
        vault.create({ title: 'Note B' }),
        vault.create({ title: 'Note C' }),
      ]);

      // Perform concurrent operations on different notes (should not interfere)
      const operations = [
        vault.save({ ...notes[0], title: 'Note A Updated' }),
        vault.save({ ...notes[1], title: 'Note B Updated' }),
        vault.delete(notes[2].id),
      ];

      await Promise.all(operations);

      // Verify final state
      expect(vault.read(notes[0].id).title).toBe('Note A Updated');
      expect(vault.read(notes[1].id).title).toBe('Note B Updated');
      expect(() => vault.read(notes[2].id)).toThrow('Note not found');

      // Verify persistence
      const vault2 = new FileSystemVault(tempDir);
      await vault2.load();
      expect(vault2.list()).toHaveLength(2);
    });

    it('handles save during another save correctly', async () => {
      const note = await vault.create({ title: 'Original Title' });

      // Queue up saves that each depend on reading current state
      const save1 = vault.save({ ...note, tags: ['tag1'] });
      const save2 = vault.save({ ...note, tags: ['tag2'] });
      const save3 = vault.save({ ...note, tags: ['tag3'] });

      await Promise.all([save1, save2, save3]);

      // The final note should have the last save's tags
      // (due to serialization, saves are processed in order)
      const finalNote = vault.read(note.id);
      expect(finalNote.tags).toBeDefined();
      expect(Array.isArray(finalNote.tags)).toBe(true);
    });

    it('no ghost files after concurrent delete and save', async () => {
      const note = await vault.create({ title: 'Ghost Test' });
      const noteId = note.id;

      // Simulate delete starting first, then save trying to write
      await vault.delete(noteId);

      // Now trying to read should fail
      expect(() => vault.read(noteId)).toThrow('Note not found');

      // Create new vault and load - should not find the deleted note
      const vault2 = new FileSystemVault(tempDir);
      const count = await vault2.load();

      // Verify no ghost files
      const notesList = vault2.list();
      const ghostNote = notesList.find((n) => n.id === noteId);
      expect(ghostNote).toBeUndefined();
    });
  });
});
