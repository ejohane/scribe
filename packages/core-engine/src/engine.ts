/**
 * Core Engine implementation.
 */

import { createAppState } from '@scribe/indexing';
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

  constructor(private options: CoreEngineOptions = {}) {
    // Initialize state
    this.state = createAppState();

    // Initialize search engine
    this.searchEngine = new SearchEngine();

    // Initialize JSON-RPC server
    this.rpcServer = new JSONRPCServer();

    // Register RPC handlers
    registerHandlers(this.rpcServer, this.state, this.searchEngine);
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

      this.fileWatcher.start((events) => {
        console.log(`[Core Engine] File changes:`, events);
        // TODO: Process file change events
      });
    }
  }

  /**
   * Stop the Core Engine.
   */
  async stop(): Promise<void> {
    if (this.fileWatcher) {
      await this.fileWatcher.stop();
    }
    await this.rpcServer.stop();
  }
}
