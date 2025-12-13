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
 */

import { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import type { Task, NoteId, TaskChangeEvent } from '@scribe/shared';
import { CheckCircleIcon } from '@scribe/design-system';
import { DraggableTaskList } from '../Tasks/DraggableTaskList';
import * as styles from './ContextPanel.css';

export interface TasksWidgetProps {
  /** Callback when navigating to Tasks screen (clicking header) */
  onNavigateToTasks?: () => void;
  /** Callback when navigating to a note (for task click) */
  onNavigate?: (noteId: NoteId) => void;
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

export function TasksWidget({ onNavigateToTasks, onNavigate }: TasksWidgetProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial tasks
  useEffect(() => {
    let mounted = true;

    async function loadTasks() {
      try {
        const { tasks: loadedTasks } = await window.scribe.tasks.list({
          completed: false,
          sortBy: 'priority',
          sortOrder: 'asc',
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
      for (const event of events) {
        switch (event.type) {
          case 'added':
            // Only add incomplete tasks, maintain sort order
            if (!event.task.completed) {
              setTasks((prev) =>
                [...prev, event.task].sort((a, b) => a.priority - b.priority).slice(0, 20)
              );
            }
            break;

          case 'updated':
            setTasks((prev) => {
              // If task is now completed, remove it from the list
              if (event.task.completed) {
                return prev.filter((t) => t.id !== event.task.id);
              }
              // Otherwise update it in place and re-sort
              const exists = prev.some((t) => t.id === event.task.id);
              if (exists) {
                return prev
                  .map((t) => (t.id === event.task.id ? event.task : t))
                  .sort((a, b) => a.priority - b.priority);
              }
              // Task became incomplete, add it
              return [...prev, event.task].sort((a, b) => a.priority - b.priority).slice(0, 20);
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
                sortBy: 'priority',
                sortOrder: 'asc',
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
  const handleToggle = useCallback(async (taskId: string) => {
    try {
      await window.scribe.tasks.toggle(taskId);
      // Note: UI update handled by onChange subscription
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  }, []);

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
        <DraggableTaskList
          tasks={tasks}
          onToggle={handleToggle}
          onNavigate={handleNavigate}
          onReorder={handleReorder}
          truncate
        />
      )}
    </div>
  );
}
