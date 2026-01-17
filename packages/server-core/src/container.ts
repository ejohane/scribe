/**
 * Service Container - Dependency injection and lifecycle management for Scribe daemon.
 *
 * This module provides a simple, explicit service container that:
 * 1. Creates and wires all services with their dependencies
 * 2. Manages database initialization
 * 3. Provides clean shutdown capabilities
 *
 * Why a Service Container?
 * - Testability: Easy to mock dependencies
 * - Single initialization point: Create all services once at startup
 * - Lifecycle management: Clean shutdown, resource cleanup
 * - Configuration injection: Pass config to services
 *
 * Why NOT a DI Framework?
 * - Overkill for our scope
 * - Manual wiring is clear and explicit
 * - No magic, easier to debug
 *
 * @module
 */

import {
  ScribeDatabase,
  NotesRepository,
  LinksRepository,
  TagsRepository,
  SearchRepository,
  YjsStateRepository,
  SnapshotsRepository,
} from '@scribe/server-db';
import type { PluginEventBus } from '@scribe/plugin-core';
import { DocumentService } from './services/document.service.js';
import { GraphService } from './services/graph.service.js';
import { SearchService } from './services/search.service.js';
import { CollaborationService } from './services/collaboration.service.js';

/**
 * Configuration for the service container.
 */
export interface ServiceConfig {
  /** Absolute path to the vault root directory */
  vaultPath: string;
  /** Path to the SQLite database file (or ':memory:' for testing) */
  dbPath: string;
  /** Enable verbose SQL logging (default: false) */
  verbose?: boolean;
  /** Optional plugin event bus for emitting note lifecycle events */
  eventBus?: PluginEventBus;
}

/**
 * All instantiated services and repositories.
 */
export interface Services {
  // Database
  /** Main database instance */
  db: ScribeDatabase;

  // Repositories
  /** Notes CRUD repository */
  notesRepo: NotesRepository;
  /** Links graph repository */
  linksRepo: LinksRepository;
  /** Tags repository */
  tagsRepo: TagsRepository;
  /** Full-text search repository */
  searchRepo: SearchRepository;
  /** Yjs state persistence repository */
  yjsRepo: YjsStateRepository;
  /** Snapshot versioning repository */
  snapshotsRepo: SnapshotsRepository;

  // Services
  /** Document CRUD with file I/O */
  documentService: DocumentService;
  /** Read-only graph queries */
  graphService: GraphService;
  /** Full-text search with enrichment */
  searchService: SearchService;
  /** Yjs collaboration management */
  collaborationService: CollaborationService;
}

/**
 * Create and wire all services with their dependencies.
 *
 * Call this once at daemon startup. The function:
 * 1. Initializes the database (runs migrations)
 * 2. Creates all repositories
 * 3. Creates all services with proper dependency injection
 *
 * @param config - Service configuration
 * @returns All instantiated services
 *
 * @example
 * ```typescript
 * const services = createServices({
 *   vaultPath: '/path/to/vault',
 *   dbPath: '/path/to/vault/.scribe/index.db',
 *   verbose: process.env.NODE_ENV === 'development',
 * });
 *
 * // Use services
 * const note = await services.documentService.create({ title: 'Test', type: 'note' });
 * ```
 */
export function createServices(config: ServiceConfig): Services {
  // 1. Initialize database
  const db = new ScribeDatabase({
    path: config.dbPath,
    verbose: config.verbose ?? false,
  });
  db.initialize();

  const rawDb = db.getDb();

  // 2. Create repositories (data access layer)
  const notesRepo = new NotesRepository(rawDb);
  const linksRepo = new LinksRepository(rawDb);
  const tagsRepo = new TagsRepository(rawDb);
  const searchRepo = new SearchRepository(rawDb);
  const yjsRepo = new YjsStateRepository(rawDb);
  const snapshotsRepo = new SnapshotsRepository(rawDb);

  // 3. Create services (business logic layer)
  // Note: Order matters due to dependencies

  // DocumentService has no service dependencies, only repos
  const documentService = new DocumentService({
    vaultPath: config.vaultPath,
    notesRepo,
    linksRepo,
    tagsRepo,
    searchRepo,
    eventBus: config.eventBus,
  });

  // GraphService has no service dependencies, only repos
  const graphService = new GraphService({
    notesRepo,
    linksRepo,
    tagsRepo,
  });

  // SearchService depends on DocumentService
  const searchService = new SearchService({
    searchRepo,
    notesRepo,
    documentService,
  });

  // CollaborationService depends on DocumentService
  const collaborationService = new CollaborationService({
    yjsRepo,
    documentService,
  });

  return {
    db,
    notesRepo,
    linksRepo,
    tagsRepo,
    searchRepo,
    yjsRepo,
    snapshotsRepo,
    documentService,
    graphService,
    searchService,
    collaborationService,
  };
}

/**
 * Gracefully shut down all services and release resources.
 *
 * Call this on daemon shutdown (e.g., SIGTERM handler).
 * This ensures:
 * - All Yjs documents are persisted
 * - Database connection is properly closed
 *
 * @param services - Services to destroy
 *
 * @example
 * ```typescript
 * process.on('SIGTERM', () => {
 *   destroyServices(services);
 *   process.exit(0);
 * });
 * ```
 */
export function destroyServices(services: Services): void {
  // Persist any in-memory Yjs state before closing
  services.collaborationService.persistAll();
  services.collaborationService.unloadAll();

  // Close database connection
  services.db.close();
}

/**
 * Create services with an in-memory database for testing.
 *
 * This is a convenience function for unit and integration tests.
 * It creates a fresh in-memory SQLite database each time.
 *
 * @param vaultPath - Optional vault path (defaults to '/tmp/test-vault')
 * @returns All instantiated services with in-memory database
 *
 * @example
 * ```typescript
 * describe('DocumentService', () => {
 *   let services: Services;
 *
 *   beforeEach(() => {
 *     services = createTestServices();
 *   });
 *
 *   afterEach(() => {
 *     destroyServices(services);
 *   });
 *
 *   it('should create a note', async () => {
 *     const note = await services.documentService.create({
 *       title: 'Test',
 *       type: 'note',
 *     });
 *     expect(note.id).toBeDefined();
 *   });
 * });
 * ```
 */
export function createTestServices(vaultPath?: string): Services {
  return createServices({
    vaultPath: vaultPath ?? '/tmp/test-vault',
    dbPath: ':memory:',
    verbose: false,
  });
}
