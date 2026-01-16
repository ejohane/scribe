/**
 * EditorToolbar - Placeholder toolbar component for ScribeEditor.
 *
 * This is a minimal placeholder that will be fully implemented
 * in a separate task (scribe-h0qo: Implement editor toolbar component).
 *
 * @module
 */

import { type FC } from 'react';

/**
 * Props for EditorToolbar component.
 */
export interface EditorToolbarProps {
  /** Additional CSS class name */
  className?: string;
}

/**
 * EditorToolbar - Placeholder component for editor formatting controls.
 *
 * Currently renders an empty toolbar container.
 * Full implementation with formatting buttons coming in Phase 7.
 */
export const EditorToolbar: FC<EditorToolbarProps> = ({ className }) => {
  return (
    <div
      className={`scribe-editor-toolbar ${className ?? ''}`}
      role="toolbar"
      aria-label="Editor formatting"
    >
      {/* Toolbar buttons will be implemented in scribe-h0qo */}
    </div>
  );
};
