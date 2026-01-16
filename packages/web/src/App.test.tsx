/**
 * Tests for App component and routing
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ScribeProvider } from './providers/ScribeProvider';
import { NoteListPage } from './pages/NoteListPage';
import { NoteEditorPage } from './pages/NoteEditorPage';

/**
 * Helper to render with routing context.
 * Uses MemoryRouter instead of BrowserRouter for testing.
 */
function renderWithRouter(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <ScribeProvider>
        <Routes>
          <Route path="/" element={<NoteListPage />} />
          <Route path="/note/:id" element={<NoteEditorPage />} />
        </Routes>
      </ScribeProvider>
    </MemoryRouter>
  );
}

describe('App Routing', () => {
  it('renders NoteListPage at root route', () => {
    renderWithRouter('/');

    expect(screen.getByTestId('note-list-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Notes');
  });

  it('renders NoteEditorPage at /note/:id route', () => {
    renderWithRouter('/note/test-note-123');

    expect(screen.getByTestId('note-editor-page')).toBeInTheDocument();
    expect(screen.getByTestId('note-id')).toHaveTextContent('test-note-123');
  });

  it('navigates from NoteListPage to NoteEditorPage', async () => {
    const user = userEvent.setup();
    renderWithRouter('/');

    // Should start on NoteListPage
    expect(screen.getByTestId('note-list-page')).toBeInTheDocument();

    // Click create note link
    await user.click(screen.getByTestId('create-note-link'));

    // Should navigate to NoteEditorPage
    expect(screen.getByTestId('note-editor-page')).toBeInTheDocument();
    expect(screen.getByTestId('note-id')).toHaveTextContent('new');
  });

  it('navigates from NoteEditorPage back to NoteListPage', async () => {
    const user = userEvent.setup();
    renderWithRouter('/note/test-123');

    // Should start on NoteEditorPage
    expect(screen.getByTestId('note-editor-page')).toBeInTheDocument();

    // Click back link
    await user.click(screen.getByTestId('back-link'));

    // Should navigate back to NoteListPage
    expect(screen.getByTestId('note-list-page')).toBeInTheDocument();
  });
});
