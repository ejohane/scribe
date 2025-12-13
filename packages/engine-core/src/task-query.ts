/**
 * TaskQuery: Chainable query builder for filtering and paginating tasks
 *
 * Extracted from TaskIndex to provide:
 * - Reusable query logic across different task collections
 * - Fluent/chainable API for building complex queries
 * - Support for combining multiple filters
 * - Cursor-based pagination
 *
 * @example
 * ```typescript
 * const query = new TaskQuery(tasks)
 *   .byStatus('open')
 *   .byNote(noteId)
 *   .sortBy('priority', 'asc')
 *   .limit(20);
 *
 * const { tasks, nextCursor } = query.execute();
 * ```
 */

import type { NoteId, Task, TaskFilter } from '@scribe/shared';

// ============================================================================
// TaskQuery Interface
// ============================================================================

/**
 * Query builder interface for filtering and paginating tasks
 */
export interface ITaskQuery {
  /** Filter by source note ID */
  byNote(noteId: NoteId): ITaskQuery;

  /** Filter by completion status */
  byStatus(status: 'open' | 'completed'): ITaskQuery;

  /** Filter by priority (exact match) */
  byPriority(priority: number): ITaskQuery;

  /** Filter by priority range (inclusive) */
  byPriorityRange(min: number, max: number): ITaskQuery;

  /** Filter by creation date (after timestamp, inclusive) */
  createdAfter(timestamp: number): ITaskQuery;

  /** Filter by creation date (before timestamp, inclusive) */
  createdBefore(timestamp: number): ITaskQuery;

  /** Filter by completion date (after timestamp, inclusive) */
  completedAfter(timestamp: number): ITaskQuery;

  /** Filter by completion date (before timestamp, inclusive) */
  completedBefore(timestamp: number): ITaskQuery;

  /** Set sort field and order */
  sortBy(field: 'priority' | 'createdAt', order?: 'asc' | 'desc'): ITaskQuery;

  /** Set maximum number of results */
  limit(n: number): ITaskQuery;

  /** Set offset for pagination (cursor-based preferred) */
  offset(n: number): ITaskQuery;

  /** Set cursor for pagination (preferred over offset) */
  cursor(cursor: string): ITaskQuery;

  /** Execute the query and return results with optional next cursor */
  execute(): TaskQueryResult;
}

/**
 * Result of executing a task query
 */
export interface TaskQueryResult {
  /** Filtered, sorted, and paginated tasks */
  tasks: Task[];
  /** Cursor for next page, undefined if no more results */
  nextCursor?: string;
  /** Total count before pagination (useful for UI) */
  totalCount: number;
}

// ============================================================================
// Internal Filter Types
// ============================================================================

interface QueryFilters {
  noteId?: NoteId;
  completed?: boolean;
  priority?: number;
  priorityMin?: number;
  priorityMax?: number;
  createdAfter?: number;
  createdBefore?: number;
  completedAfter?: number;
  completedBefore?: number;
}

interface QueryOptions {
  sortBy: 'priority' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  limit: number;
  offset: number;
  cursor?: string;
}

// ============================================================================
// TaskQuery Implementation
// ============================================================================

/**
 * Chainable query builder for filtering and paginating tasks.
 *
 * All filter methods return a new TaskQuery instance (immutable pattern),
 * allowing queries to be composed and reused.
 */
export class TaskQuery implements ITaskQuery {
  private readonly tasks: Iterable<Task>;
  private readonly filters: QueryFilters;
  private readonly options: QueryOptions;

  /**
   * Create a new TaskQuery from an iterable of tasks.
   *
   * @param tasks - Source tasks to query (can be Map.values(), array, etc.)
   * @param filters - Initial filter state (default: empty)
   * @param options - Initial options (default: sort by priority asc, limit 100)
   */
  constructor(
    tasks: Iterable<Task>,
    filters: QueryFilters = {},
    options: Partial<QueryOptions> = {}
  ) {
    this.tasks = tasks;
    this.filters = { ...filters };
    this.options = {
      sortBy: options.sortBy ?? 'priority',
      sortOrder: options.sortOrder ?? 'asc',
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
      cursor: options.cursor,
    };
  }

