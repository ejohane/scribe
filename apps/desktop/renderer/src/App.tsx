/**
 * App.tsx
 *
 * Root component for the Scribe desktop app.
 * Uses HashRouter for Electron compatibility with file:// protocol.
 * Uses app-shell providers for platform-agnostic functionality.
 */

import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ScribeProvider, PlatformProvider, NoteListPage, NoteEditorPage } from '@scribe/app-shell';
import type { PlatformCapabilities, UpdateInfo } from '@scribe/app-shell';

/**
 * Root application component.
 *
 * Handles async daemon port resolution and sets up providers.
 *
 * Route structure:
 * - / -> Note list (home)
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

  return (
    <HashRouter>
      <PlatformProvider platform="electron" capabilities={capabilities}>
        <ScribeProvider daemonUrl={daemonUrl}>
          <Routes>
            <Route path="/" element={<NoteListPage />} />
            <Route path="/note/:id" element={<NoteEditorPage />} />
          </Routes>
        </ScribeProvider>
      </PlatformProvider>
    </HashRouter>
  );
}

export default App;
