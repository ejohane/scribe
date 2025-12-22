/**
 * MeetingCreatePanel Component
 *
 * Panel for creating a new meeting note with title and date selection.
 * Used within the CommandPalette in 'meeting-create' mode.
 */

import { useState } from 'react';
import { Text, DatePicker } from '@scribe/design-system';
import * as styles from './MeetingCreatePanel.css';

export interface MeetingCreatePanelProps {
  /** Callback when meeting is submitted */
  onSubmit: (title: string, date: Date) => void;
  /** Callback when creation is cancelled */
  onCancel: () => void;
  /** Initial date to pre-select (defaults to today) */
  initialDate?: Date;
}

/**
 * MeetingCreatePanel provides a rich UI for meeting note creation.
 *
 * Features:
 * - Title input with autofocus
 * - DatePicker defaulting to today
 * - Enter to submit (when valid)
 * - Escape to cancel (without closing command palette)
 * - Create button disabled until title is entered
 */
export function MeetingCreatePanel({
  onSubmit,
  onCancel,
  initialDate = new Date(),
}: MeetingCreatePanelProps) {
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const handleSubmit = () => {
    if (title.trim()) {
      onSubmit(title.trim(), selectedDate);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && title.trim()) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // Don't close the entire command palette
      onCancel();
    }
  };

  const isValid = title.trim().length > 0;

  return (
    <div
      className={styles.container}
      role="dialog"
      aria-modal="true"
      aria-labelledby="meeting-create-title"
    >
      <Text as="h2" id="meeting-create-title" size="md" weight="bold" className={styles.header}>
        New Meeting
      </Text>

      <div className={styles.field}>
        <Text as="label" size="sm" weight="medium" className={styles.label}>
          Meeting title
        </Text>
        <input
          type="text"
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Sprint Planning"
          autoFocus
        />
      </div>

      <div className={styles.field}>
        <Text as="label" size="sm" weight="medium" className={styles.label}>
          Date
        </Text>
        <DatePicker value={selectedDate} onChange={setSelectedDate} />
      </div>

      <div className={styles.actions}>
        <button className={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
        <button className={styles.primaryButton} onClick={handleSubmit} disabled={!isValid}>
          Create
        </button>
      </div>
    </div>
  );
}