  /**
   * Create a new TaskQuery with updated filters/options (immutable).
   */
  private clone(
    filterUpdates: Partial<QueryFilters> = {},
    optionUpdates: Partial<QueryOptions> = {}
  ): TaskQuery {
    return new TaskQuery(
      this.tasks,
      { ...this.filters, ...filterUpdates },
      { ...this.options, ...optionUpdates }
    );
  }

  // ============================================================================
  // Filter Methods
  // ============================================================================

  byNote(noteId: NoteId): TaskQuery {
    return this.clone({ noteId });
  }

  byStatus(status: 'open' | 'completed'): TaskQuery {
    return this.clone({ completed: status === 'completed' });
  }

  byPriority(priority: number): TaskQuery {
    return this.clone({ priority });
  }

  byPriorityRange(min: number, max: number): TaskQuery {
    return this.clone({ priorityMin: min, priorityMax: max });
  }

  createdAfter(timestamp: number): TaskQuery {
    return this.clone({ createdAfter: timestamp });
  }

  createdBefore(timestamp: number): TaskQuery {
    return this.clone({ createdBefore: timestamp });
  }

  completedAfter(timestamp: number): TaskQuery {
    return this.clone({ completedAfter: timestamp });
  }

  completedBefore(timestamp: number): TaskQuery {
    return this.clone({ completedBefore: timestamp });
  }

  // ============================================================================
  // Sort/Pagination Methods
  // ============================================================================

  sortBy(field: 'priority' | 'createdAt', order: 'asc' | 'desc' = 'asc'): TaskQuery {
    return this.clone({}, { sortBy: field, sortOrder: order });
  }

  limit(n: number): TaskQuery {
    return this.clone({}, { limit: n });
  }

  offset(n: number): TaskQuery {
    return this.clone({}, { offset: n });
  }

  cursor(cursor: string): TaskQuery {
    return this.clone({}, { cursor });
  }

  // ============================================================================
  // Execution
  // ============================================================================

  execute(): TaskQueryResult {
    // Step 1: Collect and filter tasks
    let result = this.applyFilters();

    // Track total before pagination
    const totalCount = result.length;

    // Step 2: Sort
    result = this.applySorting(result);

    // Step 3: Paginate
    const { paginatedTasks, nextCursor } = this.applyPagination(result);

    return {
      tasks: paginatedTasks,
      nextCursor,
      totalCount,
    };
  }

  // ============================================================================
  // Internal Filter Logic
  // ============================================================================

  private applyFilters(): Task[] {
    const result: Task[] = [];

    for (const task of this.tasks) {
      if (!this.matchesFilters(task)) continue;
      result.push(task);
    }

    return result;
  }

  private matchesFilters(task: Task): boolean {
    const { filters } = this;

    // Filter by completion status
    if (filters.completed !== undefined && task.completed !== filters.completed) {
      return false;
    }

    // Filter by note ID
    if (filters.noteId !== undefined && task.noteId !== filters.noteId) {
      return false;
    }

    // Filter by exact priority
    if (filters.priority !== undefined && task.priority !== filters.priority) {
      return false;
    }

    // Filter by priority range
    if (filters.priorityMin !== undefined && task.priority < filters.priorityMin) {
      return false;
    }
    if (filters.priorityMax !== undefined && task.priority > filters.priorityMax) {
      return false;
    }

    // Filter by creation date
    if (filters.createdAfter !== undefined && task.createdAt < filters.createdAfter) {
      return false;
    }
    if (filters.createdBefore !== undefined && task.createdAt > filters.createdBefore) {
      return false;
    }

    // Filter by completion date (only for completed tasks)
    if (filters.completedAfter !== undefined) {
      if (
        !task.completed ||
        task.completedAt === undefined ||
        task.completedAt < filters.completedAfter
      ) {
        return false;
      }
    }
    if (filters.completedBefore !== undefined) {
      if (
        !task.completed ||
        task.completedAt === undefined ||
        task.completedAt > filters.completedBefore
      ) {
        return false;
      }
    }

    return true;
  }

  // ============================================================================
  // Internal Sorting Logic
  // ============================================================================

