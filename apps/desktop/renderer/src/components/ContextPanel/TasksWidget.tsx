/**
 * TasksWidget component
 *
 * Displays incomplete tasks from the vault with live updates.
 * Shows loading state, empty state, and integrates with DraggableTaskList
 * for interactive task management (checkbox toggle, drag-to-reorder, click-to-navigate).
 *
 * Features:
 * - Loads incomplete tasks sorted by priority (limit 20)
 * - Subscribes to task:changed events for live updates
 * - Supports checkbox toggle, reordering, and navigation to source notes
 * - Collapsed view shows top 5 tasks, expanded view shows up to 10 with scrolling
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import type { Task, NoteId, TaskChangeEvent } from '@scribe/shared';
import { CheckCircleIcon, ChevronDownIcon, ChevronUpIcon } from '@scribe/design-system';
import { DraggableTaskList } from '../Tasks/DraggableTaskList';
import * as styles from './ContextPanel.css';

/** Number of tasks to show in collapsed state */
const COLLAPSED_LIMIT = 5;
/** Maximum number of tasks to show in expanded state */
const EXPANDED_LIMIT = 10;

export interface TasksWidgetProps {
  /** Callback when navigating to Tasks screen (clicking header) */
  onNavigateToTasks?: () => void;
  /** Callback when navigating to a note (for task click) */
  onNavigate?: (noteId: NoteId) => void;
  /** Current note ID being viewed in the editor */
  currentNoteId?: NoteId | null;
  /** Callback to refresh the current note in the editor after task changes */
  onNoteUpdate?: () => void;
}

/**
 * Loading skeleton for task list
 */
function LoadingSkeleton() {
  return (
    <div className={styles.emptyState} aria-live="polite" aria-busy="true">
      Loading tasks...
    </div>
  );
}

export function TasksWidget({
  onNavigateToTasks,
  onNavigate,
  currentNoteId,
  onNoteUpdate,
}: TasksWidgetProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load initial tasks
  useEffect(() => {
    let mounted = true;

    async function loadTasks() {
      try {
        const { tasks: loadedTasks } = await window.scribe.tasks.list({
          completed: false,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          limit: 20,
        });

        if (mounted) {
          setTasks(loadedTasks);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load tasks:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadTasks();

    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to task changes
  useEffect(() => {
    const handleTaskChanges = (events: TaskChangeEvent[]) => {
      console.debug('[TasksWidget] Received task changes:', events);
      for (const event of events) {
        switch (event.type) {
          case 'added':
            // Only add incomplete tasks, newest first
            if (!event.task.completed) {
              setTasks((prev) => [event.task, ...prev].slice(0, 20));
            }
            break;

          case 'updated':
            setTasks((prev) => {
              // If task is now completed, remove it from the list
              if (event.task.completed) {
                return prev.filter((t) => t.id !== event.task.id);
              }
              // Otherwise update it in place (maintain position)
              const exists = prev.some((t) => t.id === event.task.id);
              if (exists) {
                return prev.map((t) => (t.id === event.task.id ? event.task : t));
              }
              // Task became incomplete, add it at the top
              return [event.task, ...prev].slice(0, 20);
            });
            break;

          case 'removed':
            setTasks((prev) => prev.filter((t) => t.id !== event.taskId));
            break;

          case 'reordered':
            // Refetch to get correct order after reorder
            window.scribe.tasks
              .list({
                completed: false,
                sortBy: 'createdAt',
                sortOrder: 'desc',
                limit: 20,
              })
              .then(({ tasks: refreshedTasks }) => {
                setTasks(refreshedTasks);
              })
              .catch((error) => {
                console.error('Failed to refresh tasks after reorder:', error);
              });
            break;
        }
      }
    };

    const unsubscribe = window.scribe.tasks.onChange(handleTaskChanges);

    return () => {
      unsubscribe();
    };
  }, []);

  // Handle task toggle
  const handleToggle = useCallback(
    async (taskId: string) => {
      try {
        // Find the task to check if it belongs to the current note
        const task = tasks.find((t) => t.id === taskId);
        const shouldRefreshEditor = task && currentNoteId && task.noteId === currentNoteId;

        await window.scribe.tasks.toggle(taskId);
        // Note: UI update handled by onChange subscription

        // If the toggled task belongs to the currently viewed note, refresh the editor
        if (shouldRefreshEditor && onNoteUpdate) {
          onNoteUpdate();
        }
      } catch (error) {
        console.error('Failed to toggle task:', error);
      }
    },
    [tasks, currentNoteId, onNoteUpdate]
  );

  // Handle task navigation - navigate to the task's source note
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

  // Determine which tasks to display based on expanded state
  const visibleTasks = useMemo(() => {
    const limit = isExpanded ? EXPANDED_LIMIT : COLLAPSED_LIMIT;
    return tasks.slice(0, limit);
  }, [tasks, isExpanded]);

  // Show expand button if there are more than COLLAPSED_LIMIT tasks
  const showExpandButton = tasks.length > COLLAPSED_LIMIT;

  // Calculate remaining tasks count for the button label
  const remainingCount = Math.min(tasks.length - COLLAPSED_LIMIT, EXPANDED_LIMIT - COLLAPSED_LIMIT);

  const handleExpandToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className={styles.card}>
      <div
        className={clsx(styles.cardHeader, onNavigateToTasks && styles.cardHeaderClickable)}
        onClick={onNavigateToTasks}
        role={onNavigateToTasks ? 'button' : undefined}
        tabIndex={onNavigateToTasks ? 0 : undefined}
        onKeyDown={
          onNavigateToTasks
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNavigateToTasks();
                }
              }
            : undefined
        }
      >
        <CheckCircleIcon size={14} className={clsx(styles.cardIcon, styles.cardIconSuccess)} />
        <span className={styles.cardTitle}>Tasks</span>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : tasks.length === 0 ? (
        <div className={styles.emptyState}>No tasks</div>
      ) : (
        <>
          <div className={isExpanded ? styles.taskListScrollable : undefined}>
            <DraggableTaskList
              tasks={visibleTasks}
              onToggle={handleToggle}
              onNavigate={handleNavigate}
              onReorder={handleReorder}
              truncate
            />
          </div>
          {showExpandButton && (
            <button
              type="button"
              className={styles.expandButton}
              onClick={handleExpandToggle}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Show fewer tasks' : `Show ${remainingCount} more tasks`}
            >
              {isExpanded ? (
                <>
                  <ChevronUpIcon size={12} />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDownIcon size={12} />
                  Show {remainingCount} more
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
