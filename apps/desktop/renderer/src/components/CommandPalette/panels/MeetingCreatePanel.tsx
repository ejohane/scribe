/**
 * MeetingCreatePanel Component
 *
 * Panel for creating a new meeting note with title input and date picker.
 * Replaces the simple text prompt with a richer UI.
 */

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Text, DatePicker } from '@scribe/design-system';
import * as styles from '../CommandPalette.css';
import * as panelStyles from './MeetingCreatePanel.css';

export interface MeetingCreatePanelProps {
  /** Callback when meeting is submitted with title and date */
  onSubmit: (title: string, date: Date) => void;
  /** Callback when creation is cancelled */
  onCancel: () => void;
  /** Initial date for the picker (defaults to today) */
  initialDate?: Date;
}

/**
 * MeetingCreatePanel provides a form for creating meeting notes.
 *
 * Features:
 * - Autofocused title input
 * - DatePicker defaulting to today
 * - Enter key submits if valid
 * - Escape key cancels (with stopPropagation to not close parent palette)
 */
export function MeetingCreatePanel({
  onSubmit,
  onCancel,
  initialDate = new Date(),
}: MeetingCreatePanelProps) {
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const inputRef = useRef<HTMLInputElement>(null);

  const isValid = title.trim().length > 0;

  const handleSubmit = useCallback(() => {
    if (isValid) {
      onSubmit(title.trim(), selectedDate);
    }
  }, [title, selectedDate, isValid, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && isValid) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // Prevent closing the entire command palette
        onCancel();
      }
    },
    [isValid, handleSubmit, onCancel]
  );

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  return (
    <div
      className={styles.deleteConfirmation}
      role="dialog"
      aria-modal="true"
      aria-labelledby="meeting-create-title"
    >
      <Text
        as="h2"
        id="meeting-create-title"
        size="md"
        weight="bold"
        className={styles.deleteConfirmationTitle}
      >
        New Meeting
      </Text>

      {/* Title field */}
      <div className={panelStyles.fieldContainer}>
        <Text as="label" htmlFor="meeting-title" className={panelStyles.label}>
          Meeting title
        </Text>
        <input
          ref={inputRef}
          id="meeting-title"
          type="text"
          className={styles.promptInputField}
          placeholder="Sprint Planning"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>

      {/* Date field */}
      <div className={panelStyles.fieldContainer}>
        <Text as="label" className={panelStyles.label}>
          Date
        </Text>
        <DatePicker value={selectedDate} onChange={handleDateChange} />
      </div>

      {/* Action buttons */}
      <div className={panelStyles.actionsRow}>
        <button className={styles.cancelButton} onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          className={styles.primaryButton}
          onClick={handleSubmit}
          disabled={!isValid}
          type="button"
        >
          Create
        </button>
      </div>
    </div>
  );
}
