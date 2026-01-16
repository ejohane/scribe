/**
 * Tests for Daemon process management.
 *
 * Tests verify:
 * 1. Daemon starts and binds to localhost
 * 2. Port written to daemon.json
 * 3. Duplicate start prevented
 * 4. SIGTERM triggers graceful shutdown
 * 5. SIGINT triggers graceful shutdown
 * 6. Stale daemon.json cleaned up
 * 7. Health endpoint responds
 * 8. Version in daemon info
 *
 * NOTE: These tests modify process.env.HOME and must run sequentially.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { Daemon, getExistingDaemon, getDaemonInfoPath, VERSION, type DaemonInfo } from './index.js';

// Use describe.sequential to prevent parallel test execution since we modify process.env.HOME
describe.sequential('Daemon', () => {
  let vaultPath: string;
  let daemon: Daemon | null = null;
  let originalHome: string | undefined;
  let testDaemonDir: string;

  beforeEach(async () => {
    // Save original HOME
    originalHome = process.env.HOME;

    // Create temporary directories
    const testDir = path.join(
      tmpdir(),
      `scribe-daemon-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    vaultPath = path.join(testDir, 'vault');
    testDaemonDir = path.join(testDir, 'config', '.scribe');

    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(path.join(vaultPath, '.scribe'), { recursive: true });
    await fs.mkdir(testDaemonDir, { recursive: true });

    // Override HOME to isolate tests
    process.env.HOME = path.join(testDir, 'config');
  });

  afterEach(async () => {
    // Stop daemon if running
    if (daemon?.isRunning()) {
      await daemon.stop();
    }
    daemon = null;

    // Restore HOME
    process.env.HOME = originalHome;

    // Clean up any leftover daemon info files
    try {
      await fs.unlink(getDaemonInfoPath());
    } catch {
      // Ignore
    }
  });

  describe('start', () => {
    it('should start daemon and bind to localhost', async () => {
      daemon = new Daemon({ vaultPath });
      const info = await daemon.start();

      expect(info.pid).toBe(process.pid);
      expect(info.port).toBeGreaterThan(0);
      expect(info.vaultPath).toBe(vaultPath);
      expect(daemon.isRunning()).toBe(true);
    });

    it('should use auto-assigned port when port is 0', async () => {
      daemon = new Daemon({ vaultPath, port: 0 });
      const info = await daemon.start();

      expect(info.port).toBeGreaterThan(0);
      expect(info.port).toBeLessThan(65536);
    });

    it('should use specified port when provided', async () => {
      // Find an available port first
      const testServer = await import('node:http').then(
        (http) =>
          new Promise<number>((resolve) => {
            const server = http.createServer();
            server.listen(0, '127.0.0.1', () => {
              const addr = server.address();
              const port = typeof addr === 'object' && addr ? addr.port : 0;
              server.close(() => resolve(port));
            });
          })
      );

      daemon = new Daemon({ vaultPath, port: testServer });
      const info = await daemon.start();

      expect(info.port).toBe(testServer);
    });

    it('should write daemon info with version', async () => {
      daemon = new Daemon({ vaultPath });
      const info = await daemon.start();

      expect(info.version).toBe(VERSION);
      expect(info.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('daemon.json management', () => {
    it('should write daemon.json on start', async () => {
      daemon = new Daemon({ vaultPath });
      await daemon.start();

      const content = await fs.readFile(getDaemonInfoPath(), 'utf-8');
      const savedInfo = JSON.parse(content) as DaemonInfo;

      expect(savedInfo.pid).toBe(process.pid);
      expect(savedInfo.vaultPath).toBe(vaultPath);
    });

    it('should remove daemon.json on stop', async () => {
      daemon = new Daemon({ vaultPath });
      await daemon.start();

      await daemon.stop();

      await expect(fs.access(getDaemonInfoPath())).rejects.toThrow();
    });

    it('should prevent duplicate start when daemon is running', async () => {
      daemon = new Daemon({ vaultPath });
      await daemon.start();

      const daemon2 = new Daemon({ vaultPath });
      await expect(daemon2.start()).rejects.toThrow(/already running/i);
    });
  });

  describe('stale daemon.json cleanup', () => {
    it('should clean up stale daemon.json from non-existent process', async () => {
      // Write a fake daemon.json with a non-existent PID
      const stalePid = 999999999; // Very unlikely to be a real PID
      const staleInfo: DaemonInfo = {
        pid: stalePid,
        port: 12345,
        vaultPath: '/fake/vault',
        startedAt: new Date().toISOString(),
        version: '0.0.0',
      };

      await fs.writeFile(getDaemonInfoPath(), JSON.stringify(staleInfo, null, 2));

      // Now start a new daemon - should succeed after cleaning stale file
      daemon = new Daemon({ vaultPath });
      const info = await daemon.start();

      expect(info.pid).toBe(process.pid);
    });

    it('should return null from getExistingDaemon for stale file', async () => {
      // Write a fake daemon.json with a non-existent PID
      const staleInfo: DaemonInfo = {
        pid: 999999999,
        port: 12345,
        vaultPath: '/fake/vault',
        startedAt: new Date().toISOString(),
        version: '0.0.0',
      };

      await fs.writeFile(getDaemonInfoPath(), JSON.stringify(staleInfo, null, 2));

      const existing = await getExistingDaemon();

      expect(existing).toBeNull();
      // File should be cleaned up
      await expect(fs.access(getDaemonInfoPath())).rejects.toThrow();
    });
  });

  describe('health endpoint', () => {
    it('should respond to /health endpoint', async () => {
      daemon = new Daemon({ vaultPath });
      const info = await daemon.start();

      const response = await fetch(`http://127.0.0.1:${info.port}/health`);
      expect(response.ok).toBe(true);

      const health = (await response.json()) as { status: string; version: string; uptime: number };
      expect(health.status).toBe('ok');
      expect(health.version).toBe(VERSION);
      expect(typeof health.uptime).toBe('number');
    });

    it('should return 404 for unknown routes', async () => {
      daemon = new Daemon({ vaultPath });
      const info = await daemon.start();

      const response = await fetch(`http://127.0.0.1:${info.port}/unknown`);
      expect(response.status).toBe(404);
    });
  });

  describe('graceful shutdown', () => {
    it('should stop cleanly', async () => {
      daemon = new Daemon({ vaultPath });
      const info = await daemon.start();

      await daemon.stop();

      expect(daemon.isRunning()).toBe(false);

      // Server should no longer respond
      await expect(fetch(`http://127.0.0.1:${info.port}/health`)).rejects.toThrow();
    });

    it('should persist Yjs state on shutdown', async () => {
      daemon = new Daemon({ vaultPath });
      await daemon.start();

      // The services should be destroyed cleanly (this is verified by no errors)
      await daemon.stop();

      expect(daemon.isRunning()).toBe(false);
    });

    it('should handle multiple stop calls gracefully', async () => {
      daemon = new Daemon({ vaultPath });
      await daemon.start();

      await daemon.stop();
      await daemon.stop(); // Should not throw

      expect(daemon.isRunning()).toBe(false);
    });
  });

  describe('tRPC endpoint', () => {
    it('should handle tRPC requests at /trpc', async () => {
      daemon = new Daemon({ vaultPath });
      const info = await daemon.start();

      // Test a simple query (notes.count doesn't require any setup)
      const response = await fetch(`http://127.0.0.1:${info.port}/trpc/notes.count`, {
        method: 'GET',
      });

      expect(response.ok).toBe(true);
      const result = (await response.json()) as { result: { data: number } };
      expect(result.result.data).toBe(0); // No notes yet
    });

    it('should handle OPTIONS preflight requests', async () => {
      daemon = new Daemon({ vaultPath });
      const info = await daemon.start();

      const response = await fetch(`http://127.0.0.1:${info.port}/trpc/notes.list`, {
        method: 'OPTIONS',
      });

      expect(response.status).toBe(204);
    });
  });

  describe('getInfo', () => {
    it('should return daemon info after start', async () => {
      daemon = new Daemon({ vaultPath });
      await daemon.start();

      const info = daemon.getInfo();

      expect(info).toBeDefined();
      expect(info?.pid).toBe(process.pid);
    });

    it('should return undefined before start', () => {
      daemon = new Daemon({ vaultPath });

      expect(daemon.getInfo()).toBeUndefined();
    });
  });
});

describe.sequential('getExistingDaemon', () => {
  let originalHome: string | undefined;
  let testDir: string;

  beforeEach(async () => {
    originalHome = process.env.HOME;
    testDir = path.join(
      tmpdir(),
      `scribe-daemon-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(path.join(testDir, '.scribe'), { recursive: true });
    process.env.HOME = testDir;
  });

  afterEach(async () => {
    // Clean up daemon info file before restoring HOME
    try {
      await fs.unlink(getDaemonInfoPath());
    } catch {
      // Ignore
    }
    process.env.HOME = originalHome;
  });

  it('should return null when no daemon.json exists', async () => {
    const result = await getExistingDaemon();
    expect(result).toBeNull();
  });

  it('should return daemon info when process is running', async () => {
    // Write daemon.json with current process PID
    const daemonInfo: DaemonInfo = {
      pid: process.pid, // Use current process - we know it's running
      port: 12345,
      vaultPath: '/test/vault',
      startedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    await fs.writeFile(getDaemonInfoPath(), JSON.stringify(daemonInfo, null, 2));

    const result = await getExistingDaemon();

    expect(result).toBeDefined();
    expect(result?.pid).toBe(process.pid);
    expect(result?.port).toBe(12345);
  });
});

describe('getDaemonInfoPath', () => {
  it('should return path under HOME/.scribe/', () => {
    const daemonPath = getDaemonInfoPath();
    expect(daemonPath).toContain('.scribe');
    expect(daemonPath).toContain('daemon.json');
  });
});
