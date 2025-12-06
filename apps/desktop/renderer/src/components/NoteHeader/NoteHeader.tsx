import { useState, useCallback, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import type { Note } from '@scribe/shared';
import { getTemplate } from '../../templates';
// Import templates to auto-register them
import '../../templates/daily';
import * as styles from './NoteHeader.css';

/** Debounce delay for title changes (ms) */
const TITLE_DEBOUNCE_MS = 300;

interface NoteHeaderProps {
  note: Note;
  onTitleChange: (title: string) => void;
  onTagsChange: (tags: string[]) => void;
  /** Called when the date is clicked. Opens/creates the daily note for that date. */
  onDateClick?: (date: Date) => void;
  /** Transform Y value for parallax scroll effect */
  translateY?: number;
}

/**
 * Format a timestamp as a human-readable date
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get the display title for a note.
 * - Daily notes: "Today" or "MM/dd/yyyy"
 * - Other notes: use stored title
 */
function getDisplayTitle(note: Note): string {
  const template = getTemplate(note.type);
  if (template) {
    return template.renderTitle(note, { date: new Date() });
  }
  return note.title;
}

/**
 * Check if note title should be editable.
 * Daily note titles are derived from date and should not be edited.
 */
function isTitleEditable(note: Note): boolean {
  return note.type !== 'daily';
}

/**
 * NoteHeader component
 *
 * Displays and allows editing of note metadata:
 * - Title (editable inline)
 * - Creation date (read-only)
 * - Tags (pills with add/remove)
 *
 * Designed to blend seamlessly with the editor content below.
 */
export function NoteHeader({
  note,
  onTitleChange,
  onTagsChange,
  onDateClick,
  translateY = 0,
}: NoteHeaderProps) {
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');
  // Determine if title is editable (daily notes are not editable)
  const titleEditable = isTitleEditable(note);
  // Local title state for immediate UI updates (use display title for non-editable notes)
  const [localTitle, setLocalTitle] = useState(titleEditable ? note.title : getDisplayTitle(note));

  const tagInputRef = useRef<HTMLInputElement>(null);
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local title when note changes (e.g., switching notes)
  useEffect(() => {
    setLocalTitle(titleEditable ? note.title : getDisplayTitle(note));
  }, [note.id, note.title, titleEditable]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) {
        clearTimeout(titleDebounceRef.current);
      }
    };
  }, []);

  // Focus tag input when adding
  useEffect(() => {
    if (isAddingTag && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [isAddingTag]);

  // Handle title change with debounced persistence
  const handleTitleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;

      // Update local state immediately for responsive UI
      setLocalTitle(newTitle);

      // Clear any pending debounced call
      if (titleDebounceRef.current) {
        clearTimeout(titleDebounceRef.current);
      }

      // Debounce the actual persistence
      titleDebounceRef.current = setTimeout(() => {
        onTitleChange(newTitle);
      }, TITLE_DEBOUNCE_MS);
    },
    [onTitleChange]
  );

  // Handle tag removal
  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      onTagsChange(note.tags.filter((tag) => tag !== tagToRemove));
    },
    [note.tags, onTagsChange]
  );

  // Handle new tag input
  const handleTagInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    // Remove # prefix if user types it (trimming happens on submission)
    const value = e.target.value.replace(/^#/, '');
    setNewTagValue(value);
  }, []);

  // Handle tag input submission
  const handleTagInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const trimmedTag = newTagValue.trim();
        if (trimmedTag && !note.tags.includes(trimmedTag)) {
          onTagsChange([...note.tags, trimmedTag]);
        }
        setNewTagValue('');
        setIsAddingTag(false);
      } else if (e.key === 'Escape') {
        setNewTagValue('');
        setIsAddingTag(false);
      }
    },
    [newTagValue, note.tags, onTagsChange]
  );

  // Handle tag input blur
  const handleTagInputBlur = useCallback(() => {
    const trimmedTag = newTagValue.trim();
    if (trimmedTag && !note.tags.includes(trimmedTag)) {
      onTagsChange([...note.tags, trimmedTag]);
    }
    setNewTagValue('');
    setIsAddingTag(false);
  }, [newTagValue, note.tags, onTagsChange]);

  // Calculate opacity based on translateY (fade out as it hides)
  const opacity = translateY === 0 ? 1 : Math.max(0, 1 + translateY / 100);

  return (
    <div
      className={styles.noteHeader}
      style={{
        transform: `translateY(${translateY}px)`,
        opacity,
        pointerEvents: opacity < 0.5 ? 'none' : 'auto',
      }}
    >
      {/* Editable title (read-only for daily notes) */}
      <input
        type="text"
        className={styles.titleInput}
        value={localTitle}
        onChange={handleTitleChange}
        placeholder="Untitled"
        aria-label="Note title"
        readOnly={!titleEditable}
      />

      {/* Metadata row: date, tags */}
      <div className={styles.metadataRow}>
        {/* Creation date - clickable to open the daily note for that date */}
        <div className={styles.metadataItem}>
          <button
            className={styles.dateButton}
            onClick={() => {
              // Use the note's creation date for navigation
              const dateForNavigation = new Date(note.createdAt);
              onDateClick?.(dateForNavigation);
            }}
            title="Open daily note for this date"
            aria-label="Open daily note for this date"
          >
            {formatDate(note.createdAt)}
          </button>
        </div>

        {/* Tags */}
        {(note.tags.length > 0 || isAddingTag) && <div className={styles.divider} />}

        <div className={styles.tagsContainer}>
          {note.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              #{tag}
              <button
                className={styles.tagRemoveButton}
                onClick={() => handleRemoveTag(tag)}
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}

          {isAddingTag ? (
            <input
              ref={tagInputRef}
              type="text"
              className={styles.tagInput}
              value={newTagValue}
              onChange={handleTagInputChange}
              onKeyDown={handleTagInputKeyDown}
              onBlur={handleTagInputBlur}
              placeholder="tag name"
              aria-label="New tag name"
            />
          ) : (
            <button
              className={styles.addTagButton}
              onClick={() => setIsAddingTag(true)}
              aria-label="Add tag"
            >
              + tag
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
