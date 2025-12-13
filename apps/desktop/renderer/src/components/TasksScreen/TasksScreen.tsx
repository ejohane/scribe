/**
 * TasksScreen component
 *
 * Full-screen view for task management with filtering, pagination, and drag-and-drop reordering.
 *
 * Features:
 * - Filter by sort order, status (all/active/completed), and date range
 * - Cursor-based pagination with limit of 100
 * - Full task text display (no truncation)
 * - Shows date on each task
 * - DraggableTaskList for reordering
 * - Live task change subscription
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Task, NoteId, TaskFilter, TaskChangeEvent } from '@scribe/shared';
import { CheckCircleIcon } from '@scribe/design-system';
import { DraggableTaskList } from '../Tasks/DraggableTaskList';
import { FilterBar, type SortOption, type StatusOption, type DateRangeOption } from './FilterBar';
import * as styles from './TasksScreen.css';

export interface TasksScreenProps {
  /**
   * Callback when navigating to a note (for task click)
   */
  onNavigate?: (noteId: NoteId) => void;
}

/**
 * Get date range bounds for filtering
 */
function getDateRangeBounds(range: DateRangeOption): { after?: number; before?: number } {
  if (range === 'all') {
    return {};
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case 'today':
      return {
        after: today.getTime(),
        before: now.getTime(),
      };
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return {
        after: weekAgo.getTime(),
        before: now.getTime(),
      };
    }
    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return {
        after: monthAgo.getTime(),
        before: now.getTime(),
      };
    }
    default:
      return {};
  }
}

/**
 * Build TaskFilter from current filter state
 */
function buildTaskFilter(
  sort: SortOption,
  status: StatusOption,
  dateRange: DateRangeOption,
  cursor?: string
): TaskFilter {
  const filter: TaskFilter = {
    limit: 100,
    cursor,
  };

  // Sort
  switch (sort) {
    case 'priority':
      filter.sortBy = 'priority';
      filter.sortOrder = 'asc';
      break;
    case 'createdAt-desc':
      filter.sortBy = 'createdAt';
      filter.sortOrder = 'desc';
      break;
    case 'createdAt-asc':
      filter.sortBy = 'createdAt';
      filter.sortOrder = 'asc';
      break;
  }

  // Status
  switch (status) {
    case 'active':
      filter.completed = false;
      break;
    case 'completed':
      filter.completed = true;
      break;
    // 'all' - no filter
  }

  // Date range
  const { after, before } = getDateRangeBounds(dateRange);
  if (after !== undefined) {
    filter.createdAfter = after;
  }
  if (before !== undefined) {
    filter.createdBefore = before;
  }

  return filter;
}

/**
 * Empty state component
 */
function EmptyState({ status }: { status: StatusOption }) {
  let message: string;
  let description: string;

  switch (status) {
    case 'active':
      message = 'No active tasks';
      description =
        'All your tasks are complete! Create new tasks by adding checkboxes to your notes.';
      break;
    case 'completed':
      message = 'No completed tasks';
      description = "You haven't completed any tasks yet. Check off tasks to see them here.";
      break;
    default:
      message = 'No tasks';
      description = 'Create tasks by adding checkboxes in your notes using - [ ] syntax.';
  }

  return (
    <div className={styles.emptyState}>
      <CheckCircleIcon className={styles.emptyIcon} strokeWidth={1.5} />
      <div className={styles.emptyTitle}>{message}</div>
      <div className={styles.emptyDescription}>{description}</div>
    </div>
  );
}

/**
 * Loading state component
 */
function LoadingState() {
  return (
    <div className={styles.loadingState} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.loadingSpinner} />
      <div className={styles.loadingText}>Loading tasks...</div>
    </div>
  );
}

