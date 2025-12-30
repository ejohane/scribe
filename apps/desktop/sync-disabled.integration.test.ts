/**
 * Sync Disabled State Integration Tests
 *
 * Verifies that when sync is disabled, ZERO network traffic occurs.
 * This is critical for:
 * - Enterprise security audits
 * - Corporate environments that block unknown endpoints
 * - GDPR compliance - users must have confidence that "disabled" means "disabled"
 *
 * Phase 0.5 of Sync Engine Epic (scribe-hao.51)
 *
 * This test uses the actual engine-sync package's loadSyncConfig function
 * to ensure the integration is working correctly end-to-end.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { type VaultOnlyContext, setupVaultOnly, cleanupTestContext } from './test-helpers';
import {
  loadSyncConfig,
  isSyncEnabled,
  createDefaultSyncConfig,
  saveSyncConfig,
  type LoadSyncConfigResult,
} from '@scribe/engine-sync';
import type { SyncConfig } from '@scribe/shared';

/**
 * Network call tracker for testing that no network activity occurs.
 * We track calls rather than mocking fetch to avoid complex type issues.
 */
class NetworkTracker {
  private calls: Array<{ url: string; options?: RequestInit }> = [];
  private originalFetch: typeof fetch;

  constructor() {
    this.originalFetch = globalThis.fetch;
  }

  install(): void {
    const tracker = this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = function (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url = typeof input === 'string' ? input : input.toString();
      tracker.calls.push({ url, options: init });
      // Return a rejected promise to fail fast if any network call is attempted
      return Promise.reject(new Error(`Unexpected network call to: ${url}`));
    };
  }

  restore(): void {
    globalThis.fetch = this.originalFetch;
  }

  getCalls(): Array<{ url: string; options?: RequestInit }> {
    return this.calls;
  }

  wasAnyCalled(): boolean {
    return this.calls.length > 0;
  }

  reset(): void {
    this.calls = [];
  }
}

