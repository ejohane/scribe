/**
 * ScribeClient - Unified client interface for connecting to the Scribe daemon.
 *
 * Provides a high-level API that combines:
 * - Auto-discovery of running daemon
 * - tRPC API client for CRUD operations
 * - WebSocket client for real-time collaboration
 *
 * @module
 */

import { discoverDaemon, createManualDaemonInfo, type DaemonInfo } from './discovery.js';
import { createApiClient, type ApiClient } from './api-client.js';
import { CollabClient } from './collab-client.js';

/**
 * Options for creating a ScribeClient.
 */
export interface ScribeClientOptions {
  /**
   * Auto-discover daemon from ~/.scribe/daemon.json.
   * Only works in Node.js environments.
   * @default true
   */
  autoDiscover?: boolean;

  /**
   * Host address for manual connection.
   * Use this when auto-discovery is not available (e.g., browser).
   * @default '127.0.0.1'
   */
  host?: string;

  /**
   * Port for manual connection.
   * Required when autoDiscover is false.
   */
  port?: number;

  /**
   * Connection timeout in milliseconds.
   * @default 3000
   */
  connectTimeout?: number;

  /**
   * Automatically connect when client is created.
   * If true, connection happens in next tick to allow event listeners to be set up.
   * @default true
   */
  autoConnect?: boolean;
}

/**
 * Connection status of the client.
 */
export type ClientStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Event types emitted by ScribeClient.
 */
export interface ScribeClientEvents {
  /** Emitted when status changes */
  'status-change': [ClientStatus];
  /** Emitted when successfully connected */
  connected: [];
  /** Emitted when disconnected */
  disconnected: [];
  /** Emitted when an error occurs */
  error: [Error];
}

/**
 * Event listener function type.
 */
type EventListener<T extends unknown[]> = (...args: T) => void;

/**
 * ScribeClient - Unified client for the Scribe daemon.
 *
 * Provides a simple interface for connecting to and interacting with the
 * Scribe daemon. Combines auto-discovery, tRPC API access, and WebSocket
 * collaboration into a single client.
 *
 * @example
 * ```typescript
 * // Auto-discovery (Node.js)
 * const client = new ScribeClient();
 *
 * client.on('connected', async () => {
 *   const notes = await client.api.notes.list.query();
 *   console.log('Found', notes.length, 'notes');
 * });
 *
 * client.on('error', (err) => {
 *   console.error('Connection failed:', err.message);
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Manual connection (Browser)
 * const client = new ScribeClient({
 *   autoDiscover: false,
 *   host: '127.0.0.1',
 *   port: 47832,
 *   autoConnect: false,
 * });
 *
 * await client.connect();
 * const notes = await client.api.notes.list.query();
 * ```
 *
 * @example
 * ```typescript
 * // Real-time collaboration
 * const client = new ScribeClient({ port: 47832, autoConnect: false });
 * await client.connect();
 *
 * const session = await client.collab.joinDocument('my-note');
 * const yText = session.doc.getText('content');
 * yText.insert(0, 'Hello, world!');
 *
 * // Changes are automatically synced
 * session.destroy();
 * ```
 */
export class ScribeClient {
  /** Current connection status */
  private _status: ClientStatus = 'disconnected';

  /** Daemon info from discovery or manual config */
  private daemonInfo: DaemonInfo | null = null;

  /** Event listeners */
  private listeners: Map<keyof ScribeClientEvents, Set<EventListener<unknown[]>>> = new Map();

  /** tRPC API client for CRUD operations */
  private _api: ApiClient | null = null;

  /** WebSocket client for real-time collaboration */
  private _collab: CollabClient | null = null;

  /** Client options */
  private readonly options: Required<
    Pick<ScribeClientOptions, 'autoDiscover' | 'autoConnect' | 'connectTimeout'>
  > &
    Pick<ScribeClientOptions, 'host' | 'port'>;

  /**
   * Create a new ScribeClient.
   *
   * @param options - Client options
   */
  constructor(options: ScribeClientOptions = {}) {
    // Set defaults
    this.options = {
      autoDiscover: options.autoDiscover ?? true,
      autoConnect: options.autoConnect ?? true,
      connectTimeout: options.connectTimeout ?? 3000,
      host: options.host,
      port: options.port,
    };

    // Auto-connect in next tick to allow event listeners to be set up
    if (this.options.autoConnect) {
      setImmediate(() => {
        this.connect().catch(() => {
          // Error is emitted via event, no need to handle here
        });
      });
    }
  }

  // ===========================================================================
  // Public Getters
  // ===========================================================================

  /**
   * Current connection status.
   */
  get status(): ClientStatus {
    return this._status;
  }

  /**
   * Whether the client is connected to the daemon.
   */
  get isConnected(): boolean {
    return this._status === 'connected';
  }

  /**
   * tRPC API client for notes, search, and graph operations.
   *
   * @throws Error if not connected
   *
   * @example
   * ```typescript
   * const notes = await client.api.notes.list.query();
   * const note = await client.api.notes.get.query('note-id');
   * ```
   */
  get api(): ApiClient {
    if (!this._api) {
      throw new Error('Not connected. Call connect() first or wait for "connected" event.');
    }
    return this._api;
  }

