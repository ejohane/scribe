import { useState, useCallback, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import type { Note, NoteType } from '@scribe/shared';
import * as styles from './NoteHeader.css';

/**
 * Note type configuration with display labels and icons
 */
const NOTE_TYPES: Array<{ value: NoteType | undefined; label: string; icon: string }> = [
  { value: undefined, label: 'Note', icon: '📝' },
  { value: 'project', label: 'Project', icon: '📁' },
  { value: 'meeting', label: 'Meeting', icon: '📅' },
  { value: 'person', label: 'Person', icon: '👤' },
  { value: 'daily', label: 'Daily', icon: '📆' },
  { value: 'template', label: 'Template', icon: '📋' },
];

interface NoteHeaderProps {
  note: Note;
  onTitleChange: (title: string) => void;
  onTypeChange: (type: NoteType | undefined) => void;
  onTagsChange: (tags: string[]) => void;
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
 * NoteHeader component
 *
 * Displays and allows editing of note metadata:
 * - Title (editable inline)
 * - Creation date (read-only)
 * - Note type (dropdown selector)
 * - Tags (pills with add/remove)
 *
 * Designed to blend seamlessly with the editor content below.
 */
export function NoteHeader({ note, onTitleChange, onTypeChange, onTagsChange }: NoteHeaderProps) {
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');

  const typeMenuRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Get current type config
  const currentType = NOTE_TYPES.find((t) => t.value === note.type) ?? NOTE_TYPES[0];

  // Close type menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (typeMenuRef.current && !typeMenuRef.current.contains(event.target as Node)) {
        setIsTypeMenuOpen(false);
      }
    }

    if (isTypeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isTypeMenuOpen]);

  // Focus tag input when adding
  useEffect(() => {
    if (isAddingTag && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [isAddingTag]);

  // Handle title change
  const handleTitleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onTitleChange(e.target.value);
    },
    [onTitleChange]
  );

  // Handle type selection
  const handleTypeSelect = useCallback(
    (type: NoteType | undefined) => {
      onTypeChange(type);
      setIsTypeMenuOpen(false);
    },
    [onTypeChange]
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
    // Remove # prefix if user types it, and strip whitespace
    const value = e.target.value.replace(/^#/, '').trim();
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

  return (
    <div className={styles.noteHeader}>
      {/* Editable title */}
      <input
        type="text"
        className={styles.titleInput}
        value={note.title}
        onChange={handleTitleChange}
        placeholder="Untitled"
        aria-label="Note title"
      />

      {/* Metadata row: date, type, tags */}
      <div className={styles.metadataRow}>
        {/* Creation date */}
        <div className={styles.metadataItem}>
          <span className={styles.metadataValue}>{formatDate(note.createdAt)}</span>
        </div>

        <div className={styles.divider} />

        {/* Note type selector */}
        <div className={styles.typeMenuWrapper} ref={typeMenuRef}>
          <button
            className={styles.typeSelector}
            onClick={() => setIsTypeMenuOpen(!isTypeMenuOpen)}
            aria-label="Select note type"
            aria-expanded={isTypeMenuOpen}
          >
            <span className={styles.typeIcon}>{currentType.icon}</span>
            <span>{currentType.label}</span>
          </button>

          {isTypeMenuOpen && (
            <div className={styles.typeMenu} role="listbox" aria-label="Note types">
              {NOTE_TYPES.map((type) => (
                <div
                  key={type.label}
                  className={`${styles.typeMenuItem} ${type.value === note.type ? styles.typeMenuItemActive : ''}`}
                  onClick={() => handleTypeSelect(type.value)}
                  role="option"
                  aria-selected={type.value === note.type}
                >
                  <span>{type.icon}</span>
                  <span>{type.label}</span>
                </div>
              ))}
            </div>
          )}
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
