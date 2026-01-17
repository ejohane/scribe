/**
 * App component
 *
 * Root application component for Scribe Web client.
 * Sets up routing and provides application-wide context using app-shell.
 */

import { type FC } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ScribeProvider, PlatformProvider, NoteListPage, NoteEditorPage } from '@scribe/app-shell';
import { PluginProvider, PluginClientInitializer } from './plugins';
import { DAEMON_PORT, DAEMON_HOST } from './config';

const DAEMON_URL = `http://${DAEMON_HOST}:${DAEMON_PORT}`;

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
      <PlatformProvider platform="web" capabilities={{}}>
        <ScribeProvider daemonUrl={DAEMON_URL}>
          <PluginClientInitializer>
            <PluginProvider>
              <Routes>
                <Route path="/" element={<NoteListPage />} />
                <Route path="/note/:id" element={<NoteEditorPage />} />
              </Routes>
            </PluginProvider>
          </PluginClientInitializer>
        </ScribeProvider>
      </PlatformProvider>
    </BrowserRouter>
  );
};
