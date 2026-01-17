/**
 * App component
 *
 * Root application component for Scribe Web client.
 * Sets up routing and provides application-wide context.
 */

import { type FC } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ScribeProvider } from './providers/ScribeProvider';
import { PluginProvider, PluginClientInitializer } from './plugins';
import { NoteListPage } from './pages/NoteListPage';
import { NoteEditorPage } from './pages/NoteEditorPage';

export interface AppProps {
  /** Optional router for testing (allows using MemoryRouter in tests) */
  router?: 'browser' | 'memory';
}

/**
 * Main App component with routing and providers.
 */
export const App: FC<AppProps> = () => {
  return (
    <BrowserRouter>
      <ScribeProvider>
        <PluginClientInitializer>
          <PluginProvider>
            <Routes>
              <Route path="/" element={<NoteListPage />} />
              <Route path="/note/:id" element={<NoteEditorPage />} />
            </Routes>
          </PluginProvider>
        </PluginClientInitializer>
      </ScribeProvider>
    </BrowserRouter>
  );
};
