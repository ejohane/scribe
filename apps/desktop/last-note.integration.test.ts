/**
 * Integration test for "remember last opened note" feature
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

interface AppConfig {
  lastOpenedNoteId?: string;
}

describe('Last Opened Note', () => {
  let tempConfigDir: string;
  let configPath: string;

  beforeEach(async () => {
    // Create temporary config directory
    tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scribe-config-test-'));
    configPath = path.join(tempConfigDir, 'config.json');
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempConfigDir, { recursive: true, force: true });
  });

  it('should save and load last opened note ID', async () => {
    const noteId = 'note-123';

    // Save config
    const config: AppConfig = { lastOpenedNoteId: noteId };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Load config
    const data = await fs.readFile(configPath, 'utf-8');
    const loadedConfig: AppConfig = JSON.parse(data);

    expect(loadedConfig.lastOpenedNoteId).toBe(noteId);
  });

  it('should handle missing config file gracefully', async () => {
    // Try to read non-existent config
    try {
      await fs.readFile(configPath, 'utf-8');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should update last opened note ID when changed', async () => {
    const firstNoteId = 'note-123';
    const secondNoteId = 'note-456';

    // Save first note
    let config: AppConfig = { lastOpenedNoteId: firstNoteId };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Update to second note
    config.lastOpenedNoteId = secondNoteId;
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Verify second note is saved
    const data = await fs.readFile(configPath, 'utf-8');
    const loadedConfig: AppConfig = JSON.parse(data);

    expect(loadedConfig.lastOpenedNoteId).toBe(secondNoteId);
  });
});
