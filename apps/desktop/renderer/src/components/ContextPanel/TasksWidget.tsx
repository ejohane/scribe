/**
 * TasksWidget component (Placeholder)
 *
 * Displays tasks/checkboxes from the current note.
 * Currently a placeholder showing static content.
 *
 * Future: Extract checkboxes from note content and display interactively.
 */

import clsx from 'clsx';
import * as styles from './ContextPanel.css';

export interface TasksWidgetProps {
  /** Placeholder - future: tasks extracted from note content */
  tasks?: Array<{ id: string; text: string; completed: boolean }>;
}

/**
 * Check circle icon for the card header
 */
function CheckCircleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.cardIcon}
      style={{ color: '#22c55e' }}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export function TasksWidget({ tasks }: TasksWidgetProps) {
  // Use provided tasks or default to empty for now
  const displayTasks = tasks ?? [];

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <CheckCircleIcon size={14} />
        <span className={styles.cardTitle}>Tasks</span>
      </div>

      {displayTasks.length === 0 ? (
        <div className={styles.emptyState}>No tasks</div>
      ) : (
        <div>
          {displayTasks.map((task) => (
            <div key={task.id} className={styles.taskItem}>
              <input
                type="checkbox"
                checked={task.completed}
                className={styles.taskCheckbox}
                readOnly
              />
              <span className={clsx(styles.taskText, task.completed && styles.taskTextCompleted)}>
                {task.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
