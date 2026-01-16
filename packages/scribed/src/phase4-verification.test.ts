/**
 * Phase 4 Verification Tests - Comprehensive E2E tests for daemon functionality.
 *
 * These tests verify that the daemon is fully functional with all API endpoints
 * and WebSocket communication working as specified in the acceptance criteria.
 *
 * Tests cover:
 * 1. CLI start/stop/status commands
 * 2. tRPC endpoints (notes, search, graph)
 * 3. WebSocket connects and syncs
 * 4. Health endpoint
 * 5. Files created in correct locations
 * 6. Graceful shutdown
 * 7. End-to-end flow
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import WebSocket from 'ws';
import { Daemon, getDaemonInfoPath, type DaemonInfo } from './daemon.js';
import { discoverDaemon, waitForDaemon } from './discovery.js';

// Helper to make tRPC requests
async function trpcQuery<T>(port: number, path: string, input?: unknown): Promise<T> {
  const url = input
    ? `http://127.0.0.1:${port}/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`
    : `http://127.0.0.1:${port}/trpc/${path}`;
  const response = await fetch(url);
  const result = (await response.json()) as { result: { data: T } };
  return result.result.data;
}

async function trpcMutation<T>(port: number, path: string, input: unknown): Promise<T> {
  const response = await fetch(`http://127.0.0.1:${port}/trpc/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const result = (await response.json()) as { result: { data: T } };
  return result.result.data;
}

// Use describe.sequential to prevent parallel test execution since we modify process.env.HOME
describe.sequential('Phase 4 Verification: Daemon Fully Functional', () => {
  let testDir: string;
  let vaultPath: string;
  let daemon: Daemon | null = null;
  let originalHome: string | undefined;
  let port: number;

  beforeAll(async () => {
    // Save original HOME
    originalHome = process.env.HOME;

    // Create temporary directories with unique names
    testDir = path.join(
      tmpdir(),
      `scribe-phase4-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    vaultPath = path.join(testDir, 'vault');

    await fs.mkdir(vaultPath, { recursive: true });
    await fs.mkdir(path.join(vaultPath, '.scribe'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'config', '.scribe'), { recursive: true });

    // Override HOME to isolate tests
    process.env.HOME = path.join(testDir, 'config');
  });

  afterAll(async () => {
    // Clean up daemon if running
    if (daemon?.isRunning()) {
      await daemon.stop();
    }
    daemon = null;

    // Restore HOME
    process.env.HOME = originalHome;

    // Clean up temp directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  });

  describe('Acceptance Criteria: CLI start/stop/status all work', () => {
    it('should start daemon with correct output', async () => {
      daemon = new Daemon({ vaultPath, port: 0 });
      const info = await daemon.start();

      port = info.port;

      expect(info.pid).toBe(process.pid);
      expect(info.port).toBeGreaterThan(0);
      expect(info.vaultPath).toBe(vaultPath);
      expect(daemon.isRunning()).toBe(true);
    });

    it('should show daemon status correctly', async () => {
      const result = await discoverDaemon();

      expect(result.found).toBe(true);
      expect(result.info?.pid).toBe(process.pid);
      expect(result.info?.port).toBe(port);
      expect(result.info?.vaultPath).toBe(vaultPath);
      expect(result.health?.status).toBe('ok');
    });
  });

  describe('Acceptance Criteria: tRPC endpoints return correct data', () => {
    let createdNoteId: string;

    it('notes.list should return empty initially', async () => {
      const notes = await trpcQuery<unknown[]>(port, 'notes.list');
      expect(Array.isArray(notes)).toBe(true);
      expect(notes.length).toBe(0);
    });

    it('notes.create should create a new note', async () => {
      interface Note {
        id: string;
        title: string;
        type: string;
      }
      const note = await trpcMutation<Note>(port, 'notes.create', {
        title: 'Phase 4 E2E Test Note',
        type: 'note',
      });

      expect(note.id).toBeTruthy();
      expect(note.title).toBe('Phase 4 E2E Test Note');
      expect(note.type).toBe('note');
      createdNoteId = note.id;
    });

    it('notes.get should retrieve the created note', async () => {
      interface Note {
        id: string;
        title: string;
        content: unknown;
      }
      const note = await trpcQuery<Note>(port, 'notes.get', createdNoteId);

      expect(note.id).toBe(createdNoteId);
      expect(note.title).toBe('Phase 4 E2E Test Note');
      expect(note.content).toBeDefined();
    });

    it('search.query should find the created note', async () => {
      interface SearchResult {
        note: { id: string; title: string };
        snippet: string;
        score: number;
        matchedIn: string[];
      }
      const results = await trpcQuery<SearchResult[]>(port, 'search.query', { text: 'Phase 4' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.note.id === createdNoteId)).toBe(true);
    });

    it('graph.tags should return tags list', async () => {
      interface Tag {
        name: string;
        count: number;
      }
      const tags = await trpcQuery<Tag[]>(port, 'graph.tags');

      expect(Array.isArray(tags)).toBe(true);
    });

    it('notes.count should return correct count', async () => {
      const count = await trpcQuery<number>(port, 'notes.count');
      expect(count).toBe(1);
    });
  });

  describe('Acceptance Criteria: WebSocket connects and syncs', () => {
    it('should connect to WebSocket and join document', async () => {
      const wsUrl = `ws://127.0.0.1:${port}/ws`;

      // Get a note ID to join
      interface Note {
        id: string;
      }
      const notes = await trpcQuery<Note[]>(port, 'notes.list');
      const noteId = notes[0].id;

      const ws = new WebSocket(wsUrl);
      const messages: { type: string }[] = [];

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Timeout waiting for WebSocket messages'));
        }, 5000);

        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'join', noteId }));
        });

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          messages.push(msg);

          // Wait for both joined and sync-state
          if (
            messages.some((m) => m.type === 'joined') &&
            messages.some((m) => m.type === 'sync-state')
          ) {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        });

        ws.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Verify we received the expected messages
      expect(messages.some((m) => m.type === 'joined')).toBe(true);
      expect(messages.some((m) => m.type === 'sync-state')).toBe(true);
    });
  });

  describe('Acceptance Criteria: Health endpoint responds', () => {
    it('should return correct health response', async () => {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      expect(response.ok).toBe(true);

      const health = (await response.json()) as { status: string; version: string; uptime: number };
      expect(health.status).toBe('ok');
      expect(typeof health.uptime).toBe('number');
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.version).toBeTruthy();
    });
  });

  describe('Acceptance Criteria: Files created in correct locations', () => {
    it('should write note files to vault directory', async () => {
      const notesDir = path.join(vaultPath, 'notes');
      const files = await fs.readdir(notesDir);

      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.endsWith('.json'))).toBe(true);
    });

    it('should write daemon.json to ~/.scribe/', async () => {
      const daemonInfoPath = getDaemonInfoPath();
      const exists = await fs
        .access(daemonInfoPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);

      const content = await fs.readFile(daemonInfoPath, 'utf-8');
      const info = JSON.parse(content) as DaemonInfo;

      expect(info.pid).toBe(process.pid);
      expect(info.port).toBe(port);
      expect(info.vaultPath).toBe(vaultPath);
    });
  });

  describe('Acceptance Criteria: Concurrent requests work', () => {
    it('should handle multiple simultaneous requests', async () => {
      interface Note {
        id: string;
      }
      interface Tag {
        name: string;
      }
      const [notesList, notesCount, tags, searchResults] = await Promise.all([
        trpcQuery<Note[]>(port, 'notes.list'),
        trpcQuery<number>(port, 'notes.count'),
        trpcQuery<Tag[]>(port, 'graph.tags'),
        trpcQuery(port, 'search.query', { text: 'test' }),
      ]);

      expect(notesList).toBeDefined();
      expect(notesCount).toBeDefined();
      expect(tags).toBeDefined();
      expect(searchResults).toBeDefined();
    });
  });

  describe('Acceptance Criteria: Graceful shutdown works', () => {
    it('should stop cleanly and clean up daemon.json', async () => {
      expect(daemon?.isRunning()).toBe(true);

      await daemon?.stop();

      expect(daemon?.isRunning()).toBe(false);

      // Daemon.json should be removed
      const daemonInfoPath = getDaemonInfoPath();
      await expect(fs.access(daemonInfoPath)).rejects.toThrow();
    });

    it('should no longer respond after shutdown', async () => {
      await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
    });
  });
});

describe.sequential('Phase 4 Verification: End-to-End Flow', () => {
  let testDir: string;
  let vaultPath: string;
  let daemon: Daemon | null = null;
  let originalHome: string | undefined;

  beforeEach(async () => {
    originalHome = process.env.HOME;

    testDir = path.join(
      tmpdir(),
      `scribe-e2e-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
    process.env.HOME = originalHome;

    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  });

  it('should complete full end-to-end workflow', async () => {
    // 1. Start daemon
    daemon = new Daemon({ vaultPath, port: 0 });
    const info = await daemon.start();
    expect(daemon.isRunning()).toBe(true);

    // 2. Wait for daemon (should return immediately since it's running)
    const discovery = await waitForDaemon({ maxAttempts: 5, intervalMs: 100 });
    expect(discovery.found).toBe(true);

    // 3. Create note via tRPC
    interface Note {
      id: string;
      title: string;
    }
    const note = await trpcMutation<Note>(info.port, 'notes.create', {
      title: 'E2E Flow Test',
      type: 'note',
    });
    expect(note.id).toBeTruthy();
    expect(note.title).toBe('E2E Flow Test');

    // 4. Connect WebSocket and join document
    const ws = new WebSocket(`ws://127.0.0.1:${info.port}/ws`);
    const wsMessages: { type: string; noteId?: string; stateVector?: unknown; state?: unknown }[] =
      [];

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket timeout'));
      }, 5000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'join', noteId: note.id }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        wsMessages.push(msg);

        if (msg.type === 'sync-state') {
          clearTimeout(timeout);
          resolve();
        }
      });

      ws.on('error', reject);
    });

    // 5. Verify received initial state
    expect(wsMessages.some((m) => m.type === 'joined')).toBe(true);
    expect(wsMessages.some((m) => m.type === 'sync-state')).toBe(true);

    // 6. Search finds note
    interface SearchResult {
      note: { id: string };
    }
    const results = await trpcQuery<SearchResult[]>(info.port, 'search.query', {
      text: 'E2E Flow',
    });
    expect(results.some((r) => r.note.id === note.id)).toBe(true);

    // 7. Clean up WebSocket
    ws.close();

    // 8. Stop daemon gracefully
    await daemon.stop();
    expect(daemon.isRunning()).toBe(false);

    // 9. Verify cleanup
    await expect(fs.access(getDaemonInfoPath())).rejects.toThrow();
  });
});
