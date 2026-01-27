import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const noteListSpy = vi.fn();

vi.mock('../pages/NoteListPage', () => ({
  NoteListPage: (props: { onNoteSelect: (noteId: string) => void; selectedNoteId?: string }) => {
    noteListSpy(props);
    return <div data-testid="note-list" data-selected-note-id={props.selectedNoteId ?? ''} />;
  },
}));

import { EditorShell } from './EditorShell';

function ShellContent({
  renderMenuButton,
  renderTitlebarDragRegion,
}: {
  renderMenuButton?: () => React.ReactNode;
  renderTitlebarDragRegion?: () => React.ReactNode;
}) {
  return (
    <div data-testid="shell-content">
      {renderTitlebarDragRegion?.()}
      {renderMenuButton?.()}
    </div>
  );
}

describe('EditorShell', () => {
  beforeEach(() => {
    noteListSpy.mockClear();
  });

  it('renders layout regions with shared class names', () => {
    const onNoteSelect = vi.fn();
    const { container } = render(
      <EditorShell noteId="note-123" onNoteSelect={onNoteSelect}>
        <div data-testid="editor-content" />
      </EditorShell>
    );

    expect(container.querySelector('.editor-layout')).toBeInTheDocument();
    expect(container.querySelector('.editor-sidebar')).toBeInTheDocument();
    expect(container.querySelector('.editor-canvas')).toBeInTheDocument();
    expect(container.querySelector('.editor-layout')?.getAttribute('data-sidebar-open')).toBe(
      'false'
    );

    const lastCall = noteListSpy.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual(expect.objectContaining({ onNoteSelect, selectedNoteId: 'note-123' }));
  });

  it('toggles sidebar open state from the menu button slot', () => {
    const onNoteSelect = vi.fn();
    const { container } = render(
      <EditorShell
        noteId={null}
        onNoteSelect={onNoteSelect}
        renderMenuButton={({ toggle }) => (
          <button type="button" data-testid="menu-button" onClick={toggle}>
            Toggle
          </button>
        )}
      >
        <ShellContent />
      </EditorShell>
    );

    const root = container.querySelector('.editor-layout');
    expect(root?.getAttribute('data-sidebar-open')).toBe('false');

    fireEvent.click(screen.getByTestId('menu-button'));

    expect(root?.getAttribute('data-sidebar-open')).toBe('true');
  });

  it('renders sidebar footer and settings slots', () => {
    const onSettingsOpen = vi.fn();

    render(
      <EditorShell
        noteId="note-123"
        onNoteSelect={vi.fn()}
        onSettingsOpen={onSettingsOpen}
        renderSidebarFooter={() => <div data-testid="sidebar-footer" />}
        renderSettingsButton={({ onOpen }) => (
          <button type="button" data-testid="settings-button" onClick={onOpen}>
            Settings
          </button>
        )}
      >
        <div data-testid="editor-content" />
      </EditorShell>
    );

    expect(screen.getByTestId('sidebar-footer')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-button'));
    expect(onSettingsOpen).toHaveBeenCalled();
  });

  it('renders menu button overlay when children are plain elements', () => {
    render(
      <EditorShell
        noteId="note-123"
        onNoteSelect={vi.fn()}
        renderMenuButton={() => <button data-testid="menu-button">Menu</button>}
      >
        <div data-testid="editor-content" />
      </EditorShell>
    );

    expect(screen.getByTestId('menu-button')).toBeInTheDocument();
  });

  it('renders titlebar drag region overlay when children are plain elements', () => {
    render(
      <EditorShell
        noteId="note-123"
        onNoteSelect={vi.fn()}
        renderTitlebarDragRegion={() => <div data-testid="titlebar-slot" />}
      >
        <div data-testid="editor-content" />
      </EditorShell>
    );

    expect(screen.getByTestId('titlebar-slot')).toBeInTheDocument();
  });

  it('injects menu button slot into editor content components', () => {
    const { container } = render(
      <EditorShell
        noteId="note-123"
        onNoteSelect={vi.fn()}
        renderMenuButton={() => <button data-testid="menu-button">Menu</button>}
      >
        <ShellContent />
      </EditorShell>
    );

    expect(screen.getByTestId('menu-button')).toBeInTheDocument();
    expect(container.querySelector('.note-editor-menu-button')).not.toBeInTheDocument();
  });

  it('passes the titlebar drag region slot to editor content', () => {
    render(
      <EditorShell
        noteId="note-123"
        onNoteSelect={vi.fn()}
        renderTitlebarDragRegion={() => <div data-testid="titlebar-slot" />}
      >
        <ShellContent />
      </EditorShell>
    );

    expect(screen.getByTestId('titlebar-slot')).toBeInTheDocument();
  });
});