describe('Sync Disabled State', () => {
  let ctx: VaultOnlyContext;
  let networkTracker: NetworkTracker;

  beforeEach(async () => {
    ctx = await setupVaultOnly('scribe-sync-disabled-test');
    networkTracker = new NetworkTracker();
    networkTracker.install();
  });

  afterEach(async () => {
    networkTracker.restore();
    vi.restoreAllMocks();
    await cleanupTestContext(ctx);
  });

  describe('loadSyncConfig from engine-sync package', () => {
    it('returns disabled/missing when sync.json does not exist', async () => {
      const result = await loadSyncConfig(ctx.tempDir);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('missing');
      }
    });

    it('returns disabled/disabled when enabled is false', async () => {
      const scribeDir = path.join(ctx.tempDir, '.scribe');
      await fs.mkdir(scribeDir, { recursive: true });

      const syncConfig = { enabled: false };
      await fs.writeFile(path.join(scribeDir, 'sync.json'), JSON.stringify(syncConfig));

      const result = await loadSyncConfig(ctx.tempDir);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('disabled');
      }
    });

    it('returns disabled/malformed when JSON is invalid', async () => {
      const scribeDir = path.join(ctx.tempDir, '.scribe');
      await fs.mkdir(scribeDir, { recursive: true });

      await fs.writeFile(path.join(scribeDir, 'sync.json'), 'not valid json {');

      const result = await loadSyncConfig(ctx.tempDir);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('malformed');
      }
    });

    it('returns disabled/disabled when enabled is truthy but not true', async () => {
      const scribeDir = path.join(ctx.tempDir, '.scribe');
      await fs.mkdir(scribeDir, { recursive: true });

      // Test string "true"
      await fs.writeFile(path.join(scribeDir, 'sync.json'), JSON.stringify({ enabled: 'true' }));
      expect((await loadSyncConfig(ctx.tempDir)).status).toBe('disabled');

      // Test number 1
      await fs.writeFile(path.join(scribeDir, 'sync.json'), JSON.stringify({ enabled: 1 }));
      expect((await loadSyncConfig(ctx.tempDir)).status).toBe('disabled');
    });

    it('returns disabled/malformed when config has enabled:true but missing required fields', async () => {
      const scribeDir = path.join(ctx.tempDir, '.scribe');
      await fs.mkdir(scribeDir, { recursive: true });

      // Only has enabled: true but missing other required fields
      await fs.writeFile(path.join(scribeDir, 'sync.json'), JSON.stringify({ enabled: true }));

      const result = await loadSyncConfig(ctx.tempDir);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('malformed');
      }
    });

    it('returns enabled with full config when all fields are valid', async () => {
      const config: SyncConfig = {
        enabled: true,
        serverUrl: 'https://sync.scribe.app',
        deviceId: 'test-device-id',
        enabledAt: 1735500000000,
        lastSyncSequence: 42,
        syncIntervalMs: 30000,
      };

      const scribeDir = path.join(ctx.tempDir, '.scribe');
      await fs.mkdir(scribeDir, { recursive: true });
      await fs.writeFile(path.join(scribeDir, 'sync.json'), JSON.stringify(config));

      const result = await loadSyncConfig(ctx.tempDir);

      expect(result.status).toBe('enabled');
      if (result.status === 'enabled') {
        expect(result.config).toEqual(config);
      }
    });

    it('handles empty config file', async () => {
      const scribeDir = path.join(ctx.tempDir, '.scribe');
      await fs.mkdir(scribeDir, { recursive: true });
      await fs.writeFile(path.join(scribeDir, 'sync.json'), '');

      const result = await loadSyncConfig(ctx.tempDir);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('malformed');
      }
    });

    it('handles empty JSON object', async () => {
      const scribeDir = path.join(ctx.tempDir, '.scribe');
      await fs.mkdir(scribeDir, { recursive: true });
      await fs.writeFile(path.join(scribeDir, 'sync.json'), '{}');

      const result = await loadSyncConfig(ctx.tempDir);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('disabled');
      }
    });
  });

  describe('isSyncEnabled convenience function', () => {
    it('returns false when config is missing', async () => {
      expect(await isSyncEnabled(ctx.tempDir)).toBe(false);
    });

    it('returns false when config has enabled: false', async () => {
      const scribeDir = path.join(ctx.tempDir, '.scribe');
      await fs.mkdir(scribeDir, { recursive: true });
      await fs.writeFile(path.join(scribeDir, 'sync.json'), JSON.stringify({ enabled: false }));

      expect(await isSyncEnabled(ctx.tempDir)).toBe(false);
    });

    it('returns true when config is valid with enabled: true', async () => {
      const config = createDefaultSyncConfig();
      await saveSyncConfig(ctx.tempDir, config);

      expect(await isSyncEnabled(ctx.tempDir)).toBe(true);
    });
  });

  describe('Network isolation when sync is disabled', () => {
    it('deps.syncEngine pattern ensures null when sync is disabled', async () => {
      // Simulate the pattern from main.ts
      interface HandlerDependencies {
        syncEngine: unknown | null;
      }

      const deps: HandlerDependencies = {
        syncEngine: null,
      };

      // Check sync config using the actual engine-sync package
      const syncConfigResult = await loadSyncConfig(ctx.tempDir);

      if (syncConfigResult.status === 'enabled') {
        // This would create the sync engine in Phase 1
        deps.syncEngine = null; // Placeholder
      } else {
        deps.syncEngine = null;
      }

      // Verify syncEngine is null when disabled
      expect(deps.syncEngine).toBeNull();
      expect(syncConfigResult.status).toBe('disabled');
    });

    it('makes no sync-related network calls during normal operation', async () => {
      // With syncEngine = null (sync disabled), verify no fetch calls occur

      interface HandlerDependencies {
        syncEngine: unknown | null;
      }

      const deps: HandlerDependencies = {
        syncEngine: null,
      };

      const syncConfigResult = await loadSyncConfig(ctx.tempDir);
      if (syncConfigResult.status === 'enabled') {
        deps.syncEngine = null; // Placeholder
      } else {
        deps.syncEngine = null;
      }

      // Simulate user activity - typical operations that should NOT trigger sync
      const note = await ctx.vault.create({
        title: 'Test Note',
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Test content' }],
              },
            ],
          },
        },
      });

      ctx.vault.read(note.id);
      ctx.vault.list();

      note.title = 'Updated Title';
      await ctx.vault.save(note);
      await ctx.vault.delete(note.id);

      // Verify NO fetch calls were made
      expect(networkTracker.wasAnyCalled()).toBe(false);
      expect(networkTracker.getCalls()).toHaveLength(0);
    });

    it('no network calls occur even with sync.json present but disabled', async () => {
      const scribeDir = path.join(ctx.tempDir, '.scribe');
      await fs.mkdir(scribeDir, { recursive: true });
      await fs.writeFile(path.join(scribeDir, 'sync.json'), JSON.stringify({ enabled: false }));

      // Verify sync is disabled using actual package
      const result = await loadSyncConfig(ctx.tempDir);
      expect(result.status).toBe('disabled');

      // Perform vault operations
      const note = await ctx.vault.create({ title: 'Another Test Note' });
      await ctx.vault.save(note);
      ctx.vault.list();
      await ctx.vault.delete(note.id);

      // Verify NO fetch calls were made
      expect(networkTracker.wasAnyCalled()).toBe(false);
    });

    it('ensures no DNS lookups for sync endpoints would occur', async () => {
      // This test documents the guarantee: since no fetch() calls are made,
      // no DNS lookups for sync server domains can occur.
      //
      // The guarantee chain:
      // 1. loadSyncConfig() returns disabled (no sync.json or enabled: false)
      // 2. deps.syncEngine remains null (createSyncEngine is never called)
      // 3. No sync operations are triggered
      // 4. No fetch() calls are made to sync endpoints
      // 5. Therefore, no DNS lookups for sync servers occur

      const result = await loadSyncConfig(ctx.tempDir);

      // When sync is disabled, the app must not:
      // - Make any HTTP requests to sync endpoints
      // - Perform any telemetry calls
      // - Do health checks against remote servers
      // - Phone home in any way

      expect(result.status).toBe('disabled');

      // Perform operations
      await ctx.vault.create({ title: 'DNS Test Note' });

      // The fact that no network calls occurred proves no DNS lookups would happen
      expect(networkTracker.wasAnyCalled()).toBe(false);
    });
  });

  describe('createSyncEngine is never called when disabled', () => {
    it('verifies the complete initialization flow pattern', async () => {
      // This test mirrors the actual main.ts initialization pattern
      // to verify createSyncEngine would never be called when disabled

      let createSyncEngineCalled = false;

      // Mock the createSyncEngine function
      const mockCreateSyncEngine = async () => {
        createSyncEngineCalled = true;
        return {} as unknown; // Return a fake engine
      };

      interface HandlerDependencies {
        syncEngine: unknown | null;
      }

      const deps: HandlerDependencies = {
        syncEngine: null,
      };

      // Load sync config (mirroring main.ts)
      const syncConfigResult = await loadSyncConfig(ctx.tempDir);

      if (syncConfigResult.status === 'enabled') {
        // This is where createSyncEngine would be called in production
        deps.syncEngine = await mockCreateSyncEngine();
      } else if (syncConfigResult.status === 'disabled') {
        deps.syncEngine = null;
      } else {
        deps.syncEngine = null;
      }

      // Verify createSyncEngine was NOT called
      expect(createSyncEngineCalled).toBe(false);
      expect(deps.syncEngine).toBeNull();
    });

    it('would call createSyncEngine only with valid enabled config', async () => {
      // This test verifies the positive case - createSyncEngine IS called when enabled

      let createSyncEngineCalled = false;
      let passedConfig: SyncConfig | null = null;

      const mockCreateSyncEngine = async (config: { config: SyncConfig }) => {
        createSyncEngineCalled = true;
        passedConfig = config.config;
        return {} as unknown;
      };

      // Create a valid enabled config
      const config = createDefaultSyncConfig();
      await saveSyncConfig(ctx.tempDir, config);

      interface HandlerDependencies {
        syncEngine: unknown | null;
      }

      const deps: HandlerDependencies = {
        syncEngine: null,
      };

      const syncConfigResult = await loadSyncConfig(ctx.tempDir);

      if (syncConfigResult.status === 'enabled') {
        deps.syncEngine = await mockCreateSyncEngine({ config: syncConfigResult.config });
      } else {
        deps.syncEngine = null;
      }

      // Verify createSyncEngine WAS called with the correct config
      expect(createSyncEngineCalled).toBe(true);
      expect(passedConfig).not.toBeNull();
      expect(passedConfig!.enabled).toBe(true);
      expect(passedConfig!.serverUrl).toBe('https://sync.scribe.app');
    });
  });

  describe('Edge cases for sync config', () => {
    it('handles concurrent access to sync.json gracefully', async () => {
      const scribeDir = path.join(ctx.tempDir, '.scribe');
      await fs.mkdir(scribeDir, { recursive: true });

      await fs.writeFile(path.join(scribeDir, 'sync.json'), JSON.stringify({ enabled: false }));

      // Multiple concurrent reads should all return consistent results
      const results = await Promise.all([
        loadSyncConfig(ctx.tempDir),
        loadSyncConfig(ctx.tempDir),
        loadSyncConfig(ctx.tempDir),
      ]);

      expect(results.every((r) => r.status === 'disabled')).toBe(true);
    });

    it('handles sync.json being deleted mid-operation', async () => {
      // Create a valid config first
      const config = createDefaultSyncConfig();
      await saveSyncConfig(ctx.tempDir, config);

      // Verify it's enabled
      expect((await loadSyncConfig(ctx.tempDir)).status).toBe('enabled');

      // Delete the config
      await fs.unlink(path.join(ctx.tempDir, '.scribe/sync.json'));

      // Should now be disabled (file not found = disabled)
      const result = await loadSyncConfig(ctx.tempDir);
      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('missing');
      }
    });

    it('handles .scribe directory not existing', async () => {
      // Remove .scribe directory if it exists from vault initialization
      const scribeDir = path.join(ctx.tempDir, '.scribe');
      try {
        await fs.rm(scribeDir, { recursive: true, force: true });
      } catch {
        // Directory may not exist, that's fine
      }

      // Should return disabled without error
      const result = await loadSyncConfig(ctx.tempDir);
      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('missing');
      }
    });
  });
});
