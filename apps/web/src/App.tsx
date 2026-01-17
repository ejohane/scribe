/**
 * App component
 *
 * Root application component for Scribe Web client.
 * Sets up routing and provides application-wide context using app-shell.
 */

import { type FC } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ScribeProvider, PlatformProvider, NoteListPage, NoteEditorPage } from '@scribe/app-shell';
import { ScribeEditor, type EditorContent as ScribeEditorContent } from '@scribe/editor';
import type { EditorContent } from '@scribe/client-sdk';
import { PluginProvider, PluginClientInitializer } from './plugins';
import { DAEMON_PORT, DAEMON_HOST } from './config';

const DAEMON_URL = `http://${DAEMON_HOST}:${DAEMON_PORT}`;

export interface AppProps {
  /** Optional router for testing (allows using MemoryRouter in tests) */
  router?: 'browser' | 'memory';
}

/**
 * Render function for the editor component.
 * Passed to NoteEditorPage to provide the actual editor implementation.
 *
 * Note: EditorContent types from @scribe/client-sdk and @scribe/editor are
 * structurally compatible but have different type definitions. We cast here
 * since both represent Lexical serialized editor state.
 */
function renderEditor(content: EditorContent, onChange: (content: EditorContent) => void) {
  return (
    <ScribeEditor
      initialContent={content as ScribeEditorContent}
      onChange={onChange as (content: ScribeEditorContent) => void}
      autoFocus
    />
  );
}

/**
 * Main App component with routing and providers.
 */
export const App: FC<AppProps> = () => {
  return (
    <BrowserRouter>
      <PlatformProvider platform="web" capabilities={{}}>
        <ScribeProvider daemonUrl={DAEMON_URL}>
          <PluginClientInitializer>
            <PluginProvider>
              <Routes>
                <Route path="/" element={<NoteListPage />} />
                <Route path="/note/:id" element={<NoteEditorPage renderEditor={renderEditor} />} />
              </Routes>
            </PluginProvider>
          </PluginClientInitializer>
        </ScribeProvider>
      </PlatformProvider>
    </BrowserRouter>
  );
};
