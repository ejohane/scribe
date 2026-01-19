/**
 * CommandPaletteInput
 *
 * Search input component for the command palette.
 * Handles keyboard navigation and search query changes.
 *
 * @module
 */

import { forwardRef, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import { SearchIcon } from '@scribe/design-system';
import clsx from 'clsx';
import * as styles from './CommandPalette.css';
import type { CommandPaletteView } from './types';

export interface CommandPaletteInputProps {
  /** Current search query */
  value: string;
  /** Callback when query changes */
  onChange: (value: string) => void;
  /** Callback when Enter is pressed */
  onSubmit: () => void;
  /** Callback when Escape is pressed */
  onEscape: () => void;
  /** Callback when Arrow Down is pressed */
  onArrowDown: () => void;
  /** Callback when Arrow Up is pressed */
  onArrowUp: () => void;
  /** Current view mode */
  view: CommandPaletteView;
  /** Optional className */
  className?: string;
}

/**
 * Search input for the command palette.
 * Auto-focuses on mount and handles keyboard navigation.
 */
export const CommandPaletteInput = forwardRef<HTMLInputElement, CommandPaletteInputProps>(
  function CommandPaletteInput(
    { value, onChange, onSubmit, onEscape, onArrowDown, onArrowUp, view, className },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus on mount
    useEffect(() => {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }, []);

    // Merge refs
    const setRef = (el: HTMLInputElement | null) => {
      (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      if (typeof ref === 'function') {
        ref(el);
      } else if (ref) {
        ref.current = el;
      }
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          onSubmit();
          break;
        case 'Escape':
          e.preventDefault();
          onEscape();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onArrowDown();
          break;
        case 'ArrowUp':
          e.preventDefault();
          onArrowUp();
          break;
      }
    };

    const placeholder = view === 'command' ? 'Type a command or search...' : 'Search notes...';

    return (
      <div className={clsx(styles.inputWrapper, className)}>
        <SearchIcon size={16} className={styles.inputIcon} />
        <input
          ref={setRef}
          type="text"
          className={styles.input}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <span className={styles.inputHint}>esc</span>
      </div>
    );
  }
);
