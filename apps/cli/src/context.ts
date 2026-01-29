/**
 * CLI Context Initialization
 *
 * Provides lazy-loaded engines for vault operations. Engines are only
 * initialized when first accessed, improving cold start performance.
 * Commands that don't need all engines will start faster.
 *
 * Performance Optimization:
 * - `notes list` doesn't need SearchEngine or GraphEngine
 * - `search` doesn't need GraphEngine
 * - Most commands don't need all engines
 *
 * When --debug is set, timing information is output to stderr.
 */

import { createVaultPath } from '@scribe/shared';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
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
 * - `vault info` - vault + graphEngine
 */
export class LazyContext {
  private _vault?: FileSystemVault;
  private _graphEngine?: GraphEngine;
  private _searchEngine?: SearchEngine;
  private _vaultLoaded = false;

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
   * Check if vault has been loaded
   */
  get isVaultLoaded(): boolean {
    return this._vaultLoaded;
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
  /** Global CLI options */
  options: GlobalOptions;
}

/**
 * Initialize the CLI context with lazy-loaded engines.
 *
 * Unlike the previous implementation, this only loads the vault by default.
 * GraphEngine and SearchEngine are loaded lazily when first accessed.
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
  // Force initialization of graph and search engines by accessing the lazy getters.
  // This pattern intentionally uses property access without assignment to trigger
  // lazy initialization during startup rather than on first command use.
  ctx.graphEngine;
  ctx.searchEngine;

  logTiming(options, 'full context initialization total', totalStartTime);

  return ctx;
}

/**
 * Cleanup function to flush any pending changes.
 *
 * @param context - The CLI context to cleanup
 */
export async function cleanupContext(_context: LazyContext | CLIContext): Promise<void> {}
