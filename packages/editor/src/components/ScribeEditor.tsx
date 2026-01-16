/**
 * ScribeEditor component
 *
 * Placeholder editor component for testing infrastructure.
 * Will be replaced with actual Lexical editor implementation.
 */

import { type FC } from 'react';

export interface ScribeEditorProps {
  /** Initial content for the editor */
  initialContent?: string;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Callback fired when content changes */
  onChange?: (content: string) => void;
}

export const ScribeEditor: FC<ScribeEditorProps> = ({
  initialContent = '',
  placeholder = 'Start writing...',
  readOnly = false,
  onChange,
}) => {
  return (
    <div
      role="textbox"
      aria-label="Scribe Editor"
      aria-readonly={readOnly}
      aria-placeholder={placeholder}
      data-testid="scribe-editor"
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onInput={(e) => {
        onChange?.(e.currentTarget.textContent ?? '');
      }}
    >
      {initialContent || placeholder}
    </div>
  );
};
