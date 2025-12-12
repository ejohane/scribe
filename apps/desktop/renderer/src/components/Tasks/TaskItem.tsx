/**
 * TaskItem component
 *
 * Renders a single task row with checkbox, text, note title, and optional date.
 * Used inside DraggableTaskList for both panel and full-screen views.
 */

import { forwardRef, useCallback } from 'react';
import type { Task } from '@scribe/shared';
import { format } from 'date-fns';
import clsx from 'clsx';
import * as styles from './TaskItem.css';

export interface TaskItemProps {
  /**
   * The task to display
   */
  task: Task;

  /**
   * Called when the checkbox is toggled
   */
  onToggle: (taskId: string) => void;

  /**
   * Called when the task text or note title is clicked for navigation
   */
  onNavigate: (task: Task) => void;

  /**
   * Whether to truncate long text (for panel view)
   */
  truncate?: boolean;

  /**
   * Whether to show the date
   */
  showDate?: boolean;

  /**
   * Whether the drag handle should always be visible (for screen view)
   */
  showDragHandle?: boolean;

  /**
   * Whether this item is currently being dragged
   */
  isDragging?: boolean;

  /**
   * Drag handle listeners from @dnd-kit
   */
  dragHandleProps?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attributes: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listeners: any;
  };
}

/**
 * Checkmark SVG icon
 */
function CheckmarkIcon() {
  return (
    <svg
      className={styles.checkmark}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Drag handle (grip) SVG icon
 */
function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

/**
 * Format task date for display
 */
function formatTaskDate(task: Task): string {
  if (task.completed && task.completedAt) {
    return `Completed ${format(task.completedAt, 'MMM d')}`;
  }
  return `Added ${format(task.createdAt, 'MMM d')}`;
}

export const TaskItem = forwardRef<HTMLDivElement, TaskItemProps>(function TaskItem(
  {
    task,
    onToggle,
    onNavigate,
    truncate = false,
    showDate = false,
    showDragHandle = false,
    isDragging = false,
    dragHandleProps,
  },
  ref
) {
  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onToggle(task.id);
    },
    [task.id, onToggle]
  );

  const handleTextClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onNavigate(task);
    },
    [task, onNavigate]
  );

  const handleNoteTitleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onNavigate(task);
    },
    [task, onNavigate]
  );

  return (
    <div
      ref={ref}
      className={clsx(
        styles.taskItem,
        isDragging && styles.taskItemDragging,
        task.completed && styles.taskItemCompleted
      )}
    >
      {/* Drag handle */}
      <div
        className={clsx(
          styles.dragHandle,
          showDragHandle && styles.dragHandleVisible,
          isDragging && styles.dragHandleActive
        )}
        {...dragHandleProps?.attributes}
        {...dragHandleProps?.listeners}
      >
        <GripIcon />
      </div>

      {/* Checkbox */}
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          className={styles.checkboxInput}
          checked={task.completed}
          onChange={handleCheckboxChange}
          aria-label={`Mark "${task.text}" as ${task.completed ? 'incomplete' : 'complete'}`}
        />
        <span className={styles.checkboxVisual}>
          <CheckmarkIcon />
        </span>
      </label>

      {/* Content */}
      <div className={styles.content}>
        <span
          className={clsx(
            styles.text,
            truncate ? styles.textVariants.truncate : styles.textVariants.full,
            task.completed && styles.textCompleted
          )}
          onClick={handleTextClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleTextClick(e as unknown as React.MouseEvent);
            }
          }}
        >
          {task.text}
        </span>

        <div className={styles.meta}>
          <span
            className={styles.noteTitle}
            onClick={handleNoteTitleClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleNoteTitleClick(e as unknown as React.MouseEvent);
              }
            }}
          >
            {task.noteTitle}
          </span>

          {showDate && (
            <>
              <span className={styles.metaSeparator} aria-hidden="true" />
              <span className={styles.date}>{formatTaskDate(task)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
