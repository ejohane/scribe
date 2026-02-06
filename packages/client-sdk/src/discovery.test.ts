/**
 * Tests for daemon discovery in the client SDK.
 *
 * Tests verify:
 * 1. discoverDaemon returns info when daemon is running
 * 2. discoverDaemon returns null when not running
 * 3. Health check verifies daemon responsiveness
 * 4. waitForDaemon polls until available
 * 5. Manual config works for browser contexts
 * 6. URL helpers return correct URLs
 * 7. Timeout handled gracefully
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { tmpdir } from 'node:os';
import {
  discoverDaemon,
  waitForDaemon,
  createManualDaemonInfo,
  getTrpcUrl,
  getWebSocketUrl,
  getHealthUrl,
  getDefaultConfigPath,
  type DaemonInfo,
} from './discovery.js';

// Helper to create a simple HTTP server for testing health checks
function createMockDaemon(port: number): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: 100, version: '1.0.0' }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

function closeMockDaemon(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Use sequential tests since we modify process.env.HOME
describe.sequential('discoverDaemon', () => {
  let originalHome: string | undefined;
  let testDir: string;
  let configPath: string;

  beforeEach(async () => {
    originalHome = process.env.HOME;
    testDir = path.join(
      tmpdir(),
      `scribe-client-sdk-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    configPath = path.join(testDir, '.scribe', 'daemon.json');

    await fs.mkdir(path.join(testDir, '.scribe'), { recursive: true });
    process.env.HOME = testDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('no daemon running', () => {
    it('should return null when no daemon.json exists', async () => {
      const result = await discoverDaemon();
      expect(result).toBeNull();
    });

    it('should return null when daemon.json exists but health check fails', async () => {
      const daemonInfo: DaemonInfo = {
        pid: 12345,
        port: 59999, // Port with no server
        vaultPath: '/test/vault',
        startedAt: new Date().toISOString(),
        version: '1.0.0',
      };

      await fs.writeFile(configPath, JSON.stringify(daemonInfo, null, 2));

      const result = await discoverDaemon({ timeout: 100 });
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON in daemon.json', async () => {
      await fs.writeFile(configPath, 'invalid json {{{');

      await expect(discoverDaemon()).rejects.toThrow();
    });
  });

  describe('daemon running', () => {
    let mockServer: http.Server | null = null;

    afterEach(async () => {
      if (mockServer) {
        await closeMockDaemon(mockServer);
        mockServer = null;
      }
    });

    it('should return daemon info when health check passes', async () => {
      // Start mock daemon
      mockServer = await createMockDaemon(0);
      const port = (mockServer.address() as { port: number }).port;

      const daemonInfo: DaemonInfo = {
        pid: process.pid,
        port,
        vaultPath: '/test/vault',
        startedAt: new Date().toISOString(),
        version: '1.0.0',
      };

      await fs.writeFile(configPath, JSON.stringify(daemonInfo, null, 2));

      const result = await discoverDaemon();

      expect(result).not.toBeNull();
      expect(result!.port).toBe(port);
      expect(result!.pid).toBe(process.pid);
      expect(result!.vaultPath).toBe('/test/vault');
    });

    it('should respect custom configPath option', async () => {
      const customPath = path.join(testDir, 'custom', 'daemon.json');
      await fs.mkdir(path.dirname(customPath), { recursive: true });

      // Start mock daemon
      mockServer = await createMockDaemon(0);
      const port = (mockServer.address() as { port: number }).port;

      const daemonInfo: DaemonInfo = {
        pid: process.pid,
        port,
        vaultPath: '/custom/vault',
        startedAt: new Date().toISOString(),
        version: '1.0.0',
      };

      await fs.writeFile(customPath, JSON.stringify(daemonInfo, null, 2));

      const result = await discoverDaemon({ configPath: customPath });

      expect(result).not.toBeNull();
      expect(result!.vaultPath).toBe('/custom/vault');
    });

    it('should handle timeout gracefully', async () => {
      // Create a server that delays responses beyond the timeout
      const slowServer = http.createServer((req, res) => {
        // Never respond - client will timeout
        setTimeout(() => {
          res.writeHead(200);
          res.end();
        }, 5000);
      });

      await new Promise<void>((resolve) => {
        slowServer.listen(0, '127.0.0.1', () => resolve());
      });

      const port = (slowServer.address() as { port: number }).port;
      mockServer = slowServer;

      const daemonInfo: DaemonInfo = {
        pid: process.pid,
        port,
        vaultPath: '/test/vault',
        startedAt: new Date().toISOString(),
        version: '1.0.0',
      };

      await fs.writeFile(configPath, JSON.stringify(daemonInfo, null, 2));

      const result = await discoverDaemon({ timeout: 50 });
      expect(result).toBeNull();
    });
  });
});

describe.sequential('waitForDaemon', () => {
  let originalHome: string | undefined;
  let testDir: string;
  let configPath: string;
  let mockServer: http.Server | null = null;

  beforeEach(async () => {
    originalHome = process.env.HOME;
    testDir = path.join(
      tmpdir(),
      `scribe-client-sdk-wait-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    configPath = path.join(testDir, '.scribe', 'daemon.json');

    await fs.mkdir(path.join(testDir, '.scribe'), { recursive: true });
    process.env.HOME = testDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    if (mockServer) {
      await closeMockDaemon(mockServer);
      mockServer = null;
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should return immediately if daemon is already running', async () => {
    mockServer = await createMockDaemon(0);
    const port = (mockServer.address() as { port: number }).port;

    const daemonInfo: DaemonInfo = {
      pid: process.pid,
      port,
      vaultPath: '/test/vault',
      startedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    await fs.writeFile(configPath, JSON.stringify(daemonInfo, null, 2));

    const startTime = Date.now();
    const result = await waitForDaemon({ timeout: 5000, pollInterval: 100 });
    const elapsed = Date.now() - startTime;

    expect(result).not.toBeNull();
    expect(result.port).toBe(port);
    expect(elapsed).toBeLessThan(500); // Should return quickly
  });

  it('should throw error when daemon not found within timeout', async () => {
    await expect(waitForDaemon({ timeout: 200, pollInterval: 50 })).rejects.toThrow(
      'Daemon not found within 200ms'
    );
  });

  it('should detect daemon starting during wait', async () => {
    // Start daemon after a short delay
    setTimeout(async () => {
      mockServer = await createMockDaemon(0);
      const port = (mockServer.address() as { port: number }).port;

      const daemonInfo: DaemonInfo = {
        pid: process.pid,
        port,
        vaultPath: '/test/vault',
        startedAt: new Date().toISOString(),
        version: '1.0.0',
      };

      await fs.writeFile(configPath, JSON.stringify(daemonInfo, null, 2));
    }, 100);

    const result = await waitForDaemon({
      timeout: 3000,
      pollInterval: 50,
    });

    expect(result).not.toBeNull();
    expect(result.pid).toBe(process.pid);
  });

  it('should use custom configPath', async () => {
    const customPath = path.join(testDir, 'custom', 'daemon.json');
    await fs.mkdir(path.dirname(customPath), { recursive: true });

    mockServer = await createMockDaemon(0);
    const port = (mockServer.address() as { port: number }).port;

    const daemonInfo: DaemonInfo = {
      pid: process.pid,
      port,
      vaultPath: '/custom/vault',
      startedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    await fs.writeFile(customPath, JSON.stringify(daemonInfo, null, 2));

    const result = await waitForDaemon({ configPath: customPath });

    expect(result).not.toBeNull();
    expect(result.vaultPath).toBe('/custom/vault');
  });
});

describe('createManualDaemonInfo', () => {
  it('should create daemon info from port only', () => {
    const info = createManualDaemonInfo({ port: 47900 });

    expect(info.port).toBe(47900);
    expect(info.pid).toBe(0);
    expect(info.vaultPath).toBe('');
    expect(info.startedAt).toBe('');
    expect(info.version).toBe('');
  });

  it('should work with host parameter (ignored but accepted)', () => {
    const info = createManualDaemonInfo({ host: 'localhost', port: 3000 });

    expect(info.port).toBe(3000);
    expect(info.pid).toBe(0);
  });
});

describe('URL helpers', () => {
  const testInfo: DaemonInfo = {
    pid: 12345,
    port: 47900,
    vaultPath: '/test/vault',
    startedAt: '2024-01-15T10:30:00Z',
    version: '1.0.0',
  };

  describe('getTrpcUrl', () => {
    it('should return correct tRPC URL from DaemonInfo', () => {
      const url = getTrpcUrl(testInfo);
      expect(url).toBe('http://127.0.0.1:47900/trpc');
    });

    it('should return correct tRPC URL from port object', () => {
      const url = getTrpcUrl({ port: 3000 });
      expect(url).toBe('http://127.0.0.1:3000/trpc');
    });
  });

  describe('getWebSocketUrl', () => {
    it('should return correct WebSocket URL', () => {
      const url = getWebSocketUrl(testInfo);
      expect(url).toBe('ws://127.0.0.1:47900/ws');
    });

    it('should return correct WebSocket URL from port object', () => {
      const url = getWebSocketUrl({ port: 8080 });
      expect(url).toBe('ws://127.0.0.1:8080/ws');
    });
  });

  describe('getHealthUrl', () => {
    it('should return correct health URL', () => {
      const url = getHealthUrl(testInfo);
      expect(url).toBe('http://127.0.0.1:47900/health');
    });

    it('should return correct health URL from port object', () => {
      const url = getHealthUrl({ port: 9000 });
      expect(url).toBe('http://127.0.0.1:9000/health');
    });
  });
});

describe('getDefaultConfigPath', () => {
  it('should return path under HOME/.scribe', () => {
    const originalHome = process.env.HOME;
    process.env.HOME = '/home/testuser';

    try {
      const configPath = getDefaultConfigPath();
      expect(configPath).toBe('/home/testuser/.scribe/daemon.json');
    } finally {
      process.env.HOME = originalHome;
    }
  });

  it('should handle missing HOME gracefully', () => {
    const originalHome = process.env.HOME;
    delete process.env.HOME;

    try {
      const configPath = getDefaultConfigPath();
      // path.join('', '.scribe', 'daemon.json') returns a relative path
      expect(configPath).toBe('.scribe/daemon.json');
    } finally {
      process.env.HOME = originalHome;
    }
  });
});
