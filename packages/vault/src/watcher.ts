/**
 * Vault watcher that integrates file watching with vault discovery.
 */

import type { NoteId, PersonId, FilePath } from '@scribe/domain-model';
import { FileWatcher, type FileChangeEvent } from '@scribe/file-watcher';
import type { Vault } from './vault.js';

/**
 * Normalized vault change event.
 */
export interface VaultChangeEvent {
  type: 'add' | 'change' | 'remove' | 'rename';
  /**
   * Entity ID (NoteId or PersonId).
   */
  id: NoteId | PersonId;
  /**
   * Relative file path.
   */
  path: FilePath;
  /**
   * Old ID for rename events.
   */
  oldId?: NoteId | PersonId;
  /**
   * Old path for rename events.
   */
  oldPath?: FilePath;
  /**
   * Whether this is a person entity.
   */
  isPerson: boolean;
}

/**
 * Options for vault watcher.
 */
export interface VaultWatcherOptions {
  /**
   * Vault instance for path normalization.
   */
  vault: Vault;
  /**
   * Debounce delay in milliseconds.
   */
  debounceDelay?: number;
}

/**
 * Vault watcher that emits normalized change events.
 */
export class VaultWatcher {
  private fileWatcher: FileWatcher;
  private vault: Vault;

  constructor(options: VaultWatcherOptions) {
    this.vault = options.vault;
    this.fileWatcher = new FileWatcher({
      directory: this.vault.getVaultPath(),
      debounceDelay: options.debounceDelay,
      ignored: ['**/node_modules/**', '**/.git/**', '**/.obsidian/**'],
      ignoreInitial: true,
    });
  }

  /**
   * Start watching for vault changes.
   */
  start(onChange: (events: VaultChangeEvent[]) => void): void {
    this.fileWatcher.start((fileEvents) => {
      const vaultEvents = this.normalizeEvents(fileEvents);
      if (vaultEvents.length > 0) {
        onChange(vaultEvents);
      }
    });
  }

  /**
   * Stop watching for vault changes.
   */
  async stop(): Promise<void> {
    await this.fileWatcher.stop();
  }

  /**
   * Normalize file change events to vault change events.
   */
  private normalizeEvents(fileEvents: FileChangeEvent[]): VaultChangeEvent[] {
    const vaultEvents: VaultChangeEvent[] = [];

    for (const event of fileEvents) {
      // Only process .md files
      if (!event.path.endsWith('.md')) {
        continue;
      }

      const relativePath = this.vault.absoluteToRelative(event.path);
      const id = this.vault.pathToId(relativePath);
      const isPerson = this.vault.isPeoplePath(relativePath);

      if (event.type === 'add') {
        vaultEvents.push({
          type: 'add',
          id,
          path: relativePath,
          isPerson,
        });
      } else if (event.type === 'change') {
        vaultEvents.push({
          type: 'change',
          id,
          path: relativePath,
          isPerson,
        });
      } else if (event.type === 'unlink') {
        vaultEvents.push({
          type: 'remove',
          id,
          path: relativePath,
          isPerson,
        });
      } else if (event.type === 'rename' && event.oldPath) {
        const oldRelativePath = this.vault.absoluteToRelative(event.oldPath);
        const oldId = this.vault.pathToId(oldRelativePath);

        vaultEvents.push({
          type: 'rename',
          id,
          path: relativePath,
          oldId,
          oldPath: oldRelativePath,
          isPerson,
        });
      }
    }

    return vaultEvents;
  }
}
