/**
 * Tests for sync configuration loading and saving.
 *
 * These tests verify the "disabled by default" pattern and ensure
 * config file handling is robust against edge cases.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { SyncConfig } from '@scribe/shared';
import {
  loadSyncConfig,
  isSyncEnabled,
  saveSyncConfig,
  createDefaultSyncConfig,
} from './sync-config.js';

describe('sync-config', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sync-config-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('loadSyncConfig', () => {
    it('returns disabled/missing when sync.json does not exist', async () => {
      const result = await loadSyncConfig(tempDir);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('missing');
      }
    });

    it('returns disabled/disabled when enabled is false', async () => {
      await mkdir(join(tempDir, '.scribe'), { recursive: true });
      await writeFile(join(tempDir, '.scribe/sync.json'), JSON.stringify({ enabled: false }));

      const result = await loadSyncConfig(tempDir);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('disabled');
      }
    });

    it('returns disabled/malformed when JSON is invalid', async () => {
      await mkdir(join(tempDir, '.scribe'), { recursive: true });
      await writeFile(join(tempDir, '.scribe/sync.json'), 'not valid json {');

      const result = await loadSyncConfig(tempDir);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('malformed');
      }
    });

    it('returns disabled/disabled when enabled is truthy but not true', async () => {
      await mkdir(join(tempDir, '.scribe'), { recursive: true });

      // Test string "true"
      await writeFile(join(tempDir, '.scribe/sync.json'), JSON.stringify({ enabled: 'true' }));
      expect((await loadSyncConfig(tempDir)).status).toBe('disabled');

      // Test number 1
      await writeFile(join(tempDir, '.scribe/sync.json'), JSON.stringify({ enabled: 1 }));
      expect((await loadSyncConfig(tempDir)).status).toBe('disabled');
    });

    it('returns disabled/malformed when config is missing required fields', async () => {
      await mkdir(join(tempDir, '.scribe'), { recursive: true });
      // Only has enabled: true but missing other required fields
      await writeFile(join(tempDir, '.scribe/sync.json'), JSON.stringify({ enabled: true }));

      const result = await loadSyncConfig(tempDir);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('malformed');
      }
    });

    it('returns enabled with config when all fields are valid', async () => {
      const config: SyncConfig = {
        enabled: true,
        serverUrl: 'https://sync.example.com',
        deviceId: 'test-device-id',
        enabledAt: 1735500000000,
        lastSyncSequence: 42,
        syncIntervalMs: 30000,
      };

      await mkdir(join(tempDir, '.scribe'), { recursive: true });
      await writeFile(join(tempDir, '.scribe/sync.json'), JSON.stringify(config));

      const result = await loadSyncConfig(tempDir);

      expect(result.status).toBe('enabled');
      if (result.status === 'enabled') {
        expect(result.config).toEqual(config);
      }
    });

    it('handles .scribe directory not existing', async () => {
      // Don't create .scribe directory
      const result = await loadSyncConfig(tempDir);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('missing');
      }
    });

    it('handles empty config file', async () => {
      await mkdir(join(tempDir, '.scribe'), { recursive: true });
      await writeFile(join(tempDir, '.scribe/sync.json'), '');

      const result = await loadSyncConfig(tempDir);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('malformed');
      }
    });

    it('handles empty JSON object', async () => {
      await mkdir(join(tempDir, '.scribe'), { recursive: true });
      await writeFile(join(tempDir, '.scribe/sync.json'), '{}');

      const result = await loadSyncConfig(tempDir);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('disabled');
      }
    });
  });

  describe('isSyncEnabled', () => {
    it('returns false when config is missing', async () => {
      expect(await isSyncEnabled(tempDir)).toBe(false);
    });

    it('returns false when config has enabled: false', async () => {
      await mkdir(join(tempDir, '.scribe'), { recursive: true });
      await writeFile(join(tempDir, '.scribe/sync.json'), JSON.stringify({ enabled: false }));

      expect(await isSyncEnabled(tempDir)).toBe(false);
    });

    it('returns true when config is valid with enabled: true', async () => {
      const config: SyncConfig = {
        enabled: true,
        serverUrl: 'https://sync.example.com',
        deviceId: 'test-device-id',
        enabledAt: 1735500000000,
        lastSyncSequence: 0,
        syncIntervalMs: 30000,
      };

      await mkdir(join(tempDir, '.scribe'), { recursive: true });
      await writeFile(join(tempDir, '.scribe/sync.json'), JSON.stringify(config));

      expect(await isSyncEnabled(tempDir)).toBe(true);
    });
  });

  describe('saveSyncConfig', () => {
    it('creates .scribe directory if it does not exist', async () => {
      const config = createDefaultSyncConfig();
      await saveSyncConfig(tempDir, config);

      const content = await readFile(join(tempDir, '.scribe/sync.json'), 'utf-8');
      const saved = JSON.parse(content);

      expect(saved.enabled).toBe(true);
      expect(saved.serverUrl).toBe(config.serverUrl);
    });

    it('writes formatted JSON', async () => {
      const config = createDefaultSyncConfig();
      await saveSyncConfig(tempDir, config);

      const content = await readFile(join(tempDir, '.scribe/sync.json'), 'utf-8');

      // Should have newlines (formatted) and end with newline
      expect(content).toContain('\n');
      expect(content.endsWith('\n')).toBe(true);
    });

    it('overwrites existing config', async () => {
      await mkdir(join(tempDir, '.scribe'), { recursive: true });
      await writeFile(join(tempDir, '.scribe/sync.json'), JSON.stringify({ enabled: false }));

      const config = createDefaultSyncConfig();
      await saveSyncConfig(tempDir, config);

      const result = await loadSyncConfig(tempDir);
      expect(result.status).toBe('enabled');
    });
  });

  describe('createDefaultSyncConfig', () => {
    it('creates a valid config with defaults', () => {
      const config = createDefaultSyncConfig();

      expect(config.enabled).toBe(true);
      expect(config.serverUrl).toBe('https://sync.scribe.app');
      expect(config.syncIntervalMs).toBe(30000);
      expect(config.lastSyncSequence).toBe(0);
      expect(typeof config.deviceId).toBe('string');
      expect(config.deviceId.length).toBeGreaterThan(0);
      expect(typeof config.enabledAt).toBe('number');
      expect(config.enabledAt).toBeGreaterThan(0);
    });

    it('can create disabled config', () => {
      const config = createDefaultSyncConfig(false);
      expect(config.enabled).toBe(false);
    });

    it('generates unique device IDs', () => {
      const config1 = createDefaultSyncConfig();
      const config2 = createDefaultSyncConfig();

      expect(config1.deviceId).not.toBe(config2.deviceId);
    });
  });
});
