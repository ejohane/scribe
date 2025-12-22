/**
 * TaskPersistence: Interface and implementations for task storage
 *
 * This module separates persistence concerns from the TaskIndex,
 * enabling different storage backends (JSONL, SQLite, etc.) and
 * easier testing through dependency injection.
 */

import { join, dirname } from 'path';
import { promises as fs } from 'fs';
import type { Task } from '@scribe/shared';
import { logger as rootLogger } from '@scribe/shared';

/** Module-level logger for JsonlTaskPersistence */
const logger = rootLogger.child('JsonlTaskPersistence');

/**
 * Interface for task persistence operations
 *
 * Implementations handle loading, saving, and atomic writes of task data.
 * The interface is designed to be storage-agnostic, allowing different
 * backends to be swapped without changing the TaskIndex logic.
 */
export interface TaskPersistence {
  /**
   * Load all tasks from storage.
   *
   * @returns Array of tasks, empty array if storage doesn't exist yet
   * @throws If storage exists but cannot be read (permissions, corruption)
   */
  load(): Promise<Task[]>;

  /**
   * Save all tasks to storage atomically.
   *
   * Implementations should ensure atomic writes (e.g., temp file + rename)
   * to prevent data loss on crashes or power failures.
   *
   * @param tasks - Complete array of tasks to persist
   */
  save(tasks: Task[]): Promise<void>;

  /**
   * Append a single task to storage.
   *
   * This is an optimization for append-only workloads. Implementations
   * may choose to batch appends or fall back to full rewrites.
   *
   * @param task - Task to append
   */
  appendLine(task: Task): Promise<void>;
}

/**
 * JSONL-based task persistence implementation
 *
 * Features:
 * - Atomic writes using temp file + rename
 * - Line-by-line JSON for crash resilience (partial reads possible)
 * - Automatic directory creation
 * - Graceful handling of missing files (fresh start)
 * - Malformed line skipping with console warnings
 */
export class JsonlTaskPersistence implements TaskPersistence {
  private readonly filePath: string;

  /**
   * Create a new JsonlTaskPersistence instance.
   *
   * @param filePath - Full path to the JSONL file (e.g., /vault/.derived/tasks.jsonl)
   */
  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Create a JsonlTaskPersistence from a derived data directory path.
   *
   * @param derivedPath - Path to the derived data directory
   * @returns New JsonlTaskPersistence instance
   */
  static fromDerivedPath(derivedPath: string): JsonlTaskPersistence {
    return new JsonlTaskPersistence(join(derivedPath, 'tasks.jsonl'));
  }

  /**
   * Load tasks from JSONL file.
   *
   * Silently handles missing file (returns empty array for fresh start).
   * Skips malformed lines with console warnings.
   */
  async load(): Promise<Task[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const tasks: Task[] = [];

      for (const line of lines) {
        try {
          const task = JSON.parse(line) as Task;
          tasks.push(task);
        } catch {
          // Skip malformed lines
          logger.warn('Skipping malformed line', { line });
        }
      }

      return tasks;
    } catch (error) {
      // File doesn't exist yet - fresh start
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Save tasks to JSONL file atomically.
   *
   * Uses temp file + rename pattern for atomic writes.
   * Creates parent directories if they don't exist.
   */
  async save(tasks: Task[]): Promise<void> {
    const tempPath = this.filePath + '.tmp';
    const lines = tasks.map((task) => JSON.stringify(task)).join('\n');

    // Ensure directory exists
    await fs.mkdir(dirname(this.filePath), { recursive: true });

    // Write to temp file
    await fs.writeFile(tempPath, lines + '\n', 'utf-8');

    // Atomic rename
    await fs.rename(tempPath, this.filePath);
  }

  /**
   * Append a single task line to the JSONL file.
   *
   * Note: For most use cases, batching saves with save() is preferred.
   * This method is provided for streaming/incremental persistence needs.
   */
  async appendLine(task: Task): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(dirname(this.filePath), { recursive: true });

    // Append to file (creates if doesn't exist)
    await fs.appendFile(this.filePath, JSON.stringify(task) + '\n', 'utf-8');
  }

  /**
   * Get the file path for this persistence instance.
   * Useful for testing and diagnostics.
   */
  getFilePath(): string {
    return this.filePath;
  }
}

/**
 * In-memory task persistence for testing
 *
 * Provides a simple in-memory implementation that can be used in tests
 * to avoid file system operations.
 */
export class InMemoryTaskPersistence implements TaskPersistence {
  private tasks: Task[] = [];
  private loadCount = 0;
  private saveCount = 0;
  private appendCount = 0;

  async load(): Promise<Task[]> {
    this.loadCount++;
    return [...this.tasks];
  }

  async save(tasks: Task[]): Promise<void> {
    this.saveCount++;
    this.tasks = [...tasks];
  }

  async appendLine(task: Task): Promise<void> {
    this.appendCount++;
    this.tasks.push(task);
  }

  /**
   * Get current tasks (for test assertions)
   */
  getTasks(): Task[] {
    return [...this.tasks];
  }

  /**
   * Set tasks directly (for test setup)
   */
  setTasks(tasks: Task[]): void {
    this.tasks = [...tasks];
  }

  /**
   * Get operation counts (for test assertions)
   */
  getStats(): { loadCount: number; saveCount: number; appendCount: number } {
    return { loadCount: this.loadCount, saveCount: this.saveCount, appendCount: this.appendCount };
  }

  /**
   * Reset state (for test cleanup)
   */
  reset(): void {
    this.tasks = [];
    this.loadCount = 0;
    this.saveCount = 0;
    this.appendCount = 0;
  }
}
