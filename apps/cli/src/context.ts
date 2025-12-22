/**
 * CLI Context Initialization
 *
 * Provides lazy-loaded engines for vault operations. Engines are only
 * initialized when first accessed, improving cold start performance.
 * Commands that don't need all engines will start faster.
 *
 * Performance Optimization:
 * - `notes list` doesn't need SearchEngine or GraphEngine
 * - `search` doesn't need GraphEngine or TaskIndex
 * - Most commands don't need all engines
 *
 * When --debug is set, timing information is output to stderr.
 */

import path from 'path';
import { createVaultPath } from '@scribe/shared';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import { TaskIndex } from '@scribe/engine-core/node';
import { resolveVaultPath, validateVaultPath } from './vault-resolver.js';

/**
 * Global options available to all CLI commands
 */
export interface GlobalOptions {
  /** Override vault path via --vault flag */
  vault?: string;
  /** Output format: json or text */
  format: 'json' | 'text';
  /** Include raw Lexical JSON in content responses */
  includeRaw?: boolean;
  /** Suppress non-essential output */
  quiet?: boolean;
  /** Show detailed operation info (to stderr) */
  verbose?: boolean;
  /** Show debug information including timing (to stderr) */
  debug?: boolean;
}

/**
 * Output timing information to stderr when --debug is enabled
 */
function logTiming(options: GlobalOptions, label: string, startTime: number): void {
  if (options.debug) {
    const elapsed = Date.now() - startTime;
    console.error(`[timing] ${label}: ${elapsed}ms`);
  }
}

/**
 * CLI Context with lazy-loaded engines
 *
 * Engines are initialized on first access, not at construction time.
 * This improves cold start performance for commands that don't need all engines.
 *
 * Usage patterns:
 * - `notes list` - vault only
 * - `search` - vault + searchEngine
 * - `graph backlinks` - vault + graphEngine
 * - `tasks list` - vault + taskIndex
 * - `vault info` - vault + graphEngine + taskIndex
 */
export class LazyContext {
  private _vault?: FileSystemVault;
  private _graphEngine?: GraphEngine;
  private _searchEngine?: SearchEngine;
  private _taskIndex?: TaskIndex;
  private _vaultLoaded = false;
  private _taskIndexLoaded = false;

  constructor(
    public readonly vaultPath: string,
    public readonly options: GlobalOptions
  ) {}

  /**
   * Get the FileSystemVault instance, loading notes on first access.
   * This is a synchronous getter that returns the already-loaded vault.
   * Call ensureVaultLoaded() first in async contexts.
   */
  get vault(): FileSystemVault {
    if (!this._vault) {
      const startTime = Date.now();
      this._vault = new FileSystemVault(createVaultPath(this.vaultPath));
      logTiming(this.options, 'vault instantiate', startTime);
    }
    return this._vault;
  }

  /**
   * Ensure vault is loaded (async operation).
   * Must be called before accessing vault data.
   */
  async ensureVaultLoaded(): Promise<void> {
    if (this._vaultLoaded) return;

    const startTime = Date.now();
    await this.vault.load();
    this._vaultLoaded = true;
    logTiming(this.options, 'vault load', startTime);
  }

  /**
   * Get the GraphEngine, building it from notes on first access.
   * Requires vault to be loaded first.
   */
  get graphEngine(): GraphEngine {
    if (!this._graphEngine) {
      if (!this._vaultLoaded) {
        throw new Error(
          'Vault must be loaded before accessing graphEngine. Call ensureVaultLoaded() first.'
        );
      }

      const startTime = Date.now();
      this._graphEngine = new GraphEngine();
      const notes = this._vault!.list();
      for (const note of notes) {
        this._graphEngine.addNote(note);
      }
      logTiming(this.options, 'graph engine build', startTime);
    }
    return this._graphEngine;
  }

  /**
   * Get the SearchEngine, indexing all notes on first access.
   * Requires vault to be loaded first.
   */
  get searchEngine(): SearchEngine {
    if (!this._searchEngine) {
      if (!this._vaultLoaded) {
        throw new Error(
          'Vault must be loaded before accessing searchEngine. Call ensureVaultLoaded() first.'
        );
      }

      const startTime = Date.now();
      this._searchEngine = new SearchEngine();
      const notes = this._vault!.list();
      for (const note of notes) {
        this._searchEngine.indexNote(note);
      }
      logTiming(this.options, 'search engine index', startTime);
    }
    return this._searchEngine;
  }

  /**
   * Get the TaskIndex instance.
   * This is a synchronous getter; call ensureTaskIndexLoaded() for async loading.
   */
  get taskIndex(): TaskIndex {
    if (!this._taskIndex) {
      const startTime = Date.now();
      const derivedPath = path.join(this.vaultPath, 'derived');
      this._taskIndex = new TaskIndex(derivedPath);
      logTiming(this.options, 'task index instantiate', startTime);
    }
    return this._taskIndex;
  }

