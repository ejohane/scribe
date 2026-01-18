/**
 * App.tsx
 *
 * Root component for the Scribe desktop app.
 * Uses HashRouter for Electron compatibility with file:// protocol.
 * Uses app-shell providers for platform-agnostic functionality.
 */

import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import {
  ScribeProvider,
  PlatformProvider,
  CollabProvider,
  NoteListPage,
  NoteEditorPage,
} from '@scribe/web-core';
import type { PlatformCapabilities, UpdateInfo, CollabEditorProps } from '@scribe/web-core';
import type { EditorContent } from '@scribe/client-sdk';
import { ScribeEditor, type EditorContent as ScribeEditorContent } from '@scribe/editor';

/**
 * Home page - redirects to notes list.
 */
function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/notes', { replace: true });
  }, [navigate]);

  return null;
}

/**
 * Notes page - displays all notes.
 */
function NotesPage() {
  return (
    <div className="h-screen w-screen bg-background">
      <NoteListPage />
    </div>
  );
}

/**
 * Root application component.
 *
 * Handles async daemon port resolution and sets up providers.
 *
 * Route structure:
 * - / -> Redirects to /notes
 * - /notes -> Note list
 * - /note/:id -> Note editor
 */
export function App() {
  const [daemonPort, setDaemonPort] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const port = await window.scribe.scribe.getDaemonPort();
        if (mounted) {
          setDaemonPort(port);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to get daemon port'));
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Show loading while getting daemon port
  if (!daemonPort && !error) {
    return <div style={{ padding: '2rem', color: '#666' }}>Loading...</div>;
  }

  // Show error if daemon port resolution failed
  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        <h2>Connection Error</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  const daemonUrl = `http://localhost:${daemonPort}`;

  // Platform capabilities for Electron
  const capabilities: PlatformCapabilities = {
    window: {
      openNewWindow: () => window.scribe.window.new(),
      openNoteInWindow: (id) => window.scribe.window.openNote(id),
      close: () => window.scribe.window.close(),
    },
    dialog: {
      selectFolder: () => window.scribe.dialog.selectFolder(),
      saveFile: async (_content, _filename) => {
        // TODO: Implement file save dialog
        return false;
      },
    },
    shell: {
      openExternal: (url) => window.scribe.shell.openExternal(url),
    },
    update: {
      check: () => window.scribe.update.check(),
      install: () => window.scribe.update.install(),
      onAvailable: (cb: (info: UpdateInfo) => void) => {
        return window.scribe.update.onAvailable((info) => {
          cb({ version: info.version });
        });
      },
    },
  };

  /**
   * Render function for the editor component.
   * Passed to NoteEditorPage to provide the actual editor implementation.
   * Supports collaborative editing when collabProps are provided.
   *
   * Note: EditorContent types from @scribe/client-sdk and @scribe/editor are
   * structurally compatible but have different type definitions. We cast here
   * since both represent Lexical serialized editor state.
   */
  function renderEditor(
    content: EditorContent,
    onChange: (content: EditorContent) => void,
    collabProps?: CollabEditorProps
  ) {
    return (
      <ScribeEditor
        initialContent={content as ScribeEditorContent}
        onChange={onChange as (content: ScribeEditorContent) => void}
        autoFocus
        yjsDoc={collabProps?.yjsDoc}
        YjsPlugin={collabProps?.YjsPlugin}
      />
    );
  }

  return (
    <HashRouter>
      <PlatformProvider platform="electron" capabilities={capabilities}>
        <ScribeProvider daemonUrl={daemonUrl}>
          <CollabProvider daemonUrl={daemonUrl}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/note/:id" element={<NoteEditorPage renderEditor={renderEditor} />} />
            </Routes>
          </CollabProvider>
        </ScribeProvider>
      </PlatformProvider>
    </HashRouter>
  );
}

export default App;
