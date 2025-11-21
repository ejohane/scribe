/**
 * Core Engine implementation.
 */

import {
  createAppState,
  addStateChangeListener,
  getIndexingReadiness,
  handleVaultChanges,
  publishStateSnapshot,
} from '@scribe/indexing';
import type { StateChangeEvent, IndexingReadiness } from '@scribe/indexing';
import { SearchEngine } from '@scribe/search';
import { FileWatcher } from '@scribe/file-watcher';
import type { AppState } from '@scribe/domain-model';
import { JSONRPCServer } from './rpc/server.js';
import { registerHandlers } from './rpc/handlers.js';

/**
 * Core Engine options.
 */
export interface CoreEngineOptions {
  /**
   * Vault directory to watch.
   */
  vaultPath?: string;
}

/**
 * Core Engine - coordinates all subsystems.
 */
export class CoreEngine {
  private state: AppState;
  private searchEngine: SearchEngine;
  private fileWatcher?: FileWatcher;
  private rpcServer: JSONRPCServer;
  private stateChangeUnsubscribe?: () => void;

  constructor(private options: CoreEngineOptions = {}) {
    // Initialize state
    this.state = createAppState();

    // Initialize search engine
    this.searchEngine = new SearchEngine();

    // Initialize JSON-RPC server
    this.rpcServer = new JSONRPCServer();

    // Register RPC handlers
    registerHandlers(this.rpcServer, this.state, this.searchEngine);

    // Subscribe to state change events
    this.stateChangeUnsubscribe = addStateChangeListener((event) => {
      this.onStateChange(event);
    });
  }

  /**
   * Start the Core Engine.
   */
  async start(): Promise<void> {
    // Start JSON-RPC server
    await this.rpcServer.start();

    // Start file watcher if vault path is provided
    if (this.options.vaultPath) {
      this.fileWatcher = new FileWatcher({
        directory: this.options.vaultPath,
        debounceDelay: 300,
      });

      this.fileWatcher.start(async (events) => {
        console.log(`[Core Engine] File changes:`, events);

        try {
          // Process file change events using transactional updates
          await handleVaultChanges(this.state, events);
        } catch (error) {
          console.error('[Core Engine] Error processing vault changes:', error);
        }
      });
    }

    // Publish initial state snapshot
    publishStateSnapshot(this.state);
  }

  /**
   * Stop the Core Engine.
   */
  async stop(): Promise<void> {
    // Unsubscribe from state changes
    if (this.stateChangeUnsubscribe) {
      this.stateChangeUnsubscribe();
    }

    if (this.fileWatcher) {
      await this.fileWatcher.stop();
    }
    await this.rpcServer.stop();
  }

  /**
   * Get the current indexing readiness state.
   *
   * @returns Indexing readiness information
   */
  getReadiness(): IndexingReadiness {
    return getIndexingReadiness();
  }

  /**
   * Get the current application state (read-only).
   *
   * @returns The current AppState
   */
  getState(): Readonly<AppState> {
    return this.state;
  }

  /**
   * Handle state change events.
   *
   * @param event - The state change event
   */
  private onStateChange(event: StateChangeEvent): void {
    console.log(`[Core Engine] State changed: ${event.type}`, event.data);

    // TODO: Notify connected clients via RPC about state changes
    // This could be implemented as a JSON-RPC notification mechanism
  }
}
