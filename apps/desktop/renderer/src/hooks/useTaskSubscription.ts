import { useEffect, useCallback, useRef } from 'react';
import type { Task, TaskChangeEvent } from '@scribe/shared';

/**
 * Options for the useTaskSubscription hook
 */
interface UseTaskSubscriptionOptions {
  /**
   * Called when a new task is added
   */
  onTaskAdded?: (task: Task) => void;

  /**
   * Called when a task is updated (e.g., completion toggled)
   */
  onTaskUpdated?: (task: Task) => void;

  /**
   * Called when a task is removed
   */
  onTaskRemoved?: (taskId: string) => void;

  /**
   * Called when tasks are reordered
   */
  onTasksReordered?: (taskIds: string[]) => void;

  /**
   * Delay in milliseconds to batch incoming events before processing
   * This helps reduce UI thrashing when multiple changes happen rapidly
   * @default 50
   */
  batchDelayMs?: number;
}

/**
 * React hook to subscribe to task change events from the main process
 *
 * This hook:
 * - Subscribes to the tasks:changed IPC channel via preload API
 * - Batches incoming events to reduce UI updates during rapid changes
 * - Automatically cleans up subscription on unmount
 *
 * @example
 * ```tsx
 * function TaskList() {
 *   const [tasks, setTasks] = useState<Task[]>([]);
 *
 *   useTaskSubscription({
 *     onTaskAdded: (task) => setTasks(prev => [...prev, task]),
 *     onTaskUpdated: (task) => setTasks(prev =>
 *       prev.map(t => t.id === task.id ? task : t)
 *     ),
 *     onTaskRemoved: (taskId) => setTasks(prev =>
 *       prev.filter(t => t.id !== taskId)
 *     ),
 *     onTasksReordered: (taskIds) => {
 *       // Handle reorder based on new ID ordering
 *     },
 *   });
 *
 *   return <ul>{tasks.map(t => <li key={t.id}>{t.text}</li>)}</ul>;
 * }
 * ```
 */
export function useTaskSubscription(options: UseTaskSubscriptionOptions): void {
  const {
    onTaskAdded,
    onTaskUpdated,
    onTaskRemoved,
    onTasksReordered,
    batchDelayMs = 50,
  } = options;

  const pendingEvents = useRef<TaskChangeEvent[]>([]);
  const batchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const processBatch = useCallback(() => {
    const events = pendingEvents.current;
    pendingEvents.current = [];

    for (const event of events) {
      switch (event.type) {
        case 'added':
          onTaskAdded?.(event.task);
          break;
        case 'updated':
          onTaskUpdated?.(event.task);
          break;
        case 'removed':
          onTaskRemoved?.(event.taskId);
          break;
        case 'reordered':
          onTasksReordered?.(event.taskIds);
          break;
      }
    }
  }, [onTaskAdded, onTaskUpdated, onTaskRemoved, onTasksReordered]);

  useEffect(() => {
    const handler = (events: TaskChangeEvent[]) => {
      pendingEvents.current.push(...events);

      if (batchTimeout.current) {
        clearTimeout(batchTimeout.current);
      }
      batchTimeout.current = setTimeout(processBatch, batchDelayMs);
    };

    const unsubscribe = window.scribe.tasks.onChange(handler);

    return () => {
      if (batchTimeout.current) {
        clearTimeout(batchTimeout.current);
      }
      unsubscribe();
    };
  }, [processBatch, batchDelayMs]);
}
