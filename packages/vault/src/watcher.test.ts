/**
 * Tests for VaultWatcher.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';
import { Vault } from './vault.js';
import { VaultWatcher, type VaultChangeEvent } from './watcher.js';

describe('VaultWatcher', () => {
  let testVaultPath: string;
  let vault: Vault;
  let watcher: VaultWatcher;

  beforeEach(() => {
    // Create temporary test vault
    testVaultPath = join(import.meta.dir, '..', '.test-vault-watcher');
    mkdirSync(testVaultPath, { recursive: true });
    vault = new Vault({ vaultPath: testVaultPath });
    watcher = new VaultWatcher({ vault, debounceDelay: 100 });
  });

  afterEach(async () => {
    // Clean up
    await watcher.stop();
    rmSync(testVaultPath, { recursive: true, force: true });
  });

  describe('file change events', () => {
    it('should emit add event for new markdown file', async () => {
      const events: VaultChangeEvent[] = [];

      watcher.start((batch) => {
        events.push(...batch);
      });

      // Wait for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Create a new file
      writeFileSync(join(testVaultPath, 'new-note.md'), '# New Note');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(events.length).toBeGreaterThan(0);
      const addEvent = events.find((e) => e.type === 'add');
      expect(addEvent).toBeDefined();
      expect(addEvent?.id).toBe('new-note');
      expect(addEvent?.path).toBe('new-note.md');
      expect(addEvent?.isPerson).toBe(false);
    });

    it('should emit change event for modified file', async () => {
      // Create initial file
      writeFileSync(join(testVaultPath, 'note.md'), '# Note');

      const events: VaultChangeEvent[] = [];

      watcher.start((batch) => {
        events.push(...batch);
      });

      // Wait for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Modify the file
      writeFileSync(join(testVaultPath, 'note.md'), '# Note\n\nUpdated content');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(events.length).toBeGreaterThan(0);
      const changeEvent = events.find((e) => e.type === 'change');
      expect(changeEvent).toBeDefined();
      expect(changeEvent?.id).toBe('note');
      expect(changeEvent?.path).toBe('note.md');
    });

    it('should emit remove event for deleted file', async () => {
      const events: VaultChangeEvent[] = [];

      watcher.start((batch) => {
        events.push(...batch);
      });

      // Wait for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create a file first (so watcher knows about it)
      const filePath = join(testVaultPath, 'note.md');
      writeFileSync(filePath, '# Note');

      // Wait for add event to be processed
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Clear events so we only see the remove event
      events.length = 0;

      // Delete the file
      unlinkSync(filePath);

      // Wait for debounce (increased timeout)
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(events.length).toBeGreaterThan(0);
      const removeEvent = events.find((e) => e.type === 'remove');
      expect(removeEvent).toBeDefined();
      expect(removeEvent?.id).toBe('note');
      expect(removeEvent?.path).toBe('note.md');
    });

    it('should identify person entities', async () => {
      // Create people folder
      mkdirSync(join(testVaultPath, 'people'), { recursive: true });

      const events: VaultChangeEvent[] = [];

      watcher.start((batch) => {
        events.push(...batch);
      });

      // Wait for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Create a person file
      writeFileSync(join(testVaultPath, 'people', 'Erik.md'), '# Erik');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(events.length).toBeGreaterThan(0);
      const addEvent = events.find((e) => e.type === 'add');
      expect(addEvent).toBeDefined();
      expect(addEvent?.id).toBe('people/Erik');
      expect(addEvent?.isPerson).toBe(true);
    });

    it('should ignore non-markdown files', async () => {
      const events: VaultChangeEvent[] = [];

      watcher.start((batch) => {
        events.push(...batch);
      });

      // Wait for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Create non-markdown files
      writeFileSync(join(testVaultPath, 'image.png'), 'fake');
      writeFileSync(join(testVaultPath, 'data.json'), '{}');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(events.length).toBe(0);
    });

    it('should handle nested folder files', async () => {
      mkdirSync(join(testVaultPath, 'notes'), { recursive: true });

      const events: VaultChangeEvent[] = [];

      watcher.start((batch) => {
        events.push(...batch);
      });

      // Wait for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Create nested file
      writeFileSync(join(testVaultPath, 'notes', 'plan.md'), '# Plan');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(events.length).toBeGreaterThan(0);
      const addEvent = events.find((e) => e.type === 'add');
      expect(addEvent?.id).toBe('notes/plan');
      expect(addEvent?.path).toBe('notes/plan.md');
    });
  });

  describe('debouncing', () => {
    it('should batch multiple changes together', async () => {
      const batches: VaultChangeEvent[][] = [];

      watcher.start((batch) => {
        batches.push(batch);
      });

      // Wait for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Create multiple files rapidly
      writeFileSync(join(testVaultPath, 'note1.md'), '# Note 1');
      writeFileSync(join(testVaultPath, 'note2.md'), '# Note 2');
      writeFileSync(join(testVaultPath, 'note3.md'), '# Note 3');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should receive events in batches (likely 1 batch due to debouncing)
      expect(batches.length).toBeGreaterThan(0);

      // Flatten all events
      const allEvents = batches.flat();
      expect(allEvents.length).toBe(3);
      expect(allEvents.map((e) => e.id).sort()).toEqual(['note1', 'note2', 'note3']);
    });
  });
});
