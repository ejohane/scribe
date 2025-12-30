/**
 * HTTP transport layer for sync server communication.
 *
 * This module provides the SyncTransport class that handles all HTTP
 * communication with the sync server, including:
 * - Push and pull requests with proper error handling
 * - Exponential backoff retry logic for transient failures
 * - Rate limiting handling with Retry-After header support
 * - Authentication via Bearer token
 *
 * @since 1.0.0
 */

import type {
  SyncPushRequest,
  SyncPushResponse,
  SyncPullRequest,
  SyncPullResponse,
} from '@scribe/shared';
import { SyncError, ErrorCode } from '@scribe/shared';

/**
 * Network error codes that indicate transient failures worth retrying.
 */
const RETRYABLE_ERRORS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ERR_NETWORK',
  'ERR_CONNECTION_REFUSED',
];

/**
 * HTTP status codes that indicate server issues worth retrying.
 */
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

/**
 * Configuration for retry behavior on transient failures.
 *
 * @since 1.0.0
 */
export interface RetryConfig {
  /** Maximum number of retry attempts before giving up */
  maxRetries: number;
  /** Initial delay in milliseconds between retries */
  baseDelayMs: number;
  /** Maximum delay in milliseconds (caps exponential growth) */
  maxDelayMs: number;
  /** Multiplier for exponential backoff (delay = base * multiplier^retryCount) */
  backoffMultiplier: number;
}

/**
 * Default retry configuration.
 * - 5 retries with exponential backoff
 * - Delays: 1s, 2s, 4s, 8s, 16s (capped at 60s)
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
};

/**
 * Configuration for the SyncTransport client.
 *
 * @since 1.0.0
 */
export interface SyncTransportConfig {
  /** Base URL of the sync server (e.g., 'https://sync.scribe.app') */
  serverUrl: string;
  /** API key for authentication (sent as Bearer token) */
  apiKey: string;
  /** Optional retry configuration override */
  retryConfig?: RetryConfig;
}

/**
 * Response from the server status endpoint.
 *
 * @since 1.0.0
 */
export interface ServerStatusResponse {
  /** Whether the server is operational */
  ok: boolean;
  /** Current server time in ISO 8601 format */
  serverTime: string;
}

/**
 * HTTP transport client for sync server communication.
 *
 * Handles all HTTP communication with the sync server including
 * authentication, retry logic, and error handling.
 *
 * @example
 * ```typescript
 * const transport = new SyncTransport({
 *   serverUrl: 'https://sync.scribe.app',
 *   apiKey: 'sk_live_abc123',
 * });
 *
 * // Push local changes
 * const pushResponse = await transport.push({
 *   deviceId: 'device-1',
 *   changes: [{ noteId: 'note-1', operation: 'update', version: 2, payload: {...} }],
 * });
 *
 * // Pull remote changes
 * const pullResponse = await transport.pull({
 *   deviceId: 'device-1',
 *   sinceSequence: 42,
 * });
 * ```
 *
 * @since 1.0.0
 */
export class SyncTransport {
  private readonly serverUrl: string;
  private readonly apiKey: string;
  private readonly retryConfig: RetryConfig;

  constructor(config: SyncTransportConfig) {
    // Normalize URL by removing trailing slash
    this.serverUrl = config.serverUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.retryConfig = config.retryConfig ?? DEFAULT_RETRY_CONFIG;
  }

  /**
   * Push local changes to the sync server.
   *
   * @param request - The push request containing changes to sync
   * @returns Response with accepted, conflicted, and failed changes
   * @throws {SyncError} If the request fails after all retries
   *
   * @since 1.0.0
   */
  async push(request: SyncPushRequest): Promise<SyncPushResponse> {
    return this.fetchWithRetry<SyncPushResponse>('/v1/sync/push', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Pull remote changes from the sync server.
   *
   * @param request - The pull request with cursor and options
   * @returns Response with changes since the specified sequence
   * @throws {SyncError} If the request fails after all retries
   *
   * @since 1.0.0
   */
  async pull(request: SyncPullRequest): Promise<SyncPullResponse> {
    return this.fetchWithRetry<SyncPullResponse>('/v1/sync/pull', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Check server status and connectivity.
   *
   * Useful for:
   * - Verifying the server is reachable
   * - Detecting clock drift between client and server
   * - Health checks before initiating sync
   *
   * @returns Server status including current server time
   * @throws {SyncError} If the server is unreachable
   *
   * @since 1.0.0
   */
  async checkStatus(): Promise<ServerStatusResponse> {
    return this.fetchWithRetry<ServerStatusResponse>('/v1/sync/status', {
      method: 'GET',
    });
  }

  /**
   * Execute an HTTP request with retry logic.
   *
   * Implements exponential backoff with jitter for:
   * - Network errors (connection reset, timeout, etc.)
   * - Server errors (5xx status codes)
   * - Rate limiting (429 with Retry-After header)
   *
   * @param path - API endpoint path (e.g., '/v1/sync/push')
   * @param options - Fetch options (method, body, etc.)
   * @param retryCount - Current retry attempt (internal use)
   * @returns Parsed JSON response
   * @throws {SyncError} If the request fails after all retries
   */
  private async fetchWithRetry<T>(path: string, options: RequestInit, retryCount = 0): Promise<T> {
    const url = `${this.serverUrl}${path}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...options.headers,
        },
      });

      // Handle authentication failure (non-retryable)
      if (response.status === 401) {
        throw new SyncError(ErrorCode.SYNC_AUTH_FAILED, 'Invalid API key');
      }

      // Handle rate limiting with Retry-After support
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : this.computeDelay(retryCount);

        if (retryCount < this.retryConfig.maxRetries) {
          await this.sleep(delay);
          return this.fetchWithRetry(path, options, retryCount + 1);
        }
        throw new SyncError(ErrorCode.SYNC_RATE_LIMITED, 'Rate limit exceeded');
      }

      // Handle retryable server errors
      if (RETRYABLE_STATUS_CODES.includes(response.status)) {
        if (retryCount < this.retryConfig.maxRetries) {
          await this.sleep(this.computeDelay(retryCount));
          return this.fetchWithRetry(path, options, retryCount + 1);
        }
        throw new SyncError(ErrorCode.SYNC_SERVER_ERROR, `Server error: ${response.status}`);
      }

      // Handle other non-OK responses
      if (!response.ok) {
        const body = await response.text();
        throw new SyncError(ErrorCode.SYNC_FAILED, `Request failed: ${response.status} - ${body}`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      // Re-throw SyncErrors without wrapping
      if (error instanceof SyncError) {
        throw error;
      }

      const err = error as Error & { code?: string };

      // Check for retryable network errors
      if (RETRYABLE_ERRORS.includes(err.code ?? '') || err.name === 'TypeError') {
        if (retryCount < this.retryConfig.maxRetries) {
          await this.sleep(this.computeDelay(retryCount));
          return this.fetchWithRetry(path, options, retryCount + 1);
        }
      }

      // Wrap unknown errors in SyncError
      throw new SyncError(
        ErrorCode.SYNC_NETWORK_ERROR,
        `Network error: ${err.message}`,
        undefined,
        err
      );
    }
  }

  /**
   * Compute delay for exponential backoff.
   *
   * @param retryCount - Current retry attempt (0-indexed)
   * @returns Delay in milliseconds
   */
  private computeDelay(retryCount: number): number {
    const delay =
      this.retryConfig.baseDelayMs * Math.pow(this.retryConfig.backoffMultiplier, retryCount);
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  /**
   * Sleep for a specified duration.
   *
   * @param ms - Duration in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