  /**
   * WebSocket client for real-time collaboration.
   *
   * @throws Error if not connected
   *
   * @example
   * ```typescript
   * const session = await client.collab.joinDocument('note-id');
   * const yText = session.doc.getText('content');
   * ```
   */
  get collab(): CollabClient {
    if (!this._collab) {
      throw new Error('Not connected. Call connect() first or wait for "connected" event.');
    }
    return this._collab;
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  /**
   * Connect to the Scribe daemon.
   *
   * Discovers (or uses provided) daemon info, creates API and collab clients,
   * verifies connectivity, and establishes WebSocket connection.
   *
   * @throws Error if connection fails
   *
   * @example
   * ```typescript
   * const client = new ScribeClient({ autoConnect: false });
   *
   * try {
   *   await client.connect();
   *   console.log('Connected!');
   * } catch (err) {
   *   console.error('Failed to connect:', err.message);
   * }
   * ```
   */
  async connect(): Promise<void> {
    // Skip if already connected or connecting
    if (this._status === 'connected' || this._status === 'connecting') {
      return;
    }

    this.setStatus('connecting');

    try {
      // 1. Discover or create daemon info
      this.daemonInfo = await this.resolveDaemonInfo();

      // 2. Create API client
      this._api = createApiClient({
        port: this.daemonInfo.port,
        host: this.options.host,
      });

      // 3. Verify connection with a health check via API
      // We try a simple query to verify the connection works
      await this.verifyConnection();

      // 4. Create collab client
      this._collab = new CollabClient({
        port: this.daemonInfo.port,
        host: this.options.host,
      });

      // 5. Forward collab events
      this._collab.on('disconnected', () => {
        if (this._status === 'connected') {
          this.setStatus('disconnected');
          this.emit('disconnected');
        }
      });

      this._collab.on('error', (err) => {
        this.emit('error', err);
      });

      // 6. Connect WebSocket
      await this._collab.connect();

      this.setStatus('connected');
      this.emit('connected');
    } catch (err: unknown) {
      this.setStatus('error');
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Disconnect from the daemon.
   *
   * Closes WebSocket connection and cleans up resources.
   *
   * @example
   * ```typescript
   * client.disconnect();
   * console.log(client.isConnected); // false
   * ```
   */
  disconnect(): void {
    // Clean up collab client
    if (this._collab) {
      this._collab.disconnect();
      this._collab = null;
    }

    // Clear API client
    this._api = null;

    // Clear daemon info
    this.daemonInfo = null;

    this.setStatus('disconnected');
    this.emit('disconnected');
  }

  /**
   * Get information about the connected daemon.
   *
   * @returns Daemon info if connected, null otherwise
   *
   * @example
   * ```typescript
   * const info = client.getDaemonInfo();
   * if (info) {
   *   console.log(`Connected to daemon on port ${info.port}`);
   *   console.log(`Vault: ${info.vaultPath}`);
   * }
   * ```
   */
  getDaemonInfo(): DaemonInfo | null {
    return this.daemonInfo;
  }

  // ===========================================================================
  // Event Emitter Interface
  // ===========================================================================

  /**
   * Add an event listener.
   *
   * @param event - Event name
   * @param listener - Event handler function
   *
   * @example
   * ```typescript
   * client.on('connected', () => console.log('Connected!'));
   * client.on('error', (err) => console.error('Error:', err));
   * client.on('status-change', (status) => console.log('Status:', status));
   * ```
   */
  on<K extends keyof ScribeClientEvents>(
    event: K,
    listener: EventListener<ScribeClientEvents[K]>
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as EventListener<unknown[]>);
  }

  /**
   * Remove an event listener.
   *
   * @param event - Event name
   * @param listener - Event handler function to remove
   *
   * @example
   * ```typescript
   * const handler = () => console.log('Connected!');
   * client.on('connected', handler);
   * // Later...
   * client.off('connected', handler);
   * ```
   */
  off<K extends keyof ScribeClientEvents>(
    event: K,
    listener: EventListener<ScribeClientEvents[K]>
  ): void {
    this.listeners.get(event)?.delete(listener as EventListener<unknown[]>);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Resolve daemon info from discovery or manual config.
   */
  private async resolveDaemonInfo(): Promise<DaemonInfo> {
    // If port provided, use manual config
    if (this.options.port) {
      return createManualDaemonInfo({
        host: this.options.host ?? '127.0.0.1',
        port: this.options.port,
      });
    }

    // Otherwise, auto-discover
    if (this.options.autoDiscover) {
      const info = await discoverDaemon({
        timeout: this.options.connectTimeout,
      });

      if (!info) {
        throw new Error('No Scribe daemon found. Start one with: scribe daemon start');
      }

      return info;
    }

    throw new Error('No daemon connection configured. Provide a port or enable autoDiscover.');
  }

  /**
   * Verify connection to daemon is working.
   */
  private async verifyConnection(): Promise<void> {
    if (!this._api) {
      throw new Error('API client not initialized');
    }

    // Try a simple query to verify the connection
    // We use a small limit since we just want to verify connectivity
    try {
      await this._api.notes.list.query({ limit: 1 });
    } catch (err: unknown) {
      // Re-throw with a more helpful message
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('fetch failed') || message.includes('ECONNREFUSED')) {
        throw new Error(
          `Cannot connect to daemon at port ${this.daemonInfo?.port}. Is the daemon running?`
        );
      }
      throw err;
    }
  }

  /**
   * Set status and emit status-change event.
   */
  private setStatus(status: ClientStatus): void {
    if (this._status !== status) {
      this._status = status;
      this.emit('status-change', status);
    }
  }

  /**
   * Emit an event to listeners.
   */
  private emit<K extends keyof ScribeClientEvents>(event: K, ...args: ScribeClientEvents[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(...args);
        } catch {
          // Silently ignore listener errors to prevent cascade failures
        }
      }
    }
  }
}
