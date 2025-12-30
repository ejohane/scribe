/**
 * Tests for sync configuration types
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SYNC_CONFIG,
  SYNC_CONFIG_PATH,
  MIN_SYNC_INTERVAL_MS,
  MAX_SYNC_INTERVAL_MS,
  type SyncConfig,
} from './sync-types.js';

describe('SyncConfig types', () => {
  describe('DEFAULT_SYNC_CONFIG', () => {
    it('should have a valid production server URL', () => {
      expect(DEFAULT_SYNC_CONFIG.serverUrl).toBe('https://sync.scribe.app');
      expect(DEFAULT_SYNC_CONFIG.serverUrl).toMatch(/^https:\/\//);
    });

    it('should have a sensible default sync interval', () => {
      // 30 seconds is a reasonable default
      expect(DEFAULT_SYNC_CONFIG.syncIntervalMs).toBe(30000);
      expect(DEFAULT_SYNC_CONFIG.syncIntervalMs).toBeGreaterThanOrEqual(MIN_SYNC_INTERVAL_MS);
      expect(DEFAULT_SYNC_CONFIG.syncIntervalMs).toBeLessThanOrEqual(MAX_SYNC_INTERVAL_MS);
    });

    it('should start with lastSyncSequence at 0', () => {
      expect(DEFAULT_SYNC_CONFIG.lastSyncSequence).toBe(0);
    });

    it('should not include runtime-generated fields', () => {
      // These fields should be generated at runtime, not in defaults
      expect(DEFAULT_SYNC_CONFIG).not.toHaveProperty('enabled');
      expect(DEFAULT_SYNC_CONFIG).not.toHaveProperty('deviceId');
      expect(DEFAULT_SYNC_CONFIG).not.toHaveProperty('enabledAt');
    });
  });

  describe('SYNC_CONFIG_PATH', () => {
    it('should be a relative path under .scribe directory', () => {
      expect(SYNC_CONFIG_PATH).toBe('.scribe/sync.json');
      expect(SYNC_CONFIG_PATH).toMatch(/^\.scribe\//);
      expect(SYNC_CONFIG_PATH).toMatch(/\.json$/);
    });
  });

  describe('sync interval constants', () => {
    it('should have MIN_SYNC_INTERVAL_MS at 5 seconds', () => {
      expect(MIN_SYNC_INTERVAL_MS).toBe(5000);
    });

    it('should have MAX_SYNC_INTERVAL_MS at 1 hour', () => {
      expect(MAX_SYNC_INTERVAL_MS).toBe(3600000);
    });

    it('should have min less than max', () => {
      expect(MIN_SYNC_INTERVAL_MS).toBeLessThan(MAX_SYNC_INTERVAL_MS);
    });
  });

  describe('SyncConfig interface', () => {
    it('should allow creating a valid config with defaults spread', () => {
      const config: SyncConfig = {
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        deviceId: 'test-device-id',
        enabledAt: Date.now(),
      };

      expect(config.enabled).toBe(true);
      expect(config.serverUrl).toBe('https://sync.scribe.app');
      expect(config.deviceId).toBe('test-device-id');
      expect(config.enabledAt).toBeGreaterThan(0);
      expect(config.lastSyncSequence).toBe(0);
      expect(config.syncIntervalMs).toBe(30000);
    });

    it('should allow overriding default values', () => {
      const config: SyncConfig = {
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        deviceId: 'custom-device',
        enabledAt: 1735500000000,
        serverUrl: 'https://custom.sync.server',
        syncIntervalMs: 60000,
        lastSyncSequence: 100,
      };

      expect(config.serverUrl).toBe('https://custom.sync.server');
      expect(config.syncIntervalMs).toBe(60000);
      expect(config.lastSyncSequence).toBe(100);
    });

    it('should enforce all required fields', () => {
      // This is a compile-time check - if this compiles, all fields are present
      const config: SyncConfig = {
        enabled: false,
        serverUrl: 'https://test.server',
        deviceId: 'device-123',
        enabledAt: 1735500000000,
        lastSyncSequence: 0,
        syncIntervalMs: 30000,
      };

      // Runtime verification that all fields are defined
      expect(typeof config.enabled).toBe('boolean');
      expect(typeof config.serverUrl).toBe('string');
      expect(typeof config.deviceId).toBe('string');
      expect(typeof config.enabledAt).toBe('number');
      expect(typeof config.lastSyncSequence).toBe('number');
      expect(typeof config.syncIntervalMs).toBe('number');
    });
  });
});