  private applySorting(tasks: Task[]): Task[] {
    const { sortBy, sortOrder } = this.options;
    const multiplier = sortOrder === 'asc' ? 1 : -1;

    return tasks.sort((a, b) => {
      if (sortBy === 'priority') {
        // Primary: completed tasks sort after incomplete
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        // Secondary: priority
        const priorityDiff = (a.priority - b.priority) * multiplier;
        if (priorityDiff !== 0) return priorityDiff;
        // Tertiary: createdAt (newest first within same priority)
        return (b.createdAt - a.createdAt) * multiplier;
      } else {
        // sortBy === 'createdAt'
        return (a.createdAt - b.createdAt) * multiplier;
      }
    });
  }

  // ============================================================================
  // Internal Pagination Logic
  // ============================================================================

  private applyPagination(tasks: Task[]): { paginatedTasks: Task[]; nextCursor?: string } {
    let startIndex = this.options.offset;

    // Cursor takes precedence over offset
    if (this.options.cursor) {
      const cursorIndex = decodeCursor(this.options.cursor);
      if (cursorIndex !== null) {
        startIndex = cursorIndex;
      }
    }

    const endIndex = startIndex + this.options.limit;
    const paginatedTasks = tasks.slice(startIndex, endIndex);

    // Determine if there are more results
    const hasMore = endIndex < tasks.length;
    const nextCursor = hasMore ? encodeCursor(endIndex) : undefined;

    return { paginatedTasks, nextCursor };
  }
}

// ============================================================================
// Cursor Encoding/Decoding (exported for TaskIndex compatibility)
// ============================================================================

/**
 * Encode a pagination cursor from an index.
 */
export function encodeCursor(index: number): string {
  return Buffer.from(String(index)).toString('base64');
}

/**
 * Decode a pagination cursor back to an index.
 * Returns null if the cursor is invalid.
 */
export function decodeCursor(cursor: string): number | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const index = parseInt(decoded, 10);
    return isNaN(index) ? null : index;
  } catch {
    return null;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a TaskQuery from an iterable of tasks.
 *
 * This is a convenience function for creating queries without
 * directly instantiating TaskQuery.
 *
 * @example
 * ```typescript
 * const result = createTaskQuery(tasks.values())
 *   .byStatus('open')
 *   .limit(10)
 *   .execute();
 * ```
 */
export function createTaskQuery(tasks: Iterable<Task>): TaskQuery {
  return new TaskQuery(tasks);
}

// ============================================================================
// TaskFilter Adapter
// ============================================================================

/**
 * Create a TaskQuery from a TaskFilter object.
 *
 * This provides backward compatibility with the existing TaskFilter-based API.
 *
 * @param tasks - Source tasks to query
 * @param filter - Optional TaskFilter object
 * @returns Configured TaskQuery ready for execution
 */
export function fromTaskFilter(tasks: Iterable<Task>, filter?: TaskFilter): TaskQuery {
  let query = new TaskQuery(tasks);

  if (!filter) {
    return query;
  }

  // Apply filters
  if (filter.completed !== undefined) {
    query = query.byStatus(filter.completed ? 'completed' : 'open');
  }

  if (filter.noteId !== undefined) {
    query = query.byNote(filter.noteId);
  }

  if (filter.createdAfter !== undefined) {
    query = query.createdAfter(filter.createdAfter);
  }

  if (filter.createdBefore !== undefined) {
    query = query.createdBefore(filter.createdBefore);
  }

  if (filter.completedAfter !== undefined) {
    query = query.completedAfter(filter.completedAfter);
  }

  if (filter.completedBefore !== undefined) {
    query = query.completedBefore(filter.completedBefore);
  }

  // Apply sorting
  if (filter.sortBy !== undefined || filter.sortOrder !== undefined) {
    query = query.sortBy(filter.sortBy ?? 'priority', filter.sortOrder ?? 'asc');
  }

  // Apply pagination
  if (filter.limit !== undefined) {
    query = query.limit(filter.limit);
  }

  if (filter.cursor !== undefined) {
    query = query.cursor(filter.cursor);
  }

  return query;
}
