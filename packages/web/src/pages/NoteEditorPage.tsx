/**
 * NoteEditorPage
 *
 * Full-screen editor for a single note.
 * This is a placeholder for Phase 8 - will be fully implemented in a later task.
 */

import { type FC } from 'react';
import { useParams, Link } from 'react-router-dom';

/**
 * Editor page component for viewing and editing a single note.
 * Currently a stub - editor functionality will be added in a later task.
 */
export const NoteEditorPage: FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div data-testid="note-editor-page">
      <header>
        <nav>
          <Link to="/" data-testid="back-link">
            Back to Notes
          </Link>
        </nav>
        <h1>Note Editor</h1>
      </header>
      <main>
        <p data-testid="note-id">Editing note: {id}</p>
        <p>Editor will be implemented in a future task.</p>
      </main>
    </div>
  );
};
