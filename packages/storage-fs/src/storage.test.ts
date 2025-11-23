/**
 * Integration tests for FileSystemVault
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystemVault } from './storage.js';
import { initializeVault } from './vault.js';

describe('FileSystemVault', () => {
  let tempDir: string;
  let vault: FileSystemVault;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(tmpdir(), `scribe-test-${Date.now()}`);
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

    expect(vault.read(note.id)).toBeUndefined();
  });
});
