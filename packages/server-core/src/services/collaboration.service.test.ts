/**
 * Tests for CollaborationService.
 *
 * These tests verify:
 * 1. Get/create Y.Doc for note
 * 2. Load persisted state on doc creation
 * 3. Persist state on changes
 * 4. Apply client updates
 * 5. Track active sessions
 * 6. Unload docs when all sessions end
 * 7. Sync Yjs state to JSON file
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import * as Y from 'yjs';
import {
  ScribeDatabase,
  NotesRepository,
  LinksRepository,
  TagsRepository,
  SearchRepository,
  YjsStateRepository,
} from '@scribe/server-db';
import { DocumentService } from './document.service.js';
import { CollaborationService } from './collaboration.service.js';
import type { CollabUpdate } from './collaboration.service.js';
import type { EditorContent } from '../types/index.js';

describe('CollaborationService', () => {
  let scribeDb: ScribeDatabase;
  let vaultPath: string;
  let documentService: DocumentService;
  let yjsRepo: YjsStateRepository;
  let service: CollaborationService;

  // Helper to create test editor content
  const createTestContent = (text: string): EditorContent => ({
    root: {
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text }],
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  });

  beforeEach(async () => {
    // Create temporary vault directory
    vaultPath = path.join(
      tmpdir(),
      `scribe-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(vaultPath, { recursive: true });

    // Initialize in-memory database
    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();

    const db = scribeDb.getDb();

    documentService = new DocumentService({
      vaultPath,
      notesRepo: new NotesRepository(db),
      linksRepo: new LinksRepository(db),
      tagsRepo: new TagsRepository(db),
      searchRepo: new SearchRepository(db),
    });

    yjsRepo = new YjsStateRepository(db);

    service = new CollaborationService({
      yjsRepo,
      documentService,
    });
  });

  afterEach(async () => {
    // Clean up all loaded docs
    service.unloadAll();

    if (scribeDb.isOpen()) {
      scribeDb.close();
    }
    // Clean up temp directory
    await fs.rm(vaultPath, { recursive: true, force: true }).catch(() => {});
  });

  describe('getDoc', () => {
    it('should create a new Y.Doc for a note', async () => {
      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
        content: createTestContent('Hello world'),
      });

      const doc = await service.getDoc(note.id);

      expect(doc).toBeInstanceOf(Y.Doc);
    });

    it('should return the same doc instance on subsequent calls', async () => {
      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const doc1 = await service.getDoc(note.id);
      const doc2 = await service.getDoc(note.id);

      expect(doc1).toBe(doc2);
    });

    it('should load persisted state into new doc', async () => {
      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      // Create a Y.Doc with some content and save its state
      const originalDoc = new Y.Doc();
      const yText = originalDoc.getText('test');
      yText.insert(0, 'persisted content');
      const state = Y.encodeStateAsUpdate(originalDoc);

      yjsRepo.save({
        noteId: note.id,
        state: Buffer.from(state),
        updatedAt: new Date().toISOString(),
      });
      originalDoc.destroy();

      // Now get the doc through the service
      const loadedDoc = await service.getDoc(note.id);
      const loadedText = loadedDoc.getText('test').toString();

      expect(loadedText).toBe('persisted content');
    });

    it('should initialize doc from note content when no state exists', async () => {
      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
        content: createTestContent('Initial content'),
      });

      const doc = await service.getDoc(note.id);
      const yContent = doc.getMap('content');

      expect(yContent.get('lexical')).toBeDefined();
      const lexicalContent = JSON.parse(yContent.get('lexical') as string);
      expect(lexicalContent.root.children[0].children[0].text).toBe('Initial content');
    });
  });

  describe('hasDoc', () => {
    it('should return false for unloaded doc', async () => {
      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      expect(service.hasDoc(note.id)).toBe(false);
    });

    it('should return true for loaded doc', async () => {
      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      await service.getDoc(note.id);

      expect(service.hasDoc(note.id)).toBe(true);
    });
  });

  describe('applyUpdate', () => {
    it('should apply update to loaded doc', async () => {
      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const doc = await service.getDoc(note.id);
      // Use a different name than 'content' since service uses getMap('content')
      const yText = doc.getText('editor');

      // Create an update from another Y.Doc
      const clientDoc = new Y.Doc();
      const clientText = clientDoc.getText('editor');
      clientText.insert(0, 'from client');
      const update = Y.encodeStateAsUpdate(clientDoc);
      clientDoc.destroy();

      const result = service.applyUpdate(note.id, update, 'client-1');

      expect(result).toBe(true);
      expect(yText.toString()).toBe('from client');
    });

    it('should return false when doc not loaded', async () => {
      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const clientDoc = new Y.Doc();
      const update = Y.encodeStateAsUpdate(clientDoc);
      clientDoc.destroy();

      const result = service.applyUpdate(note.id, update, 'client-1');

      expect(result).toBe(false);
    });

    it('should persist state after applying update', async () => {
      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      await service.getDoc(note.id);

      // Create and apply an update
      const clientDoc = new Y.Doc();
      const clientText = clientDoc.getText('content');
      clientText.insert(0, 'saved content');
      const update = Y.encodeStateAsUpdate(clientDoc);
      clientDoc.destroy();

      service.applyUpdate(note.id, update, 'client-1');

      // Check state was persisted
      const savedState = yjsRepo.loadAsUint8Array(note.id);
      expect(savedState).not.toBeNull();

      // Verify content is in persisted state
      const verifyDoc = new Y.Doc();
      Y.applyUpdate(verifyDoc, savedState!);
      expect(verifyDoc.getText('content').toString()).toBe('saved content');
      verifyDoc.destroy();
    });
  });

  describe('getState', () => {
    it('should return encoded state of loaded doc', async () => {
      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const doc = await service.getDoc(note.id);
      doc.getText('test').insert(0, 'test content');

      const state = service.getState(note.id);

      expect(state).toBeInstanceOf(Uint8Array);

      // Verify state contains the content
      const verifyDoc = new Y.Doc();
      Y.applyUpdate(verifyDoc, state!);
      expect(verifyDoc.getText('test').toString()).toBe('test content');
      verifyDoc.destroy();
    });

    it('should return null for unloaded doc', async () => {
      const state = service.getState('non-existent');
      expect(state).toBeNull();
    });
  });

  describe('sessions', () => {
    describe('joinSession', () => {
      it('should create a session for a client', async () => {
        const note = await documentService.create({
          title: 'Test Note',
          type: 'note',
        });

        const session = await service.joinSession(note.id, 'client-1');

        expect(session.id).toHaveLength(8);
        expect(session.noteId).toBe(note.id);
        expect(session.clientId).toBe('client-1');
        expect(session.connectedAt).toBeDefined();
      });

      it('should load doc when session is joined', async () => {
        const note = await documentService.create({
          title: 'Test Note',
          type: 'note',
        });

        expect(service.hasDoc(note.id)).toBe(false);

        await service.joinSession(note.id, 'client-1');

        expect(service.hasDoc(note.id)).toBe(true);
      });

      it('should allow multiple sessions for same note', async () => {
        const note = await documentService.create({
          title: 'Test Note',
          type: 'note',
        });

        const session1 = await service.joinSession(note.id, 'client-1');
        const session2 = await service.joinSession(note.id, 'client-2');

        expect(session1.id).not.toBe(session2.id);
        expect(service.getSessionCount(note.id)).toBe(2);
      });
    });

    describe('leaveSession', () => {
      it('should remove the session', async () => {
        const note = await documentService.create({
          title: 'Test Note',
          type: 'note',
        });

        const session = await service.joinSession(note.id, 'client-1');
        const result = service.leaveSession(session.id);

        expect(result).toBe(true);
        expect(service.getSessionCount(note.id)).toBe(0);
      });

      it('should unload doc when last session leaves', async () => {
        const note = await documentService.create({
          title: 'Test Note',
          type: 'note',
        });

        const session = await service.joinSession(note.id, 'client-1');
        expect(service.hasDoc(note.id)).toBe(true);

        service.leaveSession(session.id);

        expect(service.hasDoc(note.id)).toBe(false);
      });

      it('should not unload doc when other sessions remain', async () => {
        const note = await documentService.create({
          title: 'Test Note',
          type: 'note',
        });

        const session1 = await service.joinSession(note.id, 'client-1');
        await service.joinSession(note.id, 'client-2');

        service.leaveSession(session1.id);

        expect(service.hasDoc(note.id)).toBe(true);
        expect(service.getSessionCount(note.id)).toBe(1);
      });

      it('should return false for non-existent session', () => {
        const result = service.leaveSession('non-existent');
        expect(result).toBe(false);
      });
    });

    describe('getSessions', () => {
      it('should return all sessions for a note', async () => {
        const note = await documentService.create({
          title: 'Test Note',
          type: 'note',
        });

        await service.joinSession(note.id, 'client-1');
        await service.joinSession(note.id, 'client-2');

        const sessions = service.getSessions(note.id);

        expect(sessions).toHaveLength(2);
        expect(sessions.map((s) => s.clientId)).toContain('client-1');
        expect(sessions.map((s) => s.clientId)).toContain('client-2');
      });

      it('should return empty array for note without sessions', async () => {
        const sessions = service.getSessions('non-existent');
        expect(sessions).toEqual([]);
      });
    });

    describe('getAllSessions', () => {
      it('should return sessions for all notes', async () => {
        const note1 = await documentService.create({
          title: 'Note 1',
          type: 'note',
        });
        const note2 = await documentService.create({
          title: 'Note 2',
          type: 'note',
        });

        await service.joinSession(note1.id, 'client-1');
        await service.joinSession(note2.id, 'client-2');

        const allSessions = service.getAllSessions();

        expect(allSessions.size).toBe(2);
        expect(allSessions.get(note1.id)).toHaveLength(1);
        expect(allSessions.get(note2.id)).toHaveLength(1);
      });
    });

    describe('getSessionCount', () => {
      it('should return 0 for note without sessions', () => {
        expect(service.getSessionCount('non-existent')).toBe(0);
      });

      it('should return correct count', async () => {
        const note = await documentService.create({
          title: 'Test Note',
          type: 'note',
        });

        await service.joinSession(note.id, 'client-1');
        await service.joinSession(note.id, 'client-2');
        await service.joinSession(note.id, 'client-3');

        expect(service.getSessionCount(note.id)).toBe(3);
      });
    });
  });

  describe('syncToFile', () => {
    it('should sync Yjs content to note file', async () => {
      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
        content: createTestContent('Initial'),
      });

      const doc = await service.getDoc(note.id);

      // Modify the Yjs content
      const yContent = doc.getMap('content');
      const newContent = createTestContent('Updated via Yjs');
      yContent.set('lexical', JSON.stringify(newContent));

      const result = await service.syncToFile(note.id);

      expect(result).toBe(true);

      // Verify the file was updated
      const updatedNote = await documentService.read(note.id);
      expect(updatedNote).not.toBeNull();
      const firstChild = updatedNote!.content.root.children[0];
      expect(firstChild.children?.[0]?.text).toBe('Updated via Yjs');
    });

    it('should return false for unloaded doc', async () => {
      const result = await service.syncToFile('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('update handler', () => {
    it('should call handler when local changes are made', async () => {
      const updates: CollabUpdate[] = [];
      service.setUpdateHandler((update) => {
        updates.push(update);
      });

      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const doc = await service.getDoc(note.id);

      // Make a local change - use 'editor' since 'content' is a Map
      const yText = doc.getText('editor');
      yText.insert(0, 'local change');

      // Wait a tick for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(updates.length).toBeGreaterThan(0);
      expect(updates[0].noteId).toBe(note.id);
      expect(updates[0].update).toBeInstanceOf(Uint8Array);
    });

    it('should not call handler for remote updates', async () => {
      const updates: CollabUpdate[] = [];
      service.setUpdateHandler((update) => {
        updates.push(update);
      });

      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      await service.getDoc(note.id);

      // Apply a remote update
      const clientDoc = new Y.Doc();
      clientDoc.getText('content').insert(0, 'remote change');
      const update = Y.encodeStateAsUpdate(clientDoc);
      clientDoc.destroy();

      // Clear any updates from getDoc initialization
      updates.length = 0;

      service.applyUpdate(note.id, update, 'remote-client');

      // Remote updates should not trigger the handler
      expect(updates).toHaveLength(0);
    });
  });

  describe('persistence', () => {
    describe('persistDoc', () => {
      it('should persist doc state to database', async () => {
        const note = await documentService.create({
          title: 'Test Note',
          type: 'note',
        });

        const doc = await service.getDoc(note.id);
        doc.getText('test').insert(0, 'persisted');

        const result = service.persistDoc(note.id);

        expect(result).toBe(true);

        const savedState = yjsRepo.loadAsUint8Array(note.id);
        expect(savedState).not.toBeNull();
      });

      it('should return false for unloaded doc', () => {
        const result = service.persistDoc('non-existent');
        expect(result).toBe(false);
      });
    });

    describe('persistAll', () => {
      it('should persist all loaded docs', async () => {
        const note1 = await documentService.create({
          title: 'Note 1',
          type: 'note',
        });
        const note2 = await documentService.create({
          title: 'Note 2',
          type: 'note',
        });

        const doc1 = await service.getDoc(note1.id);
        const doc2 = await service.getDoc(note2.id);

        doc1.getText('test').insert(0, 'content1');
        doc2.getText('test').insert(0, 'content2');

        service.persistAll();

        expect(yjsRepo.loadAsUint8Array(note1.id)).not.toBeNull();
        expect(yjsRepo.loadAsUint8Array(note2.id)).not.toBeNull();
      });
    });
  });

  describe('unloadDoc', () => {
    it('should unload doc and clean up', async () => {
      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      await service.getDoc(note.id);
      await service.joinSession(note.id, 'client-1');

      expect(service.hasDoc(note.id)).toBe(true);
      expect(service.getSessionCount(note.id)).toBe(1);

      const result = service.unloadDoc(note.id);

      expect(result).toBe(true);
      expect(service.hasDoc(note.id)).toBe(false);
      expect(service.getSessionCount(note.id)).toBe(0);
    });

    it('should persist state before unloading', async () => {
      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const doc = await service.getDoc(note.id);
      doc.getText('test').insert(0, 'persist before unload');

      service.unloadDoc(note.id);

      const savedState = yjsRepo.loadAsUint8Array(note.id);
      expect(savedState).not.toBeNull();

      const verifyDoc = new Y.Doc();
      Y.applyUpdate(verifyDoc, savedState!);
      expect(verifyDoc.getText('test').toString()).toBe('persist before unload');
      verifyDoc.destroy();
    });

    it('should return false for unloaded doc', () => {
      const result = service.unloadDoc('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('unloadAll', () => {
    it('should unload all docs', async () => {
      const note1 = await documentService.create({
        title: 'Note 1',
        type: 'note',
      });
      const note2 = await documentService.create({
        title: 'Note 2',
        type: 'note',
      });

      await service.getDoc(note1.id);
      await service.getDoc(note2.id);

      expect(service.getLoadedDocCount()).toBe(2);

      service.unloadAll();

      expect(service.getLoadedDocCount()).toBe(0);
    });
  });

  describe('getLoadedDocCount', () => {
    it('should return count of loaded docs', async () => {
      expect(service.getLoadedDocCount()).toBe(0);

      const note1 = await documentService.create({
        title: 'Note 1',
        type: 'note',
      });
      await service.getDoc(note1.id);

      expect(service.getLoadedDocCount()).toBe(1);

      const note2 = await documentService.create({
        title: 'Note 2',
        type: 'note',
      });
      await service.getDoc(note2.id);

      expect(service.getLoadedDocCount()).toBe(2);
    });
  });

  describe('getLoadedDocIds', () => {
    it('should return IDs of all loaded docs', async () => {
      const note1 = await documentService.create({
        title: 'Note 1',
        type: 'note',
      });
      const note2 = await documentService.create({
        title: 'Note 2',
        type: 'note',
      });

      await service.getDoc(note1.id);
      await service.getDoc(note2.id);

      const ids = service.getLoadedDocIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain(note1.id);
      expect(ids).toContain(note2.id);
    });
  });

  describe('state persists on changes', () => {
    it('should automatically persist when doc is modified', async () => {
      const note = await documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const doc = await service.getDoc(note.id);

      // Modify the doc
      const yText = doc.getText('auto-persist-test');
      yText.insert(0, 'auto persisted');

      // Wait a tick for the update handler to run
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check state was auto-persisted
      const savedState = yjsRepo.loadAsUint8Array(note.id);
      expect(savedState).not.toBeNull();

      const verifyDoc = new Y.Doc();
      Y.applyUpdate(verifyDoc, savedState!);
      expect(verifyDoc.getText('auto-persist-test').toString()).toBe('auto persisted');
      verifyDoc.destroy();
    });
  });
});
