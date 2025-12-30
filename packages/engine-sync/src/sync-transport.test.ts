/**
 * Tests for SyncTransport HTTP client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncTransport } from './sync-transport.js';
import { ErrorCode, SyncError } from '@scribe/shared';
import type { SyncPushRequest, SyncPullRequest } from '@scribe/shared';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('SyncTransport', () => {
  const defaultConfig = {
    serverUrl: 'https://sync.scribe.app',
    apiKey: 'test-api-key',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Helper to create a mock Response object
   */
  function createMockResponse(
    status: number,
    body: unknown,
    headers?: Record<string, string>
  ): Response {
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: new Headers(headers),
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response;
  }

  describe('constructor', () => {
    it('should normalize serverUrl by removing trailing slash', () => {
      const transport = new SyncTransport({
        serverUrl: 'https://sync.scribe.app/',
        apiKey: 'test-key',
      });

      mockFetch.mockResolvedValueOnce(
        createMockResponse(200, { ok: true, serverTime: '2025-01-01T00:00:00Z' })
      );

      // Make a request to verify the URL normalization
      transport.checkStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sync.scribe.app/v1/sync/status',
        expect.anything()
      );
    });

    it('should preserve serverUrl without trailing slash', () => {
      const transport = new SyncTransport({
        serverUrl: 'https://sync.scribe.app',
        apiKey: 'test-key',
      });

      mockFetch.mockResolvedValueOnce(
        createMockResponse(200, { ok: true, serverTime: '2025-01-01T00:00:00Z' })
      );

      transport.checkStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sync.scribe.app/v1/sync/status',
        expect.anything()
      );
    });
  });

  describe('push()', () => {
    it('should send correct request format', async () => {
      const transport = new SyncTransport(defaultConfig);
      const request: SyncPushRequest = {
        deviceId: 'device-123',
        changes: [
          {
            noteId: 'note-1',
            operation: 'create',
            version: 1,
            payload: { title: 'Test Note' },
          },
        ],
      };

      const expectedResponse = {
        accepted: [{ noteId: 'note-1', serverVersion: 1, serverSequence: 1 }],
        conflicts: [],
        errors: [],
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(200, expectedResponse));

      const response = await transport.push(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sync.scribe.app/v1/sync/push',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
      expect(response).toEqual(expectedResponse);
    });
  });

  describe('pull()', () => {
    it('should send correct request format', async () => {
      const transport = new SyncTransport(defaultConfig);
      const request: SyncPullRequest = {
        deviceId: 'device-123',
        sinceSequence: 42,
        limit: 100,
      };

      const expectedResponse = {
        changes: [
          {
            noteId: 'note-1',
            operation: 'update',
            version: 3,
            serverSequence: 43,
            note: { title: 'Updated Note' },
            timestamp: '2025-01-01T00:00:00Z',
          },
        ],
        hasMore: false,
        latestSequence: 43,
        serverTime: '2025-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(200, expectedResponse));

      const response = await transport.pull(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sync.scribe.app/v1/sync/pull',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
      expect(response).toEqual(expectedResponse);
    });

    it('should handle priorityNoteIds in request', async () => {
      const transport = new SyncTransport(defaultConfig);
      const request: SyncPullRequest = {
        deviceId: 'device-123',
        sinceSequence: 0,
        priorityNoteIds: ['note-a', 'note-b'],
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse(200, {
          changes: [],
          hasMore: false,
          latestSequence: 0,
          serverTime: '2025-01-01T00:00:00Z',
        })
      );

      await transport.pull(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('priorityNoteIds'),
        })
      );
    });
  });

  describe('checkStatus()', () => {
    it('should send GET request to status endpoint', async () => {
      const transport = new SyncTransport(defaultConfig);
      const expectedResponse = { ok: true, serverTime: '2025-01-01T12:00:00Z' };

      mockFetch.mockResolvedValueOnce(createMockResponse(200, expectedResponse));

      const response = await transport.checkStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sync.scribe.app/v1/sync/status',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
      expect(response).toEqual(expectedResponse);
    });
  });

  describe('error handling', () => {
    it('should throw SyncError with SYNC_AUTH_FAILED for 401', async () => {
      const transport = new SyncTransport(defaultConfig);

      mockFetch.mockResolvedValueOnce(createMockResponse(401, { error: 'Unauthorized' }));

      let caughtError: unknown;
      try {
        await transport.checkStatus();
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(SyncError);
      expect((caughtError as SyncError).code).toBe(ErrorCode.SYNC_AUTH_FAILED);
      expect((caughtError as SyncError).message).toBe('Invalid API key');
    });

    it('should throw SyncError with SYNC_FAILED for non-retryable errors', async () => {
      const transport = new SyncTransport(defaultConfig);

      mockFetch.mockResolvedValueOnce(createMockResponse(400, { error: 'Bad Request' }));

      let caughtError: unknown;
      try {
        await transport.checkStatus();
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(SyncError);
      expect((caughtError as SyncError).code).toBe(ErrorCode.SYNC_FAILED);
    });

    it('should throw SyncError with SYNC_NETWORK_ERROR for network failures', async () => {
      const transport = new SyncTransport({
        ...defaultConfig,
        retryConfig: {
          maxRetries: 0,
          baseDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
        },
      });

      const networkError = new TypeError('Failed to fetch');
      mockFetch.mockRejectedValueOnce(networkError);

      let caughtError: unknown;
      try {
        await transport.checkStatus();
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(SyncError);
      expect((caughtError as SyncError).code).toBe(ErrorCode.SYNC_NETWORK_ERROR);
    });
  });

  describe('retry logic', () => {
    it('should retry on 429 rate limiting with Retry-After header', async () => {
      const transport = new SyncTransport({
        ...defaultConfig,
        retryConfig: {
          maxRetries: 3,
          baseDelayMs: 100,
          maxDelayMs: 1000,
          backoffMultiplier: 2,
        },
      });

      // First call returns 429 with Retry-After
      mockFetch.mockResolvedValueOnce(
        createMockResponse(429, { error: 'Too Many Requests' }, { 'Retry-After': '1' })
      );
      // Second call succeeds
      mockFetch.mockResolvedValueOnce(
        createMockResponse(200, { ok: true, serverTime: '2025-01-01T00:00:00Z' })
      );

      const responsePromise = transport.checkStatus();

      // Advance timers to allow the retry
      await vi.advanceTimersByTimeAsync(1000);

      const response = await responsePromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response).toEqual({ ok: true, serverTime: '2025-01-01T00:00:00Z' });
    });

    it('should throw SYNC_RATE_LIMITED after max retries on 429', async () => {
      const transport = new SyncTransport({
        ...defaultConfig,
        retryConfig: {
          maxRetries: 2,
          baseDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
        },
      });

      // All calls return 429 (initial + 2 retries = 3 calls)
      mockFetch.mockResolvedValueOnce(createMockResponse(429, { error: 'Too Many Requests' }));
      mockFetch.mockResolvedValueOnce(createMockResponse(429, { error: 'Too Many Requests' }));
      mockFetch.mockResolvedValueOnce(createMockResponse(429, { error: 'Too Many Requests' }));

      // Attach a catch handler immediately to prevent unhandled rejection
      const responsePromise = transport.checkStatus().catch((e) => e);

      // Advance timers for all retries
      await vi.advanceTimersByTimeAsync(1000);

      const result = await responsePromise;

      expect(result).toBeInstanceOf(SyncError);
      expect((result as SyncError).code).toBe(ErrorCode.SYNC_RATE_LIMITED);
    });

    it('should retry on 500 server errors', async () => {
      const transport = new SyncTransport({
        ...defaultConfig,
        retryConfig: {
          maxRetries: 3,
          baseDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
        },
      });

      // First two calls return 500
      mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Internal Server Error' }));
      mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Internal Server Error' }));
      // Third call succeeds
      mockFetch.mockResolvedValueOnce(
        createMockResponse(200, { ok: true, serverTime: '2025-01-01T00:00:00Z' })
      );

      const responsePromise = transport.checkStatus();

      // Advance timers for retries
      await vi.advanceTimersByTimeAsync(1000);

      const response = await responsePromise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(response).toEqual({ ok: true, serverTime: '2025-01-01T00:00:00Z' });
    });

    it('should throw SYNC_SERVER_ERROR after max retries on 5xx', async () => {
      const transport = new SyncTransport({
        ...defaultConfig,
        retryConfig: {
          maxRetries: 2,
          baseDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
        },
      });

      // All calls return 503 (initial + 2 retries = 3 calls)
      mockFetch.mockResolvedValueOnce(createMockResponse(503, { error: 'Service Unavailable' }));
      mockFetch.mockResolvedValueOnce(createMockResponse(503, { error: 'Service Unavailable' }));
      mockFetch.mockResolvedValueOnce(createMockResponse(503, { error: 'Service Unavailable' }));

      // Attach a catch handler immediately to prevent unhandled rejection
      const responsePromise = transport.checkStatus().catch((e) => e);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await responsePromise;

      expect(result).toBeInstanceOf(SyncError);
      expect((result as SyncError).code).toBe(ErrorCode.SYNC_SERVER_ERROR);
    });

    it('should retry on network errors like ECONNRESET', async () => {
      const transport = new SyncTransport({
        ...defaultConfig,
        retryConfig: {
          maxRetries: 3,
          baseDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
        },
      });

      const connectionError = Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' });
      mockFetch.mockRejectedValueOnce(connectionError);
      mockFetch.mockResolvedValueOnce(
        createMockResponse(200, { ok: true, serverTime: '2025-01-01T00:00:00Z' })
      );

      const responsePromise = transport.checkStatus();
      await vi.advanceTimersByTimeAsync(1000);

      const response = await responsePromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response).toEqual({ ok: true, serverTime: '2025-01-01T00:00:00Z' });
    });

    it('should retry on TypeError (typically network failures in fetch)', async () => {
      const transport = new SyncTransport({
        ...defaultConfig,
        retryConfig: {
          maxRetries: 3,
          baseDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
        },
      });

      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      mockFetch.mockResolvedValueOnce(
        createMockResponse(200, { ok: true, serverTime: '2025-01-01T00:00:00Z' })
      );

      const responsePromise = transport.checkStatus();
      await vi.advanceTimersByTimeAsync(1000);

      const response = await responsePromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.ok).toBe(true);
    });

    it('should use exponential backoff for delays', async () => {
      const transport = new SyncTransport({
        ...defaultConfig,
        retryConfig: {
          maxRetries: 3,
          baseDelayMs: 100,
          maxDelayMs: 10000,
          backoffMultiplier: 2,
        },
      });

      // Mock all 4 calls (initial + 3 retries)
      mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Server Error' }));
      mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Server Error' }));
      mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Server Error' }));
      mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Server Error' }));

      // Attach a catch handler immediately to prevent unhandled rejection
      const responsePromise = transport.checkStatus().catch((e) => e);

      // First call: immediate
      // Second call: after 100ms (base delay)
      // Third call: after 200ms (100 * 2^1)
      // Fourth call: after 400ms (100 * 2^2)

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
      await vi.advanceTimersByTimeAsync(400);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await responsePromise;
      expect(result).toBeInstanceOf(SyncError);
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should cap delay at maxDelayMs', async () => {
      const transport = new SyncTransport({
        ...defaultConfig,
        retryConfig: {
          maxRetries: 5,
          baseDelayMs: 1000,
          maxDelayMs: 2000, // Cap at 2s even though 1000 * 2^4 = 16000
          backoffMultiplier: 2,
        },
      });

      // Mock all 6 calls (initial + 5 retries)
      mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Server Error' }));
      mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Server Error' }));
      mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Server Error' }));
      mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Server Error' }));
      mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Server Error' }));
      mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Server Error' }));

      // Attach a catch handler immediately to prevent unhandled rejection
      const responsePromise = transport.checkStatus().catch((e) => e);

      // Even with high retry counts, delay should not exceed maxDelayMs
      await vi.advanceTimersByTimeAsync(20000);

      const result = await responsePromise;
      expect(result).toBeInstanceOf(SyncError);
    });
  });

  describe('retryable status codes', () => {
    const retryableStatuses = [429, 500, 502, 503, 504];

    for (const status of retryableStatuses) {
      it(`should retry on ${status} status code`, async () => {
        const transport = new SyncTransport({
          ...defaultConfig,
          retryConfig: {
            maxRetries: 1,
            baseDelayMs: 10,
            maxDelayMs: 100,
            backoffMultiplier: 2,
          },
        });

        mockFetch.mockResolvedValueOnce(createMockResponse(status, { error: 'Error' }));
        mockFetch.mockResolvedValueOnce(
          createMockResponse(200, { ok: true, serverTime: '2025-01-01T00:00:00Z' })
        );

        const responsePromise = transport.checkStatus();
        await vi.advanceTimersByTimeAsync(1000);

        const response = await responsePromise;
        expect(response.ok).toBe(true);
      });
    }
  });

  describe('non-retryable errors', () => {
    const nonRetryableStatuses = [400, 403, 404, 422];

    for (const status of nonRetryableStatuses) {
      it(`should not retry on ${status} status code`, async () => {
        const transport = new SyncTransport({
          ...defaultConfig,
          retryConfig: {
            maxRetries: 3,
            baseDelayMs: 10,
            maxDelayMs: 100,
            backoffMultiplier: 2,
          },
        });

        mockFetch.mockResolvedValueOnce(createMockResponse(status, { error: 'Client Error' }));

        await expect(transport.checkStatus()).rejects.toThrow(SyncError);
        expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
      });
    }
  });

  describe('custom retry config', () => {
    it('should respect custom retry config', async () => {
      const transport = new SyncTransport({
        ...defaultConfig,
        retryConfig: {
          maxRetries: 1,
          baseDelayMs: 50,
          maxDelayMs: 100,
          backoffMultiplier: 3,
        },
      });

      // Mock both calls (initial + 1 retry)
      mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Server Error' }));
      mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Server Error' }));

      // Attach a catch handler immediately to prevent unhandled rejection
      const responsePromise = transport.checkStatus().catch((e) => e);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await responsePromise;
      expect(result).toBeInstanceOf(SyncError);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry (maxRetries: 1)
    });
  });
});
