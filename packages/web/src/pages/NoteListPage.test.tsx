/**
 * Tests for NoteListPage
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NoteListPage } from './NoteListPage';

function renderNoteListPage() {
  return render(
    <MemoryRouter>
      <NoteListPage />
    </MemoryRouter>
  );
}

describe('NoteListPage', () => {
  it('renders without crashing', () => {
    renderNoteListPage();

    expect(screen.getByTestId('note-list-page')).toBeInTheDocument();
  });

  it('displays the Notes heading', () => {
    renderNoteListPage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Notes');
  });

  it('displays placeholder text', () => {
    renderNoteListPage();

    expect(screen.getByText(/No notes yet/)).toBeInTheDocument();
  });

  it('has create note link', () => {
    renderNoteListPage();

    const link = screen.getByTestId('create-note-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/note/new');
  });

  it('has correct structure for e2e testing', () => {
    renderNoteListPage();

    const page = screen.getByTestId('note-list-page');
    expect(page).toContainElement(screen.getByRole('heading'));
    expect(page).toContainElement(screen.getByTestId('create-note-link'));
  });
});
