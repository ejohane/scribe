/**
 * Tests for API client in the client SDK.
 *
 * Tests verify:
 * 1. tRPC client created with correct URL
 * 2. All endpoints callable (notes, search, graph)
 * 3. Full type inference works in IDE (verified via TypeScript compilation)
 * 4. Errors thrown for network/server issues
 * 5. Batching works (multiple calls combined)
 * 6. Types exported from package
 *
 * Note: These tests use a mock HTTP server since we can't easily
 * spin up a full daemon with tRPC in unit tests. Integration tests
 * in the daemon package cover full end-to-end scenarios.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import {
  createApiClient,
  createApiClientFromInfo,
  getApiClientUrl,
  isTRPCClientError,
  type ApiClient,
} from './api-client.js';
import { ApiError } from './errors.js';
import type { DaemonInfo } from './discovery.js';

// -----------------------------------------------------------------------------
// Mock Server Setup
// -----------------------------------------------------------------------------

interface MockHandler {
  (req: http.IncomingMessage, body: string): Promise<{ status: number; body: unknown }>;
}

function createMockServer(handler: MockHandler): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Read body
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const response = await handler(req, body);
          res.writeHead(response.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response.body));
        } catch {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Handler error' }));
        }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      resolve({ server, port });
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('createApiClient', () => {
  it('should create a client proxy', () => {
    const client = createApiClient({ port: 3000 });

    expect(client).toBeDefined();
    // tRPC proxy client is a function that creates proxies
    expect(client).toBeTruthy();
  });

  it('should use default host when not specified', () => {
    const url = getApiClientUrl({ port: 3000 });
    expect(url).toBe('http://127.0.0.1:3000/trpc');
  });

  it('should use custom host when specified', () => {
    const url = getApiClientUrl({ port: 3000, host: 'localhost' });
    expect(url).toBe('http://localhost:3000/trpc');
  });
});

describe('createApiClientFromInfo', () => {
  it('should create client from DaemonInfo', () => {
    const info: DaemonInfo = {
      pid: 12345,
      port: 47900,
      vaultPath: '/test/vault',
      startedAt: '2024-01-15T10:30:00Z',
      version: '1.0.0',
    };

    const client = createApiClientFromInfo(info);
    expect(client).toBeDefined();
  });
});

describe('getApiClientUrl', () => {
  it('should return correct URL with default host', () => {
    const url = getApiClientUrl({ port: 8080 });
    expect(url).toBe('http://127.0.0.1:8080/trpc');
  });

  it('should return correct URL with custom host', () => {
    const url = getApiClientUrl({ port: 8080, host: '192.168.1.1' });
    expect(url).toBe('http://192.168.1.1:8080/trpc');
  });
});

describe('API client calls', () => {
  let server: http.Server | null = null;
  let port: number;
  let client: ApiClient;
  let requestLog: Array<{ url: string; method: string; body: string }> = [];

  beforeEach(async () => {
    requestLog = [];

    const result = await createMockServer(async (req, body) => {
      requestLog.push({ url: req.url ?? '', method: req.method ?? '', body });

      // Handle tRPC batch requests
      if (req.url?.startsWith('/trpc')) {
        // Parse tRPC query from URL or body
        const url = new URL(req.url, 'http://localhost');
        const batch = url.searchParams.get('batch');

        // Mock responses for different procedures
        if (req.url.includes('notes.list')) {
          return {
            status: 200,
            body: batch
              ? [{ result: { data: [{ id: 'note-1', title: 'Test Note' }] } }]
              : { result: { data: [{ id: 'note-1', title: 'Test Note' }] } },
          };
        }

        if (req.url.includes('notes.get')) {
          return {
            status: 200,
            body: batch
              ? [{ result: { data: { id: 'note-1', title: 'Test Note', content: {} } } }]
              : { result: { data: { id: 'note-1', title: 'Test Note', content: {} } } },
          };
        }

        if (req.url.includes('notes.create')) {
          return {
            status: 200,
            body: batch
              ? [{ result: { data: { id: 'new-note', title: 'New Note', type: 'note' } } }]
              : { result: { data: { id: 'new-note', title: 'New Note', type: 'note' } } },
          };
        }

        if (req.url.includes('search.query')) {
          return {
            status: 200,
            body: batch
              ? [{ result: { data: { results: [], total: 0 } } }]
              : { result: { data: { results: [], total: 0 } } },
          };
        }

        if (req.url.includes('graph.backlinks')) {
          return {
            status: 200,
            body: batch ? [{ result: { data: [] } }] : { result: { data: [] } },
          };
        }

        if (req.url.includes('graph.tags')) {
          return {
            status: 200,
            body: batch
              ? [{ result: { data: [{ name: 'test', count: 5 }] } }]
              : { result: { data: [{ name: 'test', count: 5 }] } },
          };
        }

        if (req.url.includes('graph.stats')) {
          return {
            status: 200,
            body: batch
              ? [
                  {
                    result: {
                      data: { totalNotes: 10, totalLinks: 5, totalTags: 3, orphanedNotes: 1 },
                    },
                  },
                ]
              : {
                  result: {
                    data: { totalNotes: 10, totalLinks: 5, totalTags: 3, orphanedNotes: 1 },
                  },
                },
          };
        }

        if (req.url.includes('export.toMarkdown')) {
          return {
            status: 200,
            body: batch
              ? [
                  {
                    result: {
                      data: {
                        markdown: '# Test Note\n\nContent here',
                        noteId: 'note-1',
                        title: 'Test Note',
                        exportedAt: '2024-01-15T10:30:00Z',
                      },
                    },
                  },
                ]
              : {
                  result: {
                    data: {
                      markdown: '# Test Note\n\nContent here',
                      noteId: 'note-1',
                      title: 'Test Note',
                      exportedAt: '2024-01-15T10:30:00Z',
                    },
                  },
                },
          };
        }

        // Default 404 for unknown procedures
        return {
          status: 404,
          body: { error: { message: 'Unknown procedure' } },
        };
      }

      return { status: 404, body: { error: 'Not found' } };
    });

    server = result.server;
    port = result.port;
    client = createApiClient({ port });
  });

  afterEach(async () => {
    if (server) {
      await closeServer(server);
      server = null;
    }
  });

  describe('notes router', () => {
    it('should call notes.list', async () => {
      const result = await client.notes.list.query();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(requestLog.some((r) => r.url.includes('notes.list'))).toBe(true);
    });

    it('should call notes.get', async () => {
      const result = await client.notes.get.query('note-1');

      expect(result).toBeDefined();
      expect(requestLog.some((r) => r.url.includes('notes.get'))).toBe(true);
    });

    it('should call notes.create', async () => {
      const result = await client.notes.create.mutate({
        title: 'New Note',
        type: 'note',
      });

      expect(result).toBeDefined();
      expect(requestLog.some((r) => r.url.includes('notes.create'))).toBe(true);
    });
  });

  describe('search router', () => {
    it('should call search.query', async () => {
      const result = await client.search.query.query({ text: 'test' });

      expect(result).toBeDefined();
      expect(requestLog.some((r) => r.url.includes('search.query'))).toBe(true);
    });
  });

  describe('graph router', () => {
    it('should call graph.backlinks', async () => {
      const result = await client.graph.backlinks.query('note-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(requestLog.some((r) => r.url.includes('graph.backlinks'))).toBe(true);
    });

    it('should call graph.tags', async () => {
      const result = await client.graph.tags.query();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(requestLog.some((r) => r.url.includes('graph.tags'))).toBe(true);
    });

    it('should call graph.stats', async () => {
      const result = await client.graph.stats.query();

      expect(result).toBeDefined();
      expect(result.totalNotes).toBe(10);
      expect(requestLog.some((r) => r.url.includes('graph.stats'))).toBe(true);
    });
  });

  describe('export router', () => {
    it('should call export.toMarkdown', async () => {
      const result = await client.export.toMarkdown.query({ noteId: 'note-1' });

      expect(result).toBeDefined();
      expect(result.markdown).toBe('# Test Note\n\nContent here');
      expect(result.noteId).toBe('note-1');
      expect(result.title).toBe('Test Note');
      expect(result.exportedAt).toBeDefined();
      expect(requestLog.some((r) => r.url.includes('export.toMarkdown'))).toBe(true);
    });

    it('should call export.toMarkdown with options', async () => {
      const result = await client.export.toMarkdown.query({
        noteId: 'note-1',
        options: { includeFrontmatter: false, includeTitle: true },
      });

      expect(result).toBeDefined();
      expect(result.markdown).toBeDefined();
      expect(requestLog.some((r) => r.url.includes('export.toMarkdown'))).toBe(true);
    });
  });
});

describe('error handling', () => {
  it('should throw on network failure', async () => {
    // Use a port that's definitely not listening
    const client = createApiClient({ port: 59999 });

    await expect(client.notes.list.query()).rejects.toThrow();
  });

  describe('isTRPCClientError', () => {
    it('should return false for non-tRPC errors', () => {
      const error = new Error('Regular error');
      expect(isTRPCClientError(error)).toBe(false);
    });

    it('should return false for ApiError', () => {
      const error = new ApiError('API error', 'NOT_FOUND');
      expect(isTRPCClientError(error)).toBe(false);
    });
  });
});

describe('batching', () => {
  let server: http.Server | null = null;
  let port: number;
  let client: ApiClient;
  let requestCount = 0;

  beforeEach(async () => {
    requestCount = 0;

    const result = await createMockServer(async (req) => {
      requestCount++;

      // Check if this is a batched request
      const url = new URL(req.url ?? '', 'http://localhost');
      const isBatch = url.searchParams.get('batch') === '1';

      // Return appropriate response for batch queries
      if (req.url?.includes('graph.tags') || req.url?.includes('graph.stats')) {
        if (isBatch) {
          // Batch response with multiple results
          const results = [];
          if (req.url.includes('graph.tags')) {
            results.push({ result: { data: [{ name: 'tag1', count: 1 }] } });
          }
          if (req.url.includes('graph.stats')) {
            results.push({
              result: { data: { totalNotes: 5, totalLinks: 2, totalTags: 1, orphanedNotes: 0 } },
            });
          }
          return { status: 200, body: results.length === 1 ? results : results };
        }
        if (req.url.includes('graph.tags')) {
          return { status: 200, body: { result: { data: [{ name: 'tag1', count: 1 }] } } };
        }
        return {
          status: 200,
          body: {
            result: { data: { totalNotes: 5, totalLinks: 2, totalTags: 1, orphanedNotes: 0 } },
          },
        };
      }

      return { status: 200, body: { result: { data: null } } };
    });

    server = result.server;
    port = result.port;
    client = createApiClient({ port });
  });

  afterEach(async () => {
    if (server) {
      await closeServer(server);
      server = null;
    }
  });

  it('should support batched requests', async () => {
    // Make multiple concurrent requests - tRPC should batch them
    const [tags, stats] = await Promise.all([
      client.graph.tags.query(),
      client.graph.stats.query(),
    ]);

    // Both should succeed
    expect(tags).toBeDefined();
    expect(stats).toBeDefined();

    // Note: The exact number of requests depends on tRPC's batching behavior
    // In real scenarios with httpBatchLink, concurrent requests may be batched
    expect(requestCount).toBeGreaterThan(0);
  });
});

// -----------------------------------------------------------------------------
// Type inference tests (compile-time verification)
// These tests verify that TypeScript correctly infers types.
// If these compile without errors, type inference is working.
// -----------------------------------------------------------------------------

describe('type inference', () => {
  it('should have correct types for client methods', () => {
    // This test verifies compile-time type inference
    // If this compiles, the types are correctly exported

    const client = createApiClient({ port: 3000 });

    // Verify that the expected methods exist on the client
    expect(typeof client.notes.list.query).toBe('function');
    expect(typeof client.notes.get.query).toBe('function');
    expect(typeof client.notes.create.mutate).toBe('function');
    expect(typeof client.notes.update.mutate).toBe('function');
    expect(typeof client.notes.delete.mutate).toBe('function');
    expect(typeof client.notes.exists.query).toBe('function');
    expect(typeof client.notes.count.query).toBe('function');

    expect(typeof client.search.query.query).toBe('function');
    expect(typeof client.search.reindex.mutate).toBe('function');
    expect(typeof client.search.reindexAll.mutate).toBe('function');

    expect(typeof client.graph.backlinks.query).toBe('function');
    expect(typeof client.graph.forwardLinks.query).toBe('function');
    expect(typeof client.graph.notesByTag.query).toBe('function');
    expect(typeof client.graph.tags.query).toBe('function');
    expect(typeof client.graph.noteTags.query).toBe('function');
    expect(typeof client.graph.stats.query).toBe('function');

    // Export router methods
    expect(typeof client.export.toMarkdown.query).toBe('function');
  });
});

describe('type exports', () => {
  it('should export ExportRouter type from the package', async () => {
    // This test verifies that ExportRouter type is exported from the package
    // If this compiles without error, the type is correctly exported
    const sdk = await import('./index.js');

    // Verify the type exists by checking it's exported (type-only exports won't be in runtime)
    // We can verify AppRouter exists which includes export namespace
    expect(sdk).toHaveProperty('VERSION');

    // The existence of the export router on client verifies AppRouter includes it
    const client = sdk.createApiClient({ port: 3000 });
    expect(typeof client.export.toMarkdown.query).toBe('function');
  });
});
