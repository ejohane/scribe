/**
 * Tests for Service Container.
 *
 * These tests verify:
 * 1. createServices creates all services with dependencies
 * 2. destroyServices cleans up resources
 * 3. Database initialized before services
 * 4. No circular dependency issues
 * 5. TypeScript compiles without errors (implicit)
 * 6. createTestServices works for unit tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { createServices, destroyServices, createTestServices, type Services } from './container.js';
import { DocumentService } from './services/document.service.js';
import { GraphService } from './services/graph.service.js';
import { SearchService } from './services/search.service.js';
import { CollaborationService } from './services/collaboration.service.js';
import {
  ScribeDatabase,
  NotesRepository,
  LinksRepository,
  TagsRepository,
  SearchRepository,
  YjsStateRepository,
  SnapshotsRepository,
} from '@scribe/server-db';

describe('createServices', () => {
  let vaultPath: string;
  let services: Services;

  beforeEach(async () => {
    // Create temporary vault directory
    vaultPath = path.join(
      tmpdir(),
      `scribe-container-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(vaultPath, { recursive: true });
  });

  afterEach(async () => {
    if (services) {
      destroyServices(services);
    }
    // Clean up temporary vault
    await fs.rm(vaultPath, { recursive: true, force: true });
  });

  it('should create all repositories', () => {
    services = createServices({
      vaultPath,
      dbPath: ':memory:',
    });

    expect(services.notesRepo).toBeInstanceOf(NotesRepository);
    expect(services.linksRepo).toBeInstanceOf(LinksRepository);
    expect(services.tagsRepo).toBeInstanceOf(TagsRepository);
    expect(services.searchRepo).toBeInstanceOf(SearchRepository);
    expect(services.yjsRepo).toBeInstanceOf(YjsStateRepository);
    expect(services.snapshotsRepo).toBeInstanceOf(SnapshotsRepository);
  });

  it('should create all services', () => {
    services = createServices({
      vaultPath,
      dbPath: ':memory:',
    });

    expect(services.documentService).toBeInstanceOf(DocumentService);
    expect(services.graphService).toBeInstanceOf(GraphService);
    expect(services.searchService).toBeInstanceOf(SearchService);
    expect(services.collaborationService).toBeInstanceOf(CollaborationService);
  });

  it('should create database and initialize it', () => {
    services = createServices({
      vaultPath,
      dbPath: ':memory:',
    });

    expect(services.db).toBeInstanceOf(ScribeDatabase);
    expect(services.db.isInitialized()).toBe(true);
    expect(services.db.isOpen()).toBe(true);
  });

  it('should support verbose mode', () => {
    services = createServices({
      vaultPath,
      dbPath: ':memory:',
      verbose: true,
    });

    expect(services.db).toBeDefined();
    expect(services.documentService).toBeDefined();
  });

  it('should wire services with correct dependencies', async () => {
    services = createServices({
      vaultPath,
      dbPath: ':memory:',
    });

    // Create a note to verify services are wired correctly
    const note = await services.documentService.create({
      title: 'Test Note',
      type: 'note',
    });

    expect(note.id).toBeDefined();
    expect(note.title).toBe('Test Note');

    // Verify the note is indexed (SearchService uses same repos)
    const list = services.documentService.list();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(note.id);

    // Verify GraphService can query (uses same repos)
    const stats = services.graphService.getStats();
    expect(stats.totalNotes).toBe(1);
  });

  it('should allow services to work together', async () => {
    services = createServices({
      vaultPath,
      dbPath: ':memory:',
    });

    // Create note via DocumentService
    const note = await services.documentService.create({
      title: 'Searchable Note',
      type: 'note',
      content: {
        root: {
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Some unique search terms' }],
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

    // Search via SearchService
    const results = await services.searchService.search({ text: 'unique' });
    expect(results.length).toBe(1);
    expect(results[0].note.id).toBe(note.id);

    // Query via GraphService
    const stats = services.graphService.getStats();
    expect(stats.totalNotes).toBe(1);

    // Collaborate via CollaborationService
    const doc = await services.collaborationService.getDoc(note.id);
    expect(doc).toBeDefined();
  });
});

describe('destroyServices', () => {
  let vaultPath: string;

  beforeEach(async () => {
    vaultPath = path.join(
      tmpdir(),
      `scribe-container-destroy-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(vaultPath, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(vaultPath, { recursive: true, force: true });
  });

  it('should close database connection', () => {
    const services = createServices({
      vaultPath,
      dbPath: ':memory:',
    });

    expect(services.db.isOpen()).toBe(true);

    destroyServices(services);

    expect(services.db.isOpen()).toBe(false);
  });

  it('should persist and unload collaboration state', async () => {
    const services = createServices({
      vaultPath,
      dbPath: ':memory:',
    });

    // Create a note and get its Yjs doc
    const note = await services.documentService.create({
      title: 'Collab Test',
      type: 'note',
    });

    // Load the Yjs doc to cache it
    await services.collaborationService.getDoc(note.id);

    // Destroy should persist without throwing
    destroyServices(services);

    // Verify database is closed
    expect(services.db.isOpen()).toBe(false);
  });

  it('should be safe to call multiple times', () => {
    const services = createServices({
      vaultPath,
      dbPath: ':memory:',
    });

    // First destroy
    destroyServices(services);
    expect(services.db.isOpen()).toBe(false);

    // Second destroy should not throw
    expect(() => destroyServices(services)).not.toThrow();
  });
});

describe('createTestServices', () => {
  it('should create services with in-memory database', () => {
    const services = createTestServices();

    expect(services.db.isInitialized()).toBe(true);
    expect(services.db.isOpen()).toBe(true);
    expect(services.db.getPath()).toBe(':memory:');

    destroyServices(services);
  });

  it('should use default vault path when not specified', () => {
    const services = createTestServices();

    // Services should be functional even with default vault path
    expect(services.documentService).toBeDefined();
    expect(services.graphService).toBeDefined();

    destroyServices(services);
  });

  it('should accept custom vault path', async () => {
    const customPath = path.join(
      tmpdir(),
      `scribe-test-custom-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(customPath, { recursive: true });

    try {
      const services = createTestServices(customPath);

      // Create a note to verify vault path is used
      const note = await services.documentService.create({
        title: 'Custom Path Test',
        type: 'note',
      });

      // Verify file was created in custom path
      const filePath = path.join(customPath, 'notes', `${note.id}.json`);
      const exists = await fs
        .stat(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      destroyServices(services);
    } finally {
      await fs.rm(customPath, { recursive: true, force: true });
    }
  });

  it('should work for typical unit test pattern', async () => {
    // This test demonstrates the expected usage pattern
    const services = createTestServices();

    try {
      // Act
      const note = await services.documentService.create({
        title: 'Unit Test Note',
        type: 'note',
      });

      // Assert
      expect(note.id).toBeDefined();
      expect(note.title).toBe('Unit Test Note');
    } finally {
      // Cleanup
      destroyServices(services);
    }
  });

  it('should create isolated instances for parallel tests', async () => {
    // Create two independent service instances
    const services1 = createTestServices();
    const services2 = createTestServices();

    try {
      // Create note in services1
      const note1 = await services1.documentService.create({
        title: 'Note in DB 1',
        type: 'note',
      });

      // Create note in services2
      const note2 = await services2.documentService.create({
        title: 'Note in DB 2',
        type: 'note',
      });

      // Each should only see its own note
      const list1 = services1.documentService.list();
      const list2 = services2.documentService.list();

      expect(list1.length).toBe(1);
      expect(list2.length).toBe(1);
      expect(list1[0].id).toBe(note1.id);
      expect(list2[0].id).toBe(note2.id);
    } finally {
      destroyServices(services1);
      destroyServices(services2);
    }
  });
});

describe('Service Dependencies', () => {
  it('should not have circular dependencies at runtime', () => {
    // This test verifies that the dependency order is correct
    // and services can be instantiated without circular issues
    const services = createTestServices();

    // All services should be defined
    expect(services.documentService).toBeDefined();
    expect(services.graphService).toBeDefined();
    expect(services.searchService).toBeDefined();
    expect(services.collaborationService).toBeDefined();

    destroyServices(services);
  });

  it('should allow proper service interaction order', async () => {
    const services = createTestServices();

    try {
      // 1. DocumentService creates note (no dependencies on other services)
      const note = await services.documentService.create({
        title: 'Dependency Test',
        type: 'note',
      });

      // 2. GraphService queries (uses repos, independent of DocumentService)
      const backlinks = services.graphService.getBacklinks(note.id);
      expect(backlinks).toEqual([]);

      // 3. SearchService searches (depends on DocumentService for reindex)
      const results = await services.searchService.search({ text: 'Dependency' });
      expect(results.length).toBe(1);

      // 4. CollaborationService collaborates (depends on DocumentService for content)
      const doc = await services.collaborationService.getDoc(note.id);
      expect(doc).toBeDefined();
    } finally {
      destroyServices(services);
    }
  });
});
