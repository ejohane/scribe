/**
 * Tests for ScribeClient - the main client class.
 *
 * Tests verify:
 * 1. Constructor and options handling
 * 2. Auto-discovery integration
 * 3. Manual connection configuration
 * 4. Connection lifecycle (connect/disconnect)
 * 5. Status transitions and events
 * 6. API and collab property access
 * 7. Error handling
 *
 * Note: These tests use mock HTTP and WebSocket servers since we can't easily
 * spin up a full daemon in unit tests. Integration tests in the daemon
 * package cover full end-to-end scenarios.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { ScribeClient, type ClientStatus } from './client.js';

// -----------------------------------------------------------------------------
// Mock Server Setup
// -----------------------------------------------------------------------------

interface MockServer {
  httpServer: http.Server;
  wss: WebSocketServer;
  port: number;
  close: () => Promise<void>;
}

async function createMockServer(): Promise<MockServer> {
  return new Promise((resolve) => {
    const httpServer = http.createServer((req, res) => {
      // Handle tRPC requests
      if (req.url?.startsWith('/trpc')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        // Return empty array for notes.list query
        res.end(JSON.stringify([{ result: { data: [] } }]));
        return;
      }

      // Handle health check
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: 1000, version: '1.0.0' }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    const close = (): Promise<void> => {
      return new Promise((resolveClose, rejectClose) => {
        for (const client of wss.clients) {
          client.close();
        }
        wss.close((err) => {
          httpServer.close((httpErr) => {
            if (err || httpErr) {
              rejectClose(err || httpErr);
            } else {
              resolveClose();
            }
          });
        });
      });
    };

    httpServer.listen(0, '127.0.0.1', () => {
      const port = (httpServer.address() as { port: number }).port;
      resolve({ httpServer, wss, port, close });
    });
  });
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('ScribeClient', () => {
  describe('constructor', () => {
    it('should create a client with default options', () => {
      const client = new ScribeClient({ autoConnect: false });

      expect(client).toBeDefined();
      expect(client.status).toBe('disconnected');
      expect(client.isConnected).toBe(false);
    });

    it('should accept manual port configuration', () => {
      const client = new ScribeClient({
        port: 12345,
        autoConnect: false,
      });

      expect(client).toBeDefined();
      expect(client.status).toBe('disconnected');
    });

    it('should accept manual host and port configuration', () => {
      const client = new ScribeClient({
        host: 'localhost',
        port: 12345,
        autoConnect: false,
      });

      expect(client).toBeDefined();
    });

    it('should accept custom connect timeout', () => {
      const client = new ScribeClient({
        connectTimeout: 5000,
        autoConnect: false,
      });

      expect(client).toBeDefined();
    });
  });

  describe('status and isConnected', () => {
    it('should start as disconnected', () => {
      const client = new ScribeClient({ autoConnect: false });

      expect(client.status).toBe('disconnected');
      expect(client.isConnected).toBe(false);
    });
  });

  describe('api and collab getters', () => {
    it('should throw when accessing api before connecting', () => {
      const client = new ScribeClient({ autoConnect: false });

      expect(() => client.api).toThrow('Not connected');
    });

    it('should throw when accessing collab before connecting', () => {
      const client = new ScribeClient({ autoConnect: false });

      expect(() => client.collab).toThrow('Not connected');
    });
  });

  describe('getDaemonInfo', () => {
    it('should return null when not connected', () => {
      const client = new ScribeClient({ autoConnect: false });

      expect(client.getDaemonInfo()).toBeNull();
    });
  });

  describe('connect with manual port', () => {
    let server: MockServer;
    let client: ScribeClient;

    beforeEach(async () => {
      server = await createMockServer();
      client = new ScribeClient({
        port: server.port,
        autoConnect: false,
      });
    });

    afterEach(async () => {
      client.disconnect();
      await server.close();
    });

    it('should connect successfully', async () => {
      await client.connect();

      expect(client.status).toBe('connected');
      expect(client.isConnected).toBe(true);
    });

    it('should provide api client after connecting', async () => {
      await client.connect();

      expect(() => client.api).not.toThrow();
      expect(client.api).toBeDefined();
    });

    it('should provide collab client after connecting', async () => {
      await client.connect();

      expect(() => client.collab).not.toThrow();
      expect(client.collab).toBeDefined();
    });

    it('should provide daemon info after connecting', async () => {
      await client.connect();

      const info = client.getDaemonInfo();
      expect(info).not.toBeNull();
      expect(info?.port).toBe(server.port);
    });

    it('should emit status-change events', async () => {
      const statusChanges: ClientStatus[] = [];
      client.on('status-change', (status) => statusChanges.push(status));

      await client.connect();

      expect(statusChanges).toContain('connecting');
      expect(statusChanges).toContain('connected');
    });

    it('should emit connected event', async () => {
      const connectedSpy = vi.fn();
      client.on('connected', connectedSpy);

      await client.connect();

      expect(connectedSpy).toHaveBeenCalled();
    });

    it('should not reconnect if already connected', async () => {
      await client.connect();

      const statusChangeSpy = vi.fn();
      client.on('status-change', statusChangeSpy);

      // Try connecting again
      await client.connect();

      expect(statusChangeSpy).not.toHaveBeenCalled();
    });

    it('should not reconnect if already connecting', async () => {
      // Start connecting but don't await
      const connectPromise = client.connect();

      // Try to connect again immediately
      await client.connect();

      // Should resolve without error
      await connectPromise;
      expect(client.isConnected).toBe(true);
    });
  });

  describe('disconnect', () => {
    let server: MockServer;
    let client: ScribeClient;

    beforeEach(async () => {
      server = await createMockServer();
      client = new ScribeClient({
        port: server.port,
        autoConnect: false,
      });
    });

    afterEach(async () => {
      client.disconnect();
      await server.close();
    });

    it('should disconnect successfully', async () => {
      await client.connect();
      expect(client.isConnected).toBe(true);

      client.disconnect();

      expect(client.status).toBe('disconnected');
      expect(client.isConnected).toBe(false);
    });

    it('should emit disconnected event', async () => {
      await client.connect();

      const disconnectedSpy = vi.fn();
      client.on('disconnected', disconnectedSpy);

      client.disconnect();

      expect(disconnectedSpy).toHaveBeenCalled();
    });

    it('should emit status-change to disconnected', async () => {
      await client.connect();

      const statusChanges: ClientStatus[] = [];
      client.on('status-change', (status) => statusChanges.push(status));

      client.disconnect();

      expect(statusChanges).toContain('disconnected');
    });

    it('should clear api and collab after disconnect', async () => {
      await client.connect();

      client.disconnect();

      expect(() => client.api).toThrow('Not connected');
      expect(() => client.collab).toThrow('Not connected');
    });

    it('should clear daemon info after disconnect', async () => {
      await client.connect();
      expect(client.getDaemonInfo()).not.toBeNull();

      client.disconnect();

      expect(client.getDaemonInfo()).toBeNull();
    });

    it('should handle disconnect when not connected', () => {
      // Should not throw
      client.disconnect();
      expect(client.status).toBe('disconnected');
    });
  });

  describe('event listeners', () => {
    it('should add event listener', () => {
      const client = new ScribeClient({ autoConnect: false });
      const listener = vi.fn();

      client.on('connected', listener);

      // No assertion needed - just verify no error
    });

    it('should remove event listener', async () => {
      const server = await createMockServer();
      const client = new ScribeClient({
        port: server.port,
        autoConnect: false,
      });

      const listener = vi.fn();
      client.on('connected', listener);
      client.off('connected', listener);

      await client.connect();

      expect(listener).not.toHaveBeenCalled();

      client.disconnect();
      await server.close();
    });

    it('should handle multiple listeners', async () => {
      const server = await createMockServer();
      const client = new ScribeClient({
        port: server.port,
        autoConnect: false,
      });

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      client.on('connected', listener1);
      client.on('connected', listener2);

      await client.connect();

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      client.disconnect();
      await server.close();
    });

    it('should not fail if listener throws', async () => {
      const server = await createMockServer();
      const client = new ScribeClient({
        port: server.port,
        autoConnect: false,
      });

      const badListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      client.on('connected', badListener);
      client.on('connected', goodListener);

      // Should not throw
      await client.connect();

      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();

      client.disconnect();
      await server.close();
    });
  });

  describe('connection errors', () => {
    it('should emit error event on connection failure', async () => {
      const client = new ScribeClient({
        port: 59999, // Non-existent server
        autoConnect: false,
      });

      const errorSpy = vi.fn();
      client.on('error', errorSpy);

      await expect(client.connect()).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalled();
      expect(client.status).toBe('error');
    });

    it('should set status to error on connection failure', async () => {
      const client = new ScribeClient({
        port: 59999,
        autoConnect: false,
      });

      await expect(client.connect()).rejects.toThrow();

      expect(client.status).toBe('error');
    });

    it('should emit status-change to error', async () => {
      const client = new ScribeClient({
        port: 59999,
        autoConnect: false,
      });

      const statusChanges: ClientStatus[] = [];
      client.on('status-change', (status) => statusChanges.push(status));

      await expect(client.connect()).rejects.toThrow();

      expect(statusChanges).toContain('error');
    });
  });

  describe('autoConnect option', () => {
    let server: MockServer;

    beforeEach(async () => {
      server = await createMockServer();
    });

    afterEach(async () => {
      await server.close();
    });

    it('should auto-connect when autoConnect is true', async () => {
      const client = new ScribeClient({
        port: server.port,
        autoConnect: true,
      });

      // Wait for auto-connect
      await new Promise<void>((resolve) => {
        client.on('connected', () => resolve());
        // Timeout fallback
        setTimeout(() => resolve(), 1000);
      });

      expect(client.isConnected).toBe(true);
      client.disconnect();
    });

    it('should not auto-connect when autoConnect is false', async () => {
      const client = new ScribeClient({
        port: server.port,
        autoConnect: false,
      });

      // Give time for potential auto-connect
      await new Promise((r) => setTimeout(r, 100));

      expect(client.isConnected).toBe(false);
    });
  });

  describe('auto-discovery', () => {
    let server: MockServer;
    let tempDir: string;
    let originalHome: string | undefined;

    beforeEach(async () => {
      server = await createMockServer();
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scribe-test-'));
      originalHome = process.env.HOME;
      process.env.HOME = tempDir;
    });

    afterEach(async () => {
      process.env.HOME = originalHome;
      await fs.rm(tempDir, { recursive: true, force: true });
      await server.close();
    });

    it('should discover daemon from config file', async () => {
      // Create daemon.json
      const scribeDir = path.join(tempDir, '.scribe');
      await fs.mkdir(scribeDir, { recursive: true });
      await fs.writeFile(
        path.join(scribeDir, 'daemon.json'),
        JSON.stringify({
          pid: 1234,
          port: server.port,
          vaultPath: '/some/vault',
          startedAt: new Date().toISOString(),
          version: '1.0.0',
        })
      );

      const client = new ScribeClient({
        autoDiscover: true,
        autoConnect: false,
      });

      await client.connect();

      expect(client.isConnected).toBe(true);
      const info = client.getDaemonInfo();
      expect(info?.port).toBe(server.port);

      client.disconnect();
    });

    it('should fail if no daemon.json exists', async () => {
      const client = new ScribeClient({
        autoDiscover: true,
        autoConnect: false,
      });

      await expect(client.connect()).rejects.toThrow('No Scribe daemon found');
    });

    it('should fail if daemon is not responsive', async () => {
      // Create daemon.json pointing to non-existent port
      const scribeDir = path.join(tempDir, '.scribe');
      await fs.mkdir(scribeDir, { recursive: true });
      await fs.writeFile(
        path.join(scribeDir, 'daemon.json'),
        JSON.stringify({
          pid: 1234,
          port: 59999, // Non-existent
          vaultPath: '/some/vault',
          startedAt: new Date().toISOString(),
          version: '1.0.0',
        })
      );

      const client = new ScribeClient({
        autoDiscover: true,
        autoConnect: false,
      });

      await expect(client.connect()).rejects.toThrow('No Scribe daemon found');
    });
  });

  describe('configuration errors', () => {
    it('should fail if no port and autoDiscover is false', async () => {
      const client = new ScribeClient({
        autoDiscover: false,
        autoConnect: false,
      });

      await expect(client.connect()).rejects.toThrow('No daemon connection configured');
    });
  });

  describe('collab disconnection handling', () => {
    let server: MockServer;
    let client: ScribeClient;

    beforeEach(async () => {
      server = await createMockServer();
      client = new ScribeClient({
        port: server.port,
        autoConnect: false,
      });
    });

    afterEach(async () => {
      client.disconnect();
      await server.close();
    });

    it('should update status when collab disconnects', async () => {
      await client.connect();
      expect(client.isConnected).toBe(true);

      // Close WebSocket connections from server side
      for (const ws of server.wss.clients) {
        ws.close();
      }

      // Wait for disconnection to propagate
      await new Promise((r) => setTimeout(r, 100));

      expect(client.status).toBe('disconnected');
    });

    it('should emit disconnected when collab disconnects', async () => {
      await client.connect();

      const disconnectedSpy = vi.fn();
      client.on('disconnected', disconnectedSpy);

      // Close WebSocket connections from server side
      for (const ws of server.wss.clients) {
        ws.close();
      }

      // Wait for disconnection to propagate
      await new Promise((r) => setTimeout(r, 100));

      expect(disconnectedSpy).toHaveBeenCalled();
    });
  });
});
