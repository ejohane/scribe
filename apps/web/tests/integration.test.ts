/**
 * Integration tests for the full data flow from web client through daemon to file system.
 *
 * These tests verify:
 * - Note CRUD operations work end-to-end
 * - File system changes are reflected correctly
 * - Search functionality works
 * - Collaboration layer connects properly
 * - Graph queries return valid data
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Daemon } from '@scribe/scribed';
import { ScribeClient } from '@scribe/client-sdk';

const TEST_VAULT = '/tmp/scribe-integration-test-vault';
let daemon: Daemon;
let client: ScribeClient;
let daemonPort: number;

/**
 * Helper to wait for a condition with timeout.
 * Exported for potential use in extended test scenarios.
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error('Timeout waiting for condition');
}

beforeAll(async () => {
  // Clean vault from any previous run
  await fs.rm(TEST_VAULT, { recursive: true, force: true });
  await fs.mkdir(TEST_VAULT, { recursive: true });

  // Create .scribe directory for database
  await fs.mkdir(path.join(TEST_VAULT, '.scribe'), { recursive: true });

  // Start daemon
  daemon = new Daemon({
    vaultPath: TEST_VAULT,
    port: 0, // Auto-assign port
  });

  const info = await daemon.start();
  daemonPort = info.port;

  // Wait a moment for server to be fully ready
  await new Promise((r) => setTimeout(r, 500));

  // Connect client
  client = new ScribeClient({
    autoDiscover: false,
    port: daemonPort,
    autoConnect: false,
  });

  await client.connect();
}, 30000);

afterAll(async () => {
  // Disconnect client
  if (client) {
    client.disconnect();
  }

  // Stop daemon
  if (daemon && daemon.isRunning()) {
    await daemon.stop();
  }

  // Clean up vault
  await fs.rm(TEST_VAULT, { recursive: true, force: true }).catch(() => {});
}, 15000);

describe('Full Data Flow', () => {
  let createdNoteId: string;

  describe('Create Note', () => {
    it('creates note via API and persists to file system', async () => {
      const note = await client.api.notes.create.mutate({
        title: 'Integration Test Note',
        type: 'note',
      });

      expect(note.id).toBeDefined();
      expect(note.title).toBe('Integration Test Note');
      expect(note.type).toBe('note');

      createdNoteId = note.id;

      // Verify file exists
      const filePath = path.join(TEST_VAULT, 'notes', `${note.id}.json`);
      const exists = await fs
        .stat(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Verify file content
      const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      expect(content.title).toBe('Integration Test Note');
      expect(content.id).toBe(note.id);
    });
  });

  describe('Read Note', () => {
    it('reads note via API with correct content', async () => {
      const note = await client.api.notes.get.query(createdNoteId);

      expect(note).not.toBeNull();
      expect(note!.id).toBe(createdNoteId);
      expect(note!.title).toBe('Integration Test Note');
    });

    it('returns null for non-existent note', async () => {
      const note = await client.api.notes.get.query('nonexistent-id-12345');
      expect(note).toBeNull();
    });
  });

  describe('Update Note', () => {
    it('updates note via API and persists to file system', async () => {
      const updated = await client.api.notes.update.mutate({
        id: createdNoteId,
        title: 'Updated Integration Test Note',
      });

      expect(updated.title).toBe('Updated Integration Test Note');

      // Verify file was updated
      const filePath = path.join(TEST_VAULT, 'notes', `${createdNoteId}.json`);
      const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      expect(content.title).toBe('Updated Integration Test Note');
    });

    it('updates note content', async () => {
      const lexicalContent = {
        root: {
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Test content for integration testing',
                },
              ],
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      };

      const updated = await client.api.notes.update.mutate({
        id: createdNoteId,
        content: lexicalContent,
      });

      expect(updated.content).toBeDefined();

      // Verify file was updated
      const filePath = path.join(TEST_VAULT, 'notes', `${createdNoteId}.json`);
      const fileContent = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      expect(fileContent.content.root.children[0].children[0].text).toBe(
        'Test content for integration testing'
      );
    });
  });

  describe('List Notes', () => {
    it('lists all created notes', async () => {
      const notes = await client.api.notes.list.query();

      expect(notes.length).toBeGreaterThanOrEqual(1);
      expect(notes.some((n) => n.id === createdNoteId)).toBe(true);
    });

    it('supports limit parameter', async () => {
      const notes = await client.api.notes.list.query({ limit: 1 });
      expect(notes.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Delete Note', () => {
    let deleteTestNoteId: string;

    beforeEach(async () => {
      // Create a note specifically for delete test
      const note = await client.api.notes.create.mutate({
        title: 'Delete Me',
        type: 'note',
      });
      deleteTestNoteId = note.id;
    });

    it('deletes note via API and removes from file system', async () => {
      const filePath = path.join(TEST_VAULT, 'notes', `${deleteTestNoteId}.json`);

      // File exists before delete
      const existsBefore = await fs
        .stat(filePath)
        .then(() => true)
        .catch(() => false);
      expect(existsBefore).toBe(true);

      // Delete
      const result = await client.api.notes.delete.mutate(deleteTestNoteId);
      expect(result.success).toBe(true);

      // File removed after delete
      const existsAfter = await fs
        .stat(filePath)
        .then(() => true)
        .catch(() => false);
      expect(existsAfter).toBe(false);
    });
  });
});

describe('Search', () => {
  beforeAll(async () => {
    // Create some notes with searchable content
    await client.api.notes.create.mutate({
      title: 'Searchable Note Alpha',
      type: 'note',
      content: {
        root: {
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'This is unique content alpha beta gamma' }],
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      },
    });

    await client.api.notes.create.mutate({
      title: 'Searchable Note Beta',
      type: 'note',
      content: {
        root: {
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'This is different content delta epsilon' }],
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      },
    });

    // Wait a moment for indexing
    await new Promise((r) => setTimeout(r, 100));
  });

  it('finds notes by title', async () => {
    const results = await client.api.search.query.query({
      text: 'Searchable',
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.note.title.includes('Searchable'))).toBe(true);
  });

  it('finds notes by content', async () => {
    const results = await client.api.search.query.query({
      text: 'alpha',
    });

    expect(results.length).toBeGreaterThan(0);
  });

  it('returns empty array for non-matching query', async () => {
    const results = await client.api.search.query.query({
      text: 'xyznonexistentquery12345',
    });

    expect(results).toEqual([]);
  });
});

describe('Collaboration', () => {
  let collabNoteId: string;

  beforeAll(async () => {
    const note = await client.api.notes.create.mutate({
      title: 'Collab Test Note',
      type: 'note',
    });
    collabNoteId = note.id;
  });

  it('joins document and receives sync state', async () => {
    const session = await client.collab.joinDocument(collabNoteId);

    expect(session.doc).toBeDefined();
    expect(session.noteId).toBe(collabNoteId);

    session.destroy();
  });

  it('can leave and rejoin document', async () => {
    const session1 = await client.collab.joinDocument(collabNoteId);
    session1.destroy();

    // Should be able to rejoin
    const session2 = await client.collab.joinDocument(collabNoteId);
    expect(session2.doc).toBeDefined();
    session2.destroy();
  });
});

describe('Graph Queries', () => {
  it('backlinks endpoint returns array', async () => {
    const backlinks = await client.api.graph.backlinks.query('nonexistent');
    expect(Array.isArray(backlinks)).toBe(true);
  });

  it('forwardLinks endpoint returns array', async () => {
    const forwardLinks = await client.api.graph.forwardLinks.query('nonexistent');
    expect(Array.isArray(forwardLinks)).toBe(true);
  });

  it('tags endpoint returns array', async () => {
    const tags = await client.api.graph.tags.query();
    expect(Array.isArray(tags)).toBe(true);
  });

  it('stats endpoint returns valid structure', async () => {
    const stats = await client.api.graph.stats.query();

    expect(stats).toHaveProperty('totalNotes');
    expect(stats).toHaveProperty('totalLinks');
    expect(stats).toHaveProperty('totalTags');
    expect(typeof stats.totalNotes).toBe('number');
    expect(stats.totalNotes).toBeGreaterThanOrEqual(0);
  });
});

describe('Note Count', () => {
  it('returns total note count', async () => {
    const count = await client.api.notes.count.query();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('returns count filtered by type', async () => {
    const noteCount = await client.api.notes.count.query('note');
    expect(typeof noteCount).toBe('number');
    expect(noteCount).toBeGreaterThanOrEqual(0);
  });
});

describe('Note Existence Check', () => {
  let existingNoteId: string;

  beforeAll(async () => {
    const note = await client.api.notes.create.mutate({
      title: 'Existence Check Note',
      type: 'note',
    });
    existingNoteId = note.id;
  });

  it('returns true for existing note', async () => {
    const exists = await client.api.notes.exists.query(existingNoteId);
    expect(exists).toBe(true);
  });

  it('returns false for non-existing note', async () => {
    const exists = await client.api.notes.exists.query('nonexistent-note-id');
    expect(exists).toBe(false);
  });
});

describe('Multiple Notes', () => {
  it('creates multiple notes and lists them', async () => {
    const titles = ['Multi Note 1', 'Multi Note 2', 'Multi Note 3'];

    const createdIds: string[] = [];
    for (const title of titles) {
      const note = await client.api.notes.create.mutate({
        title,
        type: 'note',
      });
      createdIds.push(note.id);
    }

    const notes = await client.api.notes.list.query();

    for (const id of createdIds) {
      expect(notes.some((n) => n.id === id)).toBe(true);
    }
  });
});

describe('Daily Note Type', () => {
  it('creates daily note with date', async () => {
    const today = new Date().toISOString().split('T')[0];
    const note = await client.api.notes.create.mutate({
      title: `Daily Note ${today}`,
      type: 'daily',
      date: today,
    });

    expect(note.type).toBe('daily');
    expect(note.date).toBe(today);

    // Verify in file
    const filePath = path.join(TEST_VAULT, 'notes', `${note.id}.json`);
    const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    expect(content.type).toBe('daily');
    expect(content.date).toBe(today);
  });
});

describe('Meeting Note Type', () => {
  it('creates meeting note with date', async () => {
    const today = new Date().toISOString().split('T')[0];
    const note = await client.api.notes.create.mutate({
      title: 'Team Standup',
      type: 'meeting',
      date: today,
    });

    expect(note.type).toBe('meeting');
    expect(note.date).toBe(today);
  });
});

describe('Cleanup and Resource Management', () => {
  it('daemon properly tracks running state', async () => {
    expect(daemon.isRunning()).toBe(true);
  });

  it('client maintains connected status', async () => {
    expect(client.isConnected).toBe(true);
    expect(client.status).toBe('connected');
  });

  it('daemon info is available', async () => {
    const info = client.getDaemonInfo();
    expect(info).not.toBeNull();
    expect(info!.port).toBe(daemonPort);
  });
});
