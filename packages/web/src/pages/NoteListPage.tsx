/**
 * NoteListPage
 *
 * Displays a list of all notes and allows navigation to individual notes.
 * This is a placeholder for Phase 8 - will be fully implemented in a later task.
 */

import { type FC } from 'react';
import { Link } from 'react-router-dom';

/**
 * Home page component that displays the list of notes.
 * Currently a stub - note list functionality will be added in a later task.
 */
export const NoteListPage: FC = () => {
  return (
    <div data-testid="note-list-page">
      <header>
        <h1>Notes</h1>
      </header>
      <main>
        <p>No notes yet. Create your first note!</p>
        <nav>
          <Link to="/note/new" data-testid="create-note-link">
            Create Note
          </Link>
        </nav>
      </main>
    </div>
  );
};
