/**
 * Tests for NoteEditorPage
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NoteEditorPage } from './NoteEditorPage';

function renderNoteEditorPage(noteId = 'test-note-123') {
  return render(
    <MemoryRouter initialEntries={[`/note/${noteId}`]}>
      <Routes>
        <Route path="/note/:id" element={<NoteEditorPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('NoteEditorPage', () => {
  it('renders without crashing', () => {
    renderNoteEditorPage();

    expect(screen.getByTestId('note-editor-page')).toBeInTheDocument();
  });

  it('displays the Note Editor heading', () => {
    renderNoteEditorPage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Note Editor');
  });

  it('displays the note id from URL params', () => {
    renderNoteEditorPage('my-custom-note');

    expect(screen.getByTestId('note-id')).toHaveTextContent('my-custom-note');
  });

  it('has back link to notes list', () => {
    renderNoteEditorPage();

    const link = screen.getByTestId('back-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveTextContent('Back to Notes');
  });

  it('displays placeholder text', () => {
    renderNoteEditorPage();

    expect(screen.getByText(/Editor will be implemented/)).toBeInTheDocument();
  });

  it('handles special characters in note id', () => {
    renderNoteEditorPage('note-with-special-chars-123');

    expect(screen.getByTestId('note-id')).toHaveTextContent('note-with-special-chars-123');
  });

  it('has correct structure for e2e testing', () => {
    renderNoteEditorPage();

    const page = screen.getByTestId('note-editor-page');
    expect(page).toContainElement(screen.getByRole('heading'));
    expect(page).toContainElement(screen.getByTestId('back-link'));
    expect(page).toContainElement(screen.getByTestId('note-id'));
  });
});
