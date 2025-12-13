/**
 * PromptInputPanel Component
 *
 * Text input modal for collecting user input.
 */

import type { Ref } from 'react';
import { Text } from '@scribe/design-system';
import * as styles from '../CommandPalette.css';

export interface PromptInputPanelProps {
  /** Placeholder text for the input title */
  placeholder?: string;
  /** Current input value */
  value: string;
  /** Callback to update input value */
  setValue: (value: string) => void;
  /** Callback when input is submitted */
  onSubmit: () => void;
  /** Callback when input is cancelled */
  onCancel: () => void;
  /** Ref for the input element */
  inputRef?: Ref<HTMLInputElement>;
}

export function PromptInputPanel({
  placeholder,
  value,
  setValue,
  onSubmit,
  onCancel,
  inputRef,
}: PromptInputPanelProps) {
  return (
    <div
      className={styles.deleteConfirmation}
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-input-title"
    >
      <Text
        as="h2"
        id="prompt-input-title"
        size="md"
        weight="bold"
        className={styles.deleteConfirmationTitle}
      >
        {placeholder || 'Enter value'}
      </Text>
      <input
        ref={inputRef}
        type="text"
        className={styles.promptInputField}
        placeholder="Type here..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) {
            e.preventDefault();
            onSubmit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        autoFocus
      />
      <div className={styles.deleteConfirmationActions}>
        <button className={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
        <button className={styles.primaryButton} onClick={onSubmit} disabled={!value.trim()}>
          Create
        </button>
      </div>
    </div>
  );
}