  /**
   * Ensure task index is loaded (async operation).
   * Must be called before accessing task data.
   */
  async ensureTaskIndexLoaded(): Promise<void> {
    if (this._taskIndexLoaded) return;

    const startTime = Date.now();
    await this.taskIndex.load();
    this._taskIndexLoaded = true;
    logTiming(this.options, 'task index load', startTime);
  }

  /**
   * Check if vault has been loaded
   */
  get isVaultLoaded(): boolean {
    return this._vaultLoaded;
  }

  /**
   * Check if task index has been loaded
   */
  get isTaskIndexLoaded(): boolean {
    return this._taskIndexLoaded;
  }
}

/**
 * CLI Context interface for backwards compatibility.
 * The LazyContext class implements this interface.
 */
export interface CLIContext {
  /** FileSystemVault instance for note operations */
  vault: FileSystemVault;
  /** Resolved absolute path to the vault directory */
  vaultPath: string;
  /** GraphEngine for link relationship queries */
  graphEngine: GraphEngine;
  /** SearchEngine for full-text search */
  searchEngine: SearchEngine;
  /** TaskIndex for task queries and updates */
  taskIndex: TaskIndex;
  /** Global CLI options */
  options: GlobalOptions;
}

/**
 * Initialize the CLI context with lazy-loaded engines.
 *
 * Unlike the previous implementation, this only loads the vault by default.
 * GraphEngine, SearchEngine, and TaskIndex are loaded lazily when first accessed.
 *
 * This function:
 * 1. Resolves and validates the vault path
 * 2. Creates the lazy context
 * 3. Loads the vault notes (required for most commands)
 * 4. Engines are loaded on-demand when accessed
 *
 * @param options - Global CLI options including vault path override
 * @returns LazyContext that implements CLIContext interface
 * @throws VaultNotFoundError if vault path doesn't exist
 */
export async function initializeContext(options: GlobalOptions): Promise<LazyContext> {
  const totalStartTime = Date.now();
  const { path: vaultPath } = resolveVaultPath(options.vault);
  validateVaultPath(vaultPath);

  const ctx = new LazyContext(vaultPath, options);

  // Load vault - required for most commands
  await ctx.ensureVaultLoaded();

  logTiming(options, 'context initialization total', totalStartTime);

  return ctx;
}

/**
 * Initialize a minimal context for commands that only need TaskIndex.
 * Skips vault loading entirely for better performance.
 *
 * @param options - Global CLI options including vault path override
 * @returns LazyContext with only task index available
 */
export async function initializeTaskOnlyContext(options: GlobalOptions): Promise<LazyContext> {
  const totalStartTime = Date.now();
  const { path: vaultPath } = resolveVaultPath(options.vault);
  validateVaultPath(vaultPath);

  const ctx = new LazyContext(vaultPath, options);

  // Load task index only
  await ctx.ensureTaskIndexLoaded();

  logTiming(options, 'task-only context initialization total', totalStartTime);

  return ctx;
}

/**
 * Initialize a full context with all engines pre-loaded.
 * Use this when you know you'll need multiple engines.
 *
 * @param options - Global CLI options including vault path override
 * @returns LazyContext with all engines loaded
 */
export async function initializeFullContext(options: GlobalOptions): Promise<LazyContext> {
  const totalStartTime = Date.now();
  const { path: vaultPath } = resolveVaultPath(options.vault);
  validateVaultPath(vaultPath);

  const ctx = new LazyContext(vaultPath, options);

  // Load everything in parallel where possible
  await ctx.ensureVaultLoaded();
  await ctx.ensureTaskIndexLoaded();

  // Force initialization of graph and search engines by accessing the lazy getters.
  // This pattern intentionally uses property access without assignment to trigger
  // lazy initialization during startup rather than on first command use.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Intentional: triggers lazy getter initialization
  ctx.graphEngine;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Intentional: triggers lazy getter initialization
  ctx.searchEngine;

  logTiming(options, 'full context initialization total', totalStartTime);

  return ctx;
}

/**
 * Cleanup function to flush any pending changes.
 *
 * Call this before exiting to ensure task index changes are persisted.
 *
 * @param context - The CLI context to cleanup
 */
export async function cleanupContext(context: LazyContext | CLIContext): Promise<void> {
  // Only flush if task index was loaded
  if (context instanceof LazyContext) {
    if (context.isTaskIndexLoaded) {
      await context.taskIndex.flush();
    }
  } else {
    // Legacy CLIContext - always has taskIndex
    await context.taskIndex.flush();
  }
}
