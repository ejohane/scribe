/**
 * Integration tests for YjsWebSocketServer.
 *
 * Tests verify:
 * 1. WebSocket accepts connections at /ws
 * 2. Client can join a document
 * 3. Client receives sync state on join
 * 4. Updates broadcast to other clients
 * 5. Client can leave a document
 * 6. Disconnection cleans up sessions
 * 7. No memory leaks on disconnect
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { createTestServices, destroyServices, type Services } from '@scribe/server-core';
import { YjsWebSocketServer } from './server.js';
import { type ServerMessage, encodeBytes, decodeBytes } from './protocol.js';

/**
 * Helper to create a WebSocket client and wait for connection.
 */
function createClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

/**
 * Helper to wait for a specific message type from WebSocket.
 */
function waitForMessage<T extends ServerMessage['type']>(
  ws: WebSocket,
  type: T,
  timeout = 5000
): Promise<Extract<ServerMessage, { type: T }>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeout);

    const handler = (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      if (msg.type === type) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(msg as Extract<ServerMessage, { type: T }>);
      }
    };

    ws.on('message', handler);
  });
}

/**
 * Helper to collect multiple messages.
 */
function collectMessages(ws: WebSocket, count: number, timeout = 5000): Promise<ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: ServerMessage[] = [];
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${count} messages, received ${messages.length}`));
    }, timeout);

    const handler = (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      messages.push(msg);
      if (messages.length >= count) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(messages);
      }
    };

    ws.on('message', handler);
  });
}

/**
 * Helper to send a client message.
 */
function sendMessage(ws: WebSocket, msg: { type: string; noteId?: string; update?: string }): void {
  ws.send(JSON.stringify(msg));
}

describe('YjsWebSocketServer', () => {
  let services: Services;
  let vaultPath: string;
  let httpServer: http.Server;
  let wsServer: YjsWebSocketServer;
  let serverPort: number;

  beforeEach(async () => {
    // Create temporary vault directory
    vaultPath = path.join(
      tmpdir(),
      `scribe-ws-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(vaultPath, { recursive: true });

    // Create services with test vault
    services = createTestServices(vaultPath);

    // Create HTTP server
    httpServer = http.createServer();

    // Create WebSocket server
    wsServer = new YjsWebSocketServer(services.collaborationService, httpServer);

    // Start listening on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address();
        if (typeof addr === 'object' && addr) {
          serverPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Close WebSocket server
    await wsServer.close();

    // Close HTTP server
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });

    // Destroy services
    destroyServices(services);

    // Clean up temp directory
    await fs.rm(vaultPath, { recursive: true, force: true }).catch(() => {});
  });

  describe('connection', () => {
    it('should accept WebSocket connections at /ws', async () => {
      const client = await createClient(serverPort);

      expect(client.readyState).toBe(WebSocket.OPEN);
      expect(wsServer.getConnectionCount()).toBe(1);

      client.close();
    });

    it('should track multiple connections', async () => {
      const client1 = await createClient(serverPort);
      const client2 = await createClient(serverPort);

      expect(wsServer.getConnectionCount()).toBe(2);

      client1.close();
      client2.close();
    });

    it('should clean up on disconnect', async () => {
      const client = await createClient(serverPort);
      expect(wsServer.getConnectionCount()).toBe(1);

      client.close();

      // Wait for disconnect to propagate
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wsServer.getConnectionCount()).toBe(0);
    });
  });

  describe('join', () => {
    it('should allow client to join a document', async () => {
      // Create a note first
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const client = await createClient(serverPort);

      // Send join message
      sendMessage(client, { type: 'join', noteId: note.id });

      // Wait for joined response
      const joinedMsg = await waitForMessage(client, 'joined');

      expect(joinedMsg.type).toBe('joined');
      expect(joinedMsg.noteId).toBe(note.id);
      expect(joinedMsg.stateVector).toBeDefined();

      client.close();
    });

    it('should send sync-state after join', async () => {
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const client = await createClient(serverPort);

      // Collect both messages
      const messagesPromise = collectMessages(client, 2);

      sendMessage(client, { type: 'join', noteId: note.id });

      const messages = await messagesPromise;

      expect(messages[0].type).toBe('joined');
      expect(messages[1].type).toBe('sync-state');
      expect((messages[1] as { noteId: string }).noteId).toBe(note.id);

      client.close();
    });

    it('should track client for note after join', async () => {
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const client = await createClient(serverPort);
      sendMessage(client, { type: 'join', noteId: note.id });
      await waitForMessage(client, 'joined');

      expect(wsServer.getNoteClientCount(note.id)).toBe(1);

      client.close();
    });
  });

  describe('leave', () => {
    it('should allow client to leave a document', async () => {
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const client = await createClient(serverPort);

      // Join first
      sendMessage(client, { type: 'join', noteId: note.id });
      await waitForMessage(client, 'joined');

      expect(wsServer.getNoteClientCount(note.id)).toBe(1);

      // Leave
      sendMessage(client, { type: 'leave', noteId: note.id });

      // Wait for leave to process
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wsServer.getNoteClientCount(note.id)).toBe(0);

      client.close();
    });
  });

  describe('sync-update', () => {
    it('should apply updates from client', async () => {
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const client = await createClient(serverPort);

      // Join
      sendMessage(client, { type: 'join', noteId: note.id });
      await collectMessages(client, 2); // joined + sync-state

      // Create a Yjs update
      const clientDoc = new Y.Doc();
      clientDoc.getText('test').insert(0, 'hello from client');
      const update = Y.encodeStateAsUpdate(clientDoc);
      clientDoc.destroy();

      // Send update
      sendMessage(client, {
        type: 'sync-update',
        noteId: note.id,
        update: encodeBytes(update),
      });

      // Wait for update to process
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify update was applied
      const doc = await services.collaborationService.getDoc(note.id);
      expect(doc.getText('test').toString()).toBe('hello from client');

      client.close();
    });

    it('should broadcast updates to other clients', { timeout: 15000 }, async () => {
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      // Connect two clients
      const client1 = await createClient(serverPort);
      const client2 = await createClient(serverPort);

      // Set up listeners BEFORE sending to avoid race conditions
      const messages1Promise = collectMessages(client1, 2, 10000);
      const messages2Promise = collectMessages(client2, 2, 10000);

      // Both join
      sendMessage(client1, { type: 'join', noteId: note.id });
      sendMessage(client2, { type: 'join', noteId: note.id });

      await messages1Promise;
      await messages2Promise;

      // Create update from client1
      const clientDoc = new Y.Doc();
      clientDoc.getText('broadcast').insert(0, 'broadcasted');
      const update = Y.encodeStateAsUpdate(clientDoc);
      clientDoc.destroy();

      // Set up listener for client2 BEFORE sending
      const updatePromise = waitForMessage(client2, 'sync-update', 10000);

      // Client1 sends update
      sendMessage(client1, {
        type: 'sync-update',
        noteId: note.id,
        update: encodeBytes(update),
      });

      // Client2 should receive the broadcast
      const broadcastMsg = await updatePromise;

      expect(broadcastMsg.type).toBe('sync-update');
      expect(broadcastMsg.noteId).toBe(note.id);
      expect(broadcastMsg.update).toBeDefined();

      // Verify update content
      const receivedUpdate = decodeBytes(broadcastMsg.update);
      const verifyDoc = new Y.Doc();
      Y.applyUpdate(verifyDoc, receivedUpdate);
      expect(verifyDoc.getText('broadcast').toString()).toBe('broadcasted');
      verifyDoc.destroy();

      client1.close();
      client2.close();
    });

    it('should not send update back to originator', async () => {
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const client = await createClient(serverPort);

      // Join
      sendMessage(client, { type: 'join', noteId: note.id });
      await collectMessages(client, 2);

      // Track received messages
      const receivedMessages: ServerMessage[] = [];
      client.on('message', (data: Buffer) => {
        receivedMessages.push(JSON.parse(data.toString()) as ServerMessage);
      });

      // Send update
      const clientDoc = new Y.Doc();
      clientDoc.getText('test').insert(0, 'test');
      const update = Y.encodeStateAsUpdate(clientDoc);
      clientDoc.destroy();

      sendMessage(client, {
        type: 'sync-update',
        noteId: note.id,
        update: encodeBytes(update),
      });

      // Wait and check no messages received
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not have received the update back
      const syncUpdates = receivedMessages.filter((m) => m.type === 'sync-update');
      expect(syncUpdates).toHaveLength(0);

      client.close();
    });

    it('should error if not joined to document', async () => {
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const client = await createClient(serverPort);

      // Set up error listener
      const errorPromise = waitForMessage(client, 'error');

      // Send update without joining
      const clientDoc = new Y.Doc();
      clientDoc.getText('test').insert(0, 'test');
      const update = Y.encodeStateAsUpdate(clientDoc);
      clientDoc.destroy();

      sendMessage(client, {
        type: 'sync-update',
        noteId: note.id,
        update: encodeBytes(update),
      });

      const errorMsg = await errorPromise;

      expect(errorMsg.type).toBe('error');
      expect(errorMsg.message).toContain('Not joined');

      client.close();
    });
  });

  describe('disconnect cleanup', () => {
    it('should clean up sessions on disconnect', async () => {
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const client = await createClient(serverPort);

      // Join
      sendMessage(client, { type: 'join', noteId: note.id });
      await waitForMessage(client, 'joined');

      expect(services.collaborationService.getSessionCount(note.id)).toBe(1);

      // Disconnect
      client.close();

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(services.collaborationService.getSessionCount(note.id)).toBe(0);
    });

    it('should clean up all joined notes on disconnect', async () => {
      const note1 = await services.documentService.create({
        title: 'Note 1',
        type: 'note',
      });
      const note2 = await services.documentService.create({
        title: 'Note 2',
        type: 'note',
      });

      const client = await createClient(serverPort);

      // Join both notes
      sendMessage(client, { type: 'join', noteId: note1.id });
      sendMessage(client, { type: 'join', noteId: note2.id });

      await collectMessages(client, 4); // 2 joined + 2 sync-state

      expect(wsServer.getNoteClientCount(note1.id)).toBe(1);
      expect(wsServer.getNoteClientCount(note2.id)).toBe(1);

      // Disconnect
      client.close();

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wsServer.getNoteClientCount(note1.id)).toBe(0);
      expect(wsServer.getNoteClientCount(note2.id)).toBe(0);
    });

    it('should not affect other clients on disconnect', { timeout: 15000 }, async () => {
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const client1 = await createClient(serverPort);
      const client2 = await createClient(serverPort);

      // Set up listeners BEFORE sending to avoid race conditions
      const joined1Promise = waitForMessage(client1, 'joined', 10000);
      const joined2Promise = waitForMessage(client2, 'joined', 10000);

      // Both join
      sendMessage(client1, { type: 'join', noteId: note.id });
      sendMessage(client2, { type: 'join', noteId: note.id });

      await joined1Promise;
      await joined2Promise;

      expect(wsServer.getNoteClientCount(note.id)).toBe(2);

      // Client1 disconnects
      client1.close();

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Client2 should still be connected
      expect(wsServer.getNoteClientCount(note.id)).toBe(1);
      expect(client2.readyState).toBe(WebSocket.OPEN);

      client2.close();
    });
  });

  describe('error handling', () => {
    it('should send error for invalid JSON', async () => {
      const client = await createClient(serverPort);

      const errorPromise = waitForMessage(client, 'error');

      client.send('not json');

      const errorMsg = await errorPromise;

      expect(errorMsg.type).toBe('error');
      expect(errorMsg.code).toBe('PARSE_ERROR');

      client.close();
    });

    it('should send error for invalid message type', async () => {
      const client = await createClient(serverPort);

      const errorPromise = waitForMessage(client, 'error');

      client.send(JSON.stringify({ type: 'invalid-type' }));

      const errorMsg = await errorPromise;

      expect(errorMsg.type).toBe('error');
      expect(errorMsg.code).toBe('PARSE_ERROR');

      client.close();
    });
  });

  describe('public API', () => {
    it('should return active note IDs', async () => {
      const note1 = await services.documentService.create({
        title: 'Note 1',
        type: 'note',
      });
      const note2 = await services.documentService.create({
        title: 'Note 2',
        type: 'note',
      });

      const client = await createClient(serverPort);

      sendMessage(client, { type: 'join', noteId: note1.id });
      sendMessage(client, { type: 'join', noteId: note2.id });

      await collectMessages(client, 4);

      const activeIds = wsServer.getActiveNoteIds();

      expect(activeIds).toHaveLength(2);
      expect(activeIds).toContain(note1.id);
      expect(activeIds).toContain(note2.id);

      client.close();
    });

    it('should close all connections on server close', async () => {
      const client1 = await createClient(serverPort);
      const client2 = await createClient(serverPort);

      expect(wsServer.getConnectionCount()).toBe(2);

      // Close server
      await wsServer.close();

      // Wait for close to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(client1.readyState).toBe(WebSocket.CLOSED);
      expect(client2.readyState).toBe(WebSocket.CLOSED);
    });
  });
});
