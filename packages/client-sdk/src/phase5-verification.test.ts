/**
 * Phase 5 Verification Tests - Client SDK Functional
 *
 * These tests verify that the Client SDK meets all acceptance criteria:
 * 1. Daemon discovery works in Node.js
 * 2. Manual config works for browsers
 * 3. ScribeClient connects to daemon
 * 4. All API methods callable
 * 5. Collaboration sync works between clients
 * 6. Events emitted for status changes
 * 7. Error handling provides useful messages
 * 8. Types fully inferred in IDE (compile-time verification)
 *
 * Note: These tests use mock servers since we can't spin up a real daemon
 * in unit tests. The structure verifies the SDK's external API contract.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as Y from 'yjs';
import {
  ScribeClient,
  discoverDaemon,
  createManualDaemonInfo,
  getTrpcUrl,
  getWebSocketUrl,
  getHealthUrl,
  CollabClient,
  createApiClient,
  ApiError,
  isApiError,
  isNotFoundError,
  isNetworkError,
  type ClientStatus,
  type DaemonInfo,
  type DocumentSession,
  type NoteMetadata,
  type SearchResult,
} from './index.js';

// -----------------------------------------------------------------------------
// Mock Server Infrastructure
// -----------------------------------------------------------------------------

interface MockServer {
  httpServer: http.Server;
  wss: WebSocketServer;
  port: number;
  clients: Set<WsWebSocket>;
  messages: Array<{ client: WsWebSocket; data: unknown }>;
  sendToClient: (client: WsWebSocket, message: unknown) => void;
  broadcast: (message: unknown, exclude?: WsWebSocket) => void;
  close: () => Promise<void>;
}

function encodeBytes(data: Uint8Array): string {
  return Buffer.from(data).toString('base64');
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
    const clients = new Set<WsWebSocket>();
    const messages: Array<{ client: WsWebSocket; data: unknown }> = [];

    wss.on('connection', (ws) => {
      clients.add(ws);

      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          messages.push({ client: ws, data: parsed });
        } catch {
          messages.push({ client: ws, data: data.toString() });
        }
      });

      ws.on('close', () => {
        clients.delete(ws);
      });
    });

    const sendToClient = (client: WsWebSocket, message: unknown) => {
      if (client.readyState === WsWebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    };

    const broadcast = (message: unknown, exclude?: WsWebSocket) => {
      for (const client of clients) {
        if (client !== exclude && client.readyState === WsWebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      }
    };

    const close = (): Promise<void> => {
      return new Promise((resolveClose, rejectClose) => {
        for (const client of clients) {
          client.close();
        }
        clients.clear();

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
      resolve({ httpServer, wss, port, clients, messages, sendToClient, broadcast, close });
    });
  });
}

// -----------------------------------------------------------------------------
// AC 1: Daemon Discovery Works in Node.js
// -----------------------------------------------------------------------------

describe('AC1: Daemon Discovery in Node.js', () => {
  let server: MockServer;
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    server = await createMockServer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scribe-phase5-'));
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await fs.rm(tempDir, { recursive: true, force: true });
    await server.close();
  });

  it('should discover daemon from ~/.scribe/daemon.json', async () => {
    // Create daemon.json at expected location
    const scribeDir = path.join(tempDir, '.scribe');
    await fs.mkdir(scribeDir, { recursive: true });
    await fs.writeFile(
      path.join(scribeDir, 'daemon.json'),
      JSON.stringify({
        pid: 1234,
        port: server.port,
        vaultPath: '/test/vault',
        startedAt: new Date().toISOString(),
        version: '1.0.0',
      })
    );

    const info = await discoverDaemon();

    expect(info).not.toBeNull();
    expect(info?.port).toBe(server.port);
    expect(info?.vaultPath).toBe('/test/vault');
  });

  it('should return null when no daemon running', async () => {
    const info = await discoverDaemon();
    expect(info).toBeNull();
  });

  it('should return null when daemon is not responsive (stale file)', async () => {
    // Create daemon.json pointing to non-existent port
    const scribeDir = path.join(tempDir, '.scribe');
    await fs.mkdir(scribeDir, { recursive: true });
    await fs.writeFile(
      path.join(scribeDir, 'daemon.json'),
      JSON.stringify({
        pid: 1234,
        port: 59999, // Non-responsive
        vaultPath: '/test/vault',
        startedAt: new Date().toISOString(),
        version: '1.0.0',
      })
    );

    const info = await discoverDaemon();
    expect(info).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// AC 2: Manual Config Works for Browsers
// -----------------------------------------------------------------------------

describe('AC2: Manual Configuration (Browser Support)', () => {
  let server: MockServer;

  beforeEach(async () => {
    server = await createMockServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('should create daemon info from manual config', () => {
    const info = createManualDaemonInfo({
      host: '127.0.0.1',
      port: server.port,
    });

    expect(info.port).toBe(server.port);
  });

  it('should connect with manual host and port (browser scenario)', async () => {
    const client = new ScribeClient({
      autoDiscover: false,
      host: '127.0.0.1',
      port: server.port,
      autoConnect: false,
    });

    await client.connect();

    expect(client.isConnected).toBe(true);
    client.disconnect();
  });

  it('should generate correct URLs from daemon info', () => {
    const info: DaemonInfo = {
      pid: 1234,
      port: 47900,
      vaultPath: '/test/vault',
      startedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    expect(getTrpcUrl(info)).toBe('http://127.0.0.1:47900/trpc');
    expect(getWebSocketUrl(info)).toBe('ws://127.0.0.1:47900/ws');
    expect(getHealthUrl(info)).toBe('http://127.0.0.1:47900/health');
  });
});

// -----------------------------------------------------------------------------
// AC 3: ScribeClient Connects to Daemon
// -----------------------------------------------------------------------------

describe('AC3: ScribeClient Connection', () => {
  let server: MockServer;

  beforeEach(async () => {
    server = await createMockServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('should establish connection with connect()', async () => {
    const client = new ScribeClient({
      port: server.port,
      autoConnect: false,
    });

    expect(client.isConnected).toBe(false);

    await client.connect();

    expect(client.isConnected).toBe(true);
    expect(client.status).toBe('connected');

    client.disconnect();
  });

  it('should provide api property after connection', async () => {
    const client = new ScribeClient({
      port: server.port,
      autoConnect: false,
    });

    await client.connect();

    expect(client.api).toBeDefined();
    expect(client.api.notes).toBeDefined();

    client.disconnect();
  });

  it('should provide collab property after connection', async () => {
    const client = new ScribeClient({
      port: server.port,
      autoConnect: false,
    });

    await client.connect();

    expect(client.collab).toBeDefined();
    expect(client.collab.isConnected).toBe(true);

    client.disconnect();
  });

  it('should expose daemon info after connection', async () => {
    const client = new ScribeClient({
      port: server.port,
      autoConnect: false,
    });

    await client.connect();

    const info = client.getDaemonInfo();
    expect(info).not.toBeNull();
    expect(info?.port).toBe(server.port);

    client.disconnect();
  });
});

// -----------------------------------------------------------------------------
// AC 4: All API Methods Callable
// -----------------------------------------------------------------------------

describe('AC4: API Methods Callable', () => {
  it('should have typed API client structure', () => {
    // This test verifies the API client type structure
    // The actual calls are mocked, but this ensures the shape is correct
    const api = createApiClient({ port: 12345 });

    // Verify notes namespace exists
    expect(api.notes).toBeDefined();
    expect(api.notes.list).toBeDefined();
    expect(api.notes.get).toBeDefined();
    expect(api.notes.create).toBeDefined();
    expect(api.notes.update).toBeDefined();
    expect(api.notes.delete).toBeDefined();

    // Verify search namespace exists
    expect(api.search).toBeDefined();
    expect(api.search.query).toBeDefined();

    // Verify graph namespace exists
    expect(api.graph).toBeDefined();
    expect(api.graph.backlinks).toBeDefined();
    expect(api.graph.tags).toBeDefined();
    expect(api.graph.stats).toBeDefined();
  });

  it('should have query and mutate methods on endpoints', () => {
    const api = createApiClient({ port: 12345 });

    // Query endpoints have .query method
    expect(api.notes.list.query).toBeInstanceOf(Function);
    expect(api.notes.get.query).toBeInstanceOf(Function);
    expect(api.search.query.query).toBeInstanceOf(Function);
    expect(api.graph.backlinks.query).toBeInstanceOf(Function);

    // Mutate endpoints have .mutate method
    expect(api.notes.create.mutate).toBeInstanceOf(Function);
    expect(api.notes.update.mutate).toBeInstanceOf(Function);
    expect(api.notes.delete.mutate).toBeInstanceOf(Function);
  });
});

// -----------------------------------------------------------------------------
// AC 5: Collaboration Sync Between Clients
// -----------------------------------------------------------------------------

describe('AC5: Multi-Client Collaboration Sync', () => {
  let server: MockServer;
  let client1: CollabClient;
  let client2: CollabClient;

  beforeEach(async () => {
    server = await createMockServer();
    client1 = new CollabClient({ port: server.port });
    client2 = new CollabClient({ port: server.port });
    await Promise.all([client1.connect(), client2.connect()]);
  });

  afterEach(async () => {
    client1.disconnect();
    client2.disconnect();
    await server.close();
  });

  it('should have both clients connected', () => {
    expect(client1.isConnected).toBe(true);
    expect(client2.isConnected).toBe(true);
    expect(server.clients.size).toBe(2);
  });

  it('should allow both clients to join same document', async () => {
    const noteId = 'shared-note';

    // Set up server to respond to join messages
    const respondToJoins = () => {
      for (const msg of server.messages) {
        const data = msg.data as { type: string; noteId: string };
        if (data.type === 'join' && data.noteId === noteId) {
          server.sendToClient(msg.client, {
            type: 'joined',
            noteId,
            stateVector: encodeBytes(new Uint8Array([0])),
          });
          server.sendToClient(msg.client, {
            type: 'sync-state',
            noteId,
            state: encodeBytes(Y.encodeStateAsUpdate(new Y.Doc())),
          });
        }
      }
    };

    // Start join and respond immediately
    const joinPromises = [client1.joinDocument(noteId), client2.joinDocument(noteId)];

    // Periodically respond to join messages
    const interval = setInterval(respondToJoins, 10);

    const [session1, session2] = await Promise.all(joinPromises);
    clearInterval(interval);

    expect(session1.noteId).toBe(noteId);
    expect(session2.noteId).toBe(noteId);
    expect(session1.doc).toBeInstanceOf(Y.Doc);
    expect(session2.doc).toBeInstanceOf(Y.Doc);
  });

  it('should sync changes from client1 to client2 via server relay', async () => {
    const noteId = 'sync-test-note';

    // Set up server to respond to joins and relay updates
    let client1Session: DocumentSession | null = null;
    let client2Session: DocumentSession | null = null;

    const handleServerMessages = () => {
      for (const msg of server.messages) {
        const data = msg.data as { type: string; noteId?: string; update?: string };

        if (data.type === 'join' && data.noteId === noteId) {
          server.sendToClient(msg.client, {
            type: 'joined',
            noteId,
            stateVector: encodeBytes(new Uint8Array([0])),
          });
          server.sendToClient(msg.client, {
            type: 'sync-state',
            noteId,
            state: encodeBytes(Y.encodeStateAsUpdate(new Y.Doc())),
          });
        }

        if (data.type === 'sync-update' && data.noteId === noteId && data.update) {
          // Relay update to other client(s)
          server.broadcast({ type: 'sync-update', noteId, update: data.update }, msg.client);
        }
      }
    };

    const interval = setInterval(handleServerMessages, 10);

    // Both clients join
    [client1Session, client2Session] = await Promise.all([
      client1.joinDocument(noteId),
      client2.joinDocument(noteId),
    ]);

    // Clear message history
    server.messages.length = 0;

    // Client1 makes an edit
    const yText1 = client1Session.doc.getText('content');
    yText1.insert(0, 'Hello from client 1');

    // Wait for sync cycle
    await new Promise((r) => setTimeout(r, 100));

    // Verify client2 received the update
    const yText2 = client2Session.doc.getText('content');
    expect(yText2.toString()).toBe('Hello from client 1');

    clearInterval(interval);
    client1Session.destroy();
    client2Session.destroy();
  });

  it('should handle concurrent edits from both clients', async () => {
    const noteId = 'concurrent-edit-note';

    let session1: DocumentSession | null = null;
    let session2: DocumentSession | null = null;

    const handleServerMessages = () => {
      for (const msg of server.messages) {
        const data = msg.data as { type: string; noteId?: string; update?: string };

        if (data.type === 'join' && data.noteId === noteId) {
          server.sendToClient(msg.client, {
            type: 'joined',
            noteId,
            stateVector: encodeBytes(new Uint8Array([0])),
          });
          server.sendToClient(msg.client, {
            type: 'sync-state',
            noteId,
            state: encodeBytes(Y.encodeStateAsUpdate(new Y.Doc())),
          });
        }

        if (data.type === 'sync-update' && data.noteId === noteId && data.update) {
          server.broadcast({ type: 'sync-update', noteId, update: data.update }, msg.client);
        }
      }
    };

    const interval = setInterval(handleServerMessages, 10);

    [session1, session2] = await Promise.all([
      client1.joinDocument(noteId),
      client2.joinDocument(noteId),
    ]);

    server.messages.length = 0;

    // Both clients make concurrent edits to different keys
    const map1 = session1.doc.getMap('data');
    const map2 = session2.doc.getMap('data');

    map1.set('from1', 'value1');
    map2.set('from2', 'value2');

    // Wait for sync
    await new Promise((r) => setTimeout(r, 100));

    // Both docs should have both keys (Yjs merges concurrent edits)
    expect(map1.get('from1')).toBe('value1');
    expect(map1.get('from2')).toBe('value2');
    expect(map2.get('from1')).toBe('value1');
    expect(map2.get('from2')).toBe('value2');

    clearInterval(interval);
    session1.destroy();
    session2.destroy();
  });
});

// -----------------------------------------------------------------------------
// AC 6: Events Emitted for Status Changes
// -----------------------------------------------------------------------------

describe('AC6: Status Change Events', () => {
  let server: MockServer;

  beforeEach(async () => {
    server = await createMockServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('should emit status-change events during connection lifecycle', async () => {
    const client = new ScribeClient({
      port: server.port,
      autoConnect: false,
    });

    const statusChanges: ClientStatus[] = [];
    client.on('status-change', (status) => statusChanges.push(status));

    await client.connect();
    client.disconnect();

    expect(statusChanges).toContain('connecting');
    expect(statusChanges).toContain('connected');
    expect(statusChanges).toContain('disconnected');
  });

  it('should emit connected event when connection established', async () => {
    const client = new ScribeClient({
      port: server.port,
      autoConnect: false,
    });

    const connectedSpy = vi.fn();
    client.on('connected', connectedSpy);

    await client.connect();

    expect(connectedSpy).toHaveBeenCalledTimes(1);
    client.disconnect();
  });

  it('should emit disconnected event when connection closed', async () => {
    const client = new ScribeClient({
      port: server.port,
      autoConnect: false,
    });

    await client.connect();

    const disconnectedSpy = vi.fn();
    client.on('disconnected', disconnectedSpy);

    client.disconnect();

    expect(disconnectedSpy).toHaveBeenCalledTimes(1);
  });

  it('should emit error event on connection failure', async () => {
    const client = new ScribeClient({
      port: 59999, // Non-existent
      autoConnect: false,
    });

    const errorSpy = vi.fn();
    client.on('error', errorSpy);

    await expect(client.connect()).rejects.toThrow();

    expect(errorSpy).toHaveBeenCalled();
  });

  it('should allow removing event listeners', async () => {
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
  });
});

// -----------------------------------------------------------------------------
// AC 7: Error Handling Provides Useful Messages
// -----------------------------------------------------------------------------

describe('AC7: Error Handling', () => {
  it('should provide clear error when no daemon found', async () => {
    const client = new ScribeClient({
      port: 59999, // Non-existent port
      autoConnect: false,
    });

    await expect(client.connect()).rejects.toThrow(/Cannot connect to daemon|fetch failed/);
  });

  it('should provide clear error when no connection configured', async () => {
    const client = new ScribeClient({
      autoDiscover: false,
      autoConnect: false,
    });

    await expect(client.connect()).rejects.toThrow('No daemon connection configured');
  });

  it('should have ApiError class with proper structure', () => {
    const error = new ApiError('Test error', 'NOT_FOUND', 404);

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('ApiError');
  });

  it('should have error type guard functions', () => {
    const apiError = new ApiError('Test', 'NOT_FOUND', 404);
    const networkError = new ApiError('Test', 'NETWORK_ERROR', undefined);
    const regularError = new Error('Test');

    expect(isApiError(apiError)).toBe(true);
    expect(isApiError(regularError)).toBe(false);

    expect(isNotFoundError(apiError)).toBe(true);
    expect(isNotFoundError(networkError)).toBe(false);

    expect(isNetworkError(networkError)).toBe(true);
    expect(isNetworkError(apiError)).toBe(false);
  });

  it('should throw when accessing api/collab before connecting', () => {
    const client = new ScribeClient({ autoConnect: false });

    expect(() => client.api).toThrow('Not connected');
    expect(() => client.collab).toThrow('Not connected');
  });
});

// -----------------------------------------------------------------------------
// AC 8: Type Safety (Compile-time Verification)
// -----------------------------------------------------------------------------

describe('AC8: Type Safety', () => {
  it('should export all expected types', () => {
    // This test verifies types are exported by importing them
    // If any type is missing, TypeScript compilation will fail

    // Main types - use void to prevent unused warnings
    void ((): ClientStatus => 'connected')();
    void ((): DaemonInfo => ({
      pid: 1,
      port: 1,
      vaultPath: '',
      startedAt: '',
      version: '',
    }))();

    // Session type
    const mockDoc = new Y.Doc();
    void ((): DocumentSession => ({
      noteId: 'test',
      doc: mockDoc,
      destroy: () => {},
    }))();

    // Re-exported server types (compile-time verification)
    void ((): NoteMetadata => ({}) as NoteMetadata)();
    void ((): SearchResult => ({}) as SearchResult)();

    expect(true).toBe(true); // If we get here, types compile correctly
  });

  it('should have properly typed ScribeClient', () => {
    // Verify ScribeClient has expected shape
    const client = new ScribeClient({ autoConnect: false });

    // Properties are typed
    const status: ClientStatus = client.status;
    const connected: boolean = client.isConnected;

    // Methods exist
    expect(typeof client.connect).toBe('function');
    expect(typeof client.disconnect).toBe('function');
    expect(typeof client.getDaemonInfo).toBe('function');
    expect(typeof client.on).toBe('function');
    expect(typeof client.off).toBe('function');

    expect(status).toBe('disconnected');
    expect(connected).toBe(false);
  });

  it('should have properly typed CollabClient', () => {
    const client = new CollabClient({ port: 12345 });

    // Properties
    const connected: boolean = client.isConnected;
    expect(connected).toBe(false);

    // Methods exist and are typed
    expect(typeof client.connect).toBe('function');
    expect(typeof client.disconnect).toBe('function');
    expect(typeof client.joinDocument).toBe('function');
    expect(typeof client.leaveDocument).toBe('function');
    expect(typeof client.getJoinedDocuments).toBe('function');
    expect(typeof client.getDocument).toBe('function');
    expect(typeof client.on).toBe('function');
    expect(typeof client.off).toBe('function');
  });
});

// -----------------------------------------------------------------------------
// Integration Scenario: Full Workflow
// -----------------------------------------------------------------------------

describe('Integration: Full Client Workflow', () => {
  let server: MockServer;

  beforeEach(async () => {
    server = await createMockServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('should complete full connect -> use api -> collaborate -> disconnect workflow', async () => {
    // 1. Create client with manual config (browser scenario)
    const client = new ScribeClient({
      autoDiscover: false,
      port: server.port,
      autoConnect: false,
    });

    // 2. Set up event handlers
    const events: string[] = [];
    client.on('connected', () => events.push('connected'));
    client.on('disconnected', () => events.push('disconnected'));

    // 3. Connect
    await client.connect();
    expect(client.isConnected).toBe(true);
    expect(events).toContain('connected');

    // 4. Access API (structure verification - actual calls mocked)
    expect(client.api.notes).toBeDefined();

    // 5. Access collaboration
    expect(client.collab.isConnected).toBe(true);

    // 6. Get daemon info
    const info = client.getDaemonInfo();
    expect(info?.port).toBe(server.port);

    // 7. Disconnect
    client.disconnect();
    expect(client.isConnected).toBe(false);
    expect(events).toContain('disconnected');

    // 8. Verify cleanup
    expect(client.getDaemonInfo()).toBeNull();
    expect(() => client.api).toThrow('Not connected');
    expect(() => client.collab).toThrow('Not connected');
  });
});
