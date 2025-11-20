/**
 * @scribe/file-watcher
 *
 * File system watcher with debouncing for vault monitoring.
 */

import { watch, FSWatcher } from 'chokidar';
import { debounce } from '@scribe/utils';

/**
 * File change event type.
 */
export type FileChangeType = 'add' | 'change' | 'unlink';

/**
 * File change event.
 */
export interface FileChangeEvent {
  type: FileChangeType;
  path: string;
}

/**
 * File watcher options.
 */
export interface FileWatcherOptions {
  /**
   * Directory to watch.
   */
  directory: string;

  /**
   * Debounce delay in milliseconds.
   */
  debounceDelay?: number;

  /**
   * File patterns to ignore.
   */
  ignored?: string[];

  /**
   * Whether to watch for initial files on startup.
   */
  ignoreInitial?: boolean;
}

/**
 * File watcher for vault monitoring.
 */
export class FileWatcher {
  private watcher?: FSWatcher;
  private onChange?: (events: FileChangeEvent[]) => void;
  private pendingEvents: FileChangeEvent[] = [];
  private flushEvents: () => void;

  constructor(private options: FileWatcherOptions) {
    // Create debounced flush function
    this.flushEvents = debounce(() => {
      if (this.pendingEvents.length > 0 && this.onChange) {
        const events = [...this.pendingEvents];
        this.pendingEvents = [];
        this.onChange(events);
      }
    }, options.debounceDelay || 300);
  }

  /**
   * Start watching for file changes.
   */
  start(onChange: (events: FileChangeEvent[]) => void): void {
    this.onChange = onChange;

    this.watcher = watch(this.options.directory, {
      ignored: this.options.ignored || ['**/node_modules/**', '**/.git/**'],
      persistent: true,
      ignoreInitial: this.options.ignoreInitial !== false,
    });

    this.watcher.on('add', (path) => this.handleEvent({ type: 'add', path }));
    this.watcher.on('change', (path) => this.handleEvent({ type: 'change', path }));
    this.watcher.on('unlink', (path) => this.handleEvent({ type: 'unlink', path }));
  }

  /**
   * Stop watching for file changes.
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
  }

  /**
   * Handle a file change event.
   */
  private handleEvent(event: FileChangeEvent): void {
    this.pendingEvents.push(event);
    this.flushEvents();
  }
}
