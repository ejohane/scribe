/**
 * Tests for daemon discovery utilities.
 *
 * Tests verify:
 * 1. discoverDaemon finds running daemon
 * 2. discoverDaemon handles missing daemon.json
 * 3. discoverDaemon handles stale daemon.json
 * 4. discoverDaemon verifies health check
 * 5. URL helpers return correct URLs
 * 6. waitForDaemon polls until daemon available
 *
 * NOTE: These tests modify process.env.HOME and must run sequentially.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import {
  discoverDaemon,
  waitForDaemon,
  getTrpcUrl,
  getWebSocketUrl,
  getHealthUrl,
} from './discovery.js';
import { Daemon, getDaemonInfoPath, type DaemonInfo } from './daemon.js';

// Use describe.sequential to prevent parallel test execution since we modify process.env.HOME
describe.sequential('discoverDaemon', () => {
  let originalHome: string | undefined;
  let testDir: string;
  let vaultPath: string;
  let daemon: Daemon | null = null;

  beforeEach(async () => {
    originalHome = process.env.HOME;
    testDir = path.join(
      tmpdir(),
      `scribe-discovery-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    vaultPath = path.join(testDir, 'vault');

    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(path.join(vaultPath, '.scribe'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'config', '.scribe'), { recursive: true });

    process.env.HOME = path.join(testDir, 'config');
  });

  afterEach(async () => {
    if (daemon?.isRunning()) {
      await daemon.stop();
    }
    daemon = null;
    // Clean up daemon info file before restoring HOME
    try {
      await fs.unlink(getDaemonInfoPath());
    } catch {
      // Ignore
    }
    process.env.HOME = originalHome;
  });

  describe('no daemon running', () => {
    it('should return not found when no daemon.json exists', async () => {
      const result = await discoverDaemon();

      expect(result.found).toBe(false);
      expect(result.info).toBeUndefined();
      expect(result.error).toContain('No daemon info file');
    });

    it('should detect stale daemon.json and clean up', async () => {
      // Write a fake daemon.json with non-existent PID
      const staleInfo: DaemonInfo = {
        pid: 999999999,
        port: 12345,
        vaultPath: '/fake/vault',
        startedAt: new Date().toISOString(),
        version: '0.0.0',
      };

      await fs.writeFile(getDaemonInfoPath(), JSON.stringify(staleInfo, null, 2));

      const result = await discoverDaemon();

      expect(result.found).toBe(false);
      expect(result.error).toContain('stale info file');

      // File should be cleaned up
      await expect(fs.access(getDaemonInfoPath())).rejects.toThrow();
    });
  });

  describe('daemon running', () => {
    it('should find running daemon with health check', async () => {
      daemon = new Daemon({ vaultPath });
      await daemon.start();

      const result = await discoverDaemon();

      expect(result.found).toBe(true);
      expect(result.info).toBeDefined();
      expect(result.info?.pid).toBe(process.pid);
      expect(result.health).toBeDefined();
      expect(result.health?.status).toBe('ok');
    });

    it('should skip health check when verifyHealth is false', async () => {
      daemon = new Daemon({ vaultPath });
      await daemon.start();

      const result = await discoverDaemon({ verifyHealth: false });

      expect(result.found).toBe(true);
      expect(result.info).toBeDefined();
      expect(result.health).toBeUndefined();
    });

    it('should handle health check timeout', async () => {
      // Write daemon.json with current PID but wrong port (no server)
      const fakeInfo: DaemonInfo = {
        pid: process.pid, // Valid PID
        port: 59999, // Port with no server
        vaultPath: '/fake/vault',
        startedAt: new Date().toISOString(),
        version: '0.0.0',
      };

      await fs.writeFile(getDaemonInfoPath(), JSON.stringify(fakeInfo, null, 2));

      const result = await discoverDaemon({ timeout: 100 });

      expect(result.found).toBe(true); // Process exists
      expect(result.info).toBeDefined();
      expect(result.health).toBeUndefined();
      expect(result.error).toContain('not responding');
    });
  });
});

describe('URL helpers', () => {
  const testInfo: DaemonInfo = {
    pid: 12345,
    port: 47832,
    vaultPath: '/test/vault',
    startedAt: '2024-01-15T10:30:00Z',
    version: '1.0.0',
  };

  describe('getTrpcUrl', () => {
    it('should return correct tRPC URL', () => {
      const url = getTrpcUrl(testInfo);
      expect(url).toBe('http://127.0.0.1:47832/trpc');
    });
  });

  describe('getWebSocketUrl', () => {
    it('should return correct WebSocket URL', () => {
      const url = getWebSocketUrl(testInfo);
      expect(url).toBe('ws://127.0.0.1:47832/ws');
    });
  });

  describe('getHealthUrl', () => {
    it('should return correct health URL', () => {
      const url = getHealthUrl(testInfo);
      expect(url).toBe('http://127.0.0.1:47832/health');
    });
  });
});

// Use describe.sequential to prevent parallel test execution since we modify process.env.HOME
describe.sequential('waitForDaemon', () => {
  let originalHome: string | undefined;
  let testDir: string;
  let vaultPath: string;
  let daemon: Daemon | null = null;

  beforeEach(async () => {
    originalHome = process.env.HOME;
    testDir = path.join(
      tmpdir(),
      `scribe-waitfor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    vaultPath = path.join(testDir, 'vault');

    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(path.join(vaultPath, '.scribe'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'config', '.scribe'), { recursive: true });

    process.env.HOME = path.join(testDir, 'config');
  });

  afterEach(async () => {
    if (daemon?.isRunning()) {
      await daemon.stop();
    }
    daemon = null;
    // Clean up daemon info file before restoring HOME
    try {
      await fs.unlink(getDaemonInfoPath());
    } catch {
      // Ignore
    }
    process.env.HOME = originalHome;
  });

  it('should return immediately if daemon is already running', async () => {
    daemon = new Daemon({ vaultPath });
    await daemon.start();

    const startTime = Date.now();
    const result = await waitForDaemon({ maxAttempts: 10, intervalMs: 50 });
    const elapsed = Date.now() - startTime;

    expect(result.found).toBe(true);
    expect(result.health).toBeDefined();
    expect(elapsed).toBeLessThan(200); // Should return quickly
  });

  it('should timeout if daemon never starts', async () => {
    const result = await waitForDaemon({
      maxAttempts: 3,
      intervalMs: 10,
      healthTimeout: 50,
    });

    expect(result.found).toBe(false);
    expect(result.error).toContain('Timeout');
  });

  it('should detect daemon starting during wait', async () => {
    // Start daemon after a short delay
    setTimeout(async () => {
      daemon = new Daemon({ vaultPath });
      await daemon.start();
    }, 100);

    const result = await waitForDaemon({
      maxAttempts: 50,
      intervalMs: 50,
      healthTimeout: 100,
    });

    expect(result.found).toBe(true);
    expect(result.health).toBeDefined();
  });
});