export function TasksScreen({ onNavigate }: TasksScreenProps) {
  // Filter state
  const [sort, setSort] = useState<SortOption>('priority');
  const [status, setStatus] = useState<StatusOption>('all');
  const [dateRange, setDateRange] = useState<DateRangeOption>('all');

  // Task data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();

  // Track current filter to compare in subscription handler
  const filterRef = useRef({ sort, status, dateRange });
  filterRef.current = { sort, status, dateRange };

  // Build the current filter
  const currentFilter = useMemo(
    () => buildTaskFilter(sort, status, dateRange),
    [sort, status, dateRange]
  );

  // Load initial tasks
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const filter = buildTaskFilter(
        filterRef.current.sort,
        filterRef.current.status,
        filterRef.current.dateRange
      );
      const { tasks: loadedTasks, nextCursor: cursor } = await window.scribe.tasks.list(filter);
      setTasks(loadedTasks);
      setNextCursor(cursor);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load more tasks (pagination)
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const filter = buildTaskFilter(
        filterRef.current.sort,
        filterRef.current.status,
        filterRef.current.dateRange,
        nextCursor
      );
      const { tasks: moreTasks, nextCursor: cursor } = await window.scribe.tasks.list(filter);
      setTasks((prev) => [...prev, ...moreTasks]);
      setNextCursor(cursor);
    } catch (error) {
      console.error('Failed to load more tasks:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  // Load tasks on mount and filter change
  useEffect(() => {
    loadTasks();
  }, [loadTasks, currentFilter]);

  // Subscribe to task changes
  useEffect(() => {
    const handleTaskChanges = (events: TaskChangeEvent[]) => {
      for (const event of events) {
        switch (event.type) {
          case 'added':
            // Check if task matches current filters before adding
            if (matchesCurrentFilter(event.task, filterRef.current)) {
              setTasks((prev) => {
                const newTasks = [...prev, event.task];
                return sortTasks(newTasks, filterRef.current.sort);
              });
            }
            break;

          case 'updated':
            setTasks((prev) => {
              const matches = matchesCurrentFilter(event.task, filterRef.current);
              const exists = prev.some((t) => t.id === event.task.id);

              if (matches && exists) {
                // Update in place
                return sortTasks(
                  prev.map((t) => (t.id === event.task.id ? event.task : t)),
                  filterRef.current.sort
                );
              } else if (matches && !exists) {
                // Add to list
                return sortTasks([...prev, event.task], filterRef.current.sort);
              } else if (!matches && exists) {
                // Remove from list
                return prev.filter((t) => t.id !== event.task.id);
              }
              return prev;
            });
            break;

          case 'removed':
            setTasks((prev) => prev.filter((t) => t.id !== event.taskId));
            break;

          case 'reordered':
            // Refetch to get correct order after reorder
            loadTasks();
            break;
        }
      }
    };

    const unsubscribe = window.scribe.tasks.onChange(handleTaskChanges);

    return () => {
      unsubscribe();
    };
  }, [loadTasks]);

  // Handle task toggle
  const handleToggle = useCallback(async (taskId: string) => {
    try {
      await window.scribe.tasks.toggle(taskId);
      // Note: UI update handled by onChange subscription
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  }, []);

  // Handle task navigation
  const handleNavigate = useCallback(
    (task: Task) => {
      if (onNavigate) {
        onNavigate(task.noteId);
      }
    },
    [onNavigate]
  );

  // Handle task reorder
  const handleReorder = useCallback(async (taskIds: string[]) => {
    try {
      await window.scribe.tasks.reorder(taskIds);
      // Note: UI update handled by onChange subscription
    } catch (error) {
      console.error('Failed to reorder tasks:', error);
    }
  }, []);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Tasks</h1>
      </header>

      {/* Filters */}
      <div className={styles.filters}>
        <FilterBar
          sort={sort}
          onSortChange={setSort}
          status={status}
          onStatusChange={setStatus}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* Content */}
      <div className={styles.content}>
        {loading ? (
          <LoadingState />
        ) : tasks.length === 0 ? (
          <EmptyState status={status} />
        ) : (
          <>
            <div className={styles.taskList}>
              <DraggableTaskList
                tasks={tasks}
                onToggle={handleToggle}
                onNavigate={handleNavigate}
                onReorder={handleReorder}
                showDate
              />
            </div>

            {/* Load more button */}
            {nextCursor && (
              <div className={styles.loadMoreContainer}>
                <button
                  className={styles.loadMoreButton}
                  onClick={loadMore}
                  disabled={loadingMore}
                  aria-busy={loadingMore}
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Check if a task matches the current filter criteria
 */
function matchesCurrentFilter(
  task: Task,
  filter: { sort: SortOption; status: StatusOption; dateRange: DateRangeOption }
): boolean {
  // Status filter
  if (filter.status === 'active' && task.completed) return false;
  if (filter.status === 'completed' && !task.completed) return false;

  // Date range filter
  const { after, before } = getDateRangeBounds(filter.dateRange);
  if (after !== undefined && task.createdAt < after) return false;
  if (before !== undefined && task.createdAt > before) return false;

  return true;
}

/**
 * Sort tasks by the current sort option
 */
function sortTasks(tasks: Task[], sort: SortOption): Task[] {
  return [...tasks].sort((a, b) => {
    switch (sort) {
      case 'priority':
        return a.priority - b.priority;
      case 'createdAt-desc':
        return b.createdAt - a.createdAt;
      case 'createdAt-asc':
        return a.createdAt - b.createdAt;
      default:
        return 0;
    }
  });
}
