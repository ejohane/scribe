/**
 * NoteContextMenu Component
 *
 * A reusable context menu for note-related actions, including:
 * - Open in New Window
 *
 * Uses createPortal to render at the click position.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { NoteId } from '@scribe/shared';
import * as styles from './NoteContextMenu.css';

interface NoteContextMenuProps {
  noteId: NoteId;
  position: { x: number; y: number };
  onClose: () => void;
}

export function NoteContextMenu({ noteId, position, onClose }: NoteContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOpenInNewWindow = async () => {
    await window.scribe.window.openNote(noteId);
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ top: position.y, left: position.x }}
      role="menu"
      aria-label="Note actions"
    >
      <button className={styles.menuItem} onClick={handleOpenInNewWindow} role="menuitem">
        Open in New Window
      </button>
    </div>,
    document.body
  );
}
