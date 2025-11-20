/**
 * Tests for FolderRegistry.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { FolderRegistry } from './folder.js';
import type { NoteId, FilePath } from './primitives.js';

describe('FolderRegistry', () => {
  let registry: FolderRegistry;

  beforeEach(() => {
    registry = new FolderRegistry();
  });

  test('should create folder hierarchy from file path', () => {
    registry.addFolderFromPath('notes/2025/Plan.md' as FilePath);

    expect(registry.size).toBe(2);
    expect(registry.getFolder('notes')).toBeDefined();
    expect(registry.getFolder('notes/2025')).toBeDefined();
  });

  test('should set folder properties correctly', () => {
    registry.addFolderFromPath('notes/2025/Plan.md' as FilePath);

    const notes = registry.getFolder('notes');
    expect(notes!.name).toBe('notes');
    expect(notes!.parentId).toBeUndefined();
    expect(notes!.path).toBe('notes');

    const year2025 = registry.getFolder('notes/2025');
    expect(year2025!.name).toBe('2025');
    expect(year2025!.parentId).toBe('notes');
    expect(year2025!.path).toBe('notes/2025');
  });

  test('should maintain parent-child relationships', () => {
    registry.addFolderFromPath('notes/2025/Q1/Plan.md' as FilePath);

    expect(registry.getChildrenForFolder('notes')).toEqual(new Set(['notes/2025']));
    expect(registry.getChildrenForFolder('notes/2025')).toEqual(new Set(['notes/2025/Q1']));
    expect(registry.getChildrenForFolder('notes/2025/Q1')).toEqual(new Set());
  });

  test('should not duplicate folders', () => {
    registry.addFolderFromPath('notes/2025/Plan.md' as FilePath);
    registry.addFolderFromPath('notes/2025/Goals.md' as FilePath);

    expect(registry.size).toBe(2); // Only 'notes' and 'notes/2025'
  });

  test('should add note to folder', () => {
    const noteId = 'note:notes/Plan.md' as NoteId;

    registry.addNoteToFolder(noteId, 'notes/Plan.md' as FilePath);

    expect(registry.getNotesForFolder('notes')).toEqual(new Set([noteId]));
  });

  test('should handle notes in nested folders', () => {
    const noteId = 'note:notes/2025/Plan.md' as NoteId;

    registry.addNoteToFolder(noteId, 'notes/2025/Plan.md' as FilePath);

    expect(registry.getNotesForFolder('notes/2025')).toEqual(new Set([noteId]));
    expect(registry.getNotesForFolder('notes')).toEqual(new Set()); // Note is not in parent
  });

  test('should remove note from folder', () => {
    const noteId = 'note:notes/Plan.md' as NoteId;

    registry.addNoteToFolder(noteId, 'notes/Plan.md' as FilePath);
    expect(registry.getNotesForFolder('notes')).toEqual(new Set([noteId]));

    registry.removeNoteFromFolder(noteId, 'notes/Plan.md' as FilePath);
    expect(registry.getNotesForFolder('notes')).toEqual(new Set());
  });

  test('should handle root-level files', () => {
    const noteId = 'note:README.md' as NoteId;

    registry.addNoteToFolder(noteId, 'README.md' as FilePath);

    // No folders should be created
    expect(registry.size).toBe(0);
  });

  test('should handle backslashes in paths', () => {
    registry.addFolderFromPath('notes\\2025\\Plan.md' as FilePath);

    // Should normalize to forward slashes
    expect(registry.getFolder('notes/2025')).toBeDefined();
  });

  test('should get all folders sorted by path', () => {
    registry.addFolderFromPath('notes/2025/Plan.md' as FilePath);
    registry.addFolderFromPath('archive/2024/Old.md' as FilePath);

    const allFolders = registry.getAllFolders();
    expect(allFolders).toHaveLength(4);
    expect(allFolders[0].path).toBe('archive');
    expect(allFolders[1].path).toBe('archive/2024');
    expect(allFolders[2].path).toBe('notes');
    expect(allFolders[3].path).toBe('notes/2025');
  });

  test('should handle multiple notes in same folder', () => {
    const note1 = 'note:notes/Plan.md' as NoteId;
    const note2 = 'note:notes/Goals.md' as NoteId;

    registry.addNoteToFolder(note1, 'notes/Plan.md' as FilePath);
    registry.addNoteToFolder(note2, 'notes/Goals.md' as FilePath);

    expect(registry.getNotesForFolder('notes')).toEqual(new Set([note1, note2]));
  });

  test('should clear all folders', () => {
    registry.addFolderFromPath('notes/2025/Plan.md' as FilePath);
    const noteId = 'note:notes/Plan.md' as NoteId;
    registry.addNoteToFolder(noteId, 'notes/Plan.md' as FilePath);

    registry.clear();

    expect(registry.size).toBe(0);
    expect(registry.getAllFolders()).toHaveLength(0);
  });
});
