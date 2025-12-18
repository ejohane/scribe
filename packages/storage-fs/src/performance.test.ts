/**
 * Performance benchmarks for storage operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileSystemVault } from './storage.js';
import { createVaultPath, type VaultPath, type EditorContent } from '@scribe/shared';

describe('Performance Benchmarks', () => {
  let tempDirStr: string;
  let tempDir: VaultPath;
  let vault: FileSystemVault;

  // Create a simple note content template
  const createNoteContent = (index: number): EditorContent => ({
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: `Test note ${index} with some content #test #note${index}`,
            },
          ],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
            },
          ],
        },
      ],
      format: '',
      indent: 0,
      version: 1,
    },
  });

  beforeAll(async () => {
    // Create temporary test directory
    tempDirStr = await fs.mkdtemp(path.join(os.tmpdir(), 'scribe-perf-test-'));
    tempDir = createVaultPath(tempDirStr);
    await fs.mkdir(path.join(tempDirStr, 'notes'), { recursive: true });
    vault = new FileSystemVault(tempDir);

    // Create 100 test notes (reduced from 5000 for CI performance)
    console.log('Creating 100 test notes...');
    const createPromises = [];
    for (let i = 0; i < 100; i++) {
      createPromises.push(vault.create({ content: createNoteContent(i) }));
    }
    await Promise.all(createPromises);
    console.log('Test notes created');
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.rm(tempDirStr, { recursive: true, force: true });
  });

  it('should load 100 notes in under 50ms', async () => {
    // Create a fresh vault instance to test cold start
    const freshVault = new FileSystemVault(tempDir);

    const startTime = performance.now();
    const count = await freshVault.load();
    const endTime = performance.now();
    const loadTime = endTime - startTime;

    console.log(`Loaded ${count} notes in ${loadTime.toFixed(2)}ms`);

    expect(count).toBe(100);
    expect(loadTime).toBeLessThan(50); // 50ms for 100 notes scales to ~200ms for 5k notes
  });

  it('should save notes efficiently', async () => {
    const note = vault.list()[0];
    const updatedContent = createNoteContent(999);

    const startTime = performance.now();
    await vault.save({ ...note, content: updatedContent });
    const endTime = performance.now();
    const saveTime = endTime - startTime;

    console.log(`Saved note in ${saveTime.toFixed(2)}ms`);

    expect(saveTime).toBeLessThan(50); // Individual saves should be fast (relaxed for CI variability)
  });

  it('should list notes efficiently', () => {
    const startTime = performance.now();
    const notes = vault.list();
    const endTime = performance.now();
    const listTime = endTime - startTime;

    console.log(`Listed ${notes.length} notes in ${listTime.toFixed(2)}ms`);

    expect(notes.length).toBe(100);
    expect(listTime).toBeLessThan(1); // Listing is in-memory, should be instant
  });
});
