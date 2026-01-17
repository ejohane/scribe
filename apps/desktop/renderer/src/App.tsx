/**
 * App.tsx
 *
 * Simplified root component with routing for the Scribe desktop app.
 * Uses HashRouter for Electron compatibility with file:// protocol.
 */

import { HashRouter, Routes, Route } from 'react-router-dom';
import { ElectronProvider } from './providers/ElectronProvider';
import { NoteListPage } from './pages/NoteListPage';
import { NoteEditorPage } from './pages/NoteEditorPage';

/**
 * Root application component.
 *
 * Route structure:
 * - / -> Note list (home)
 * - /note/:id -> Note editor
 */
export function App() {
  return (
    <HashRouter>
      <ElectronProvider>
        <Routes>
          <Route path="/" element={<NoteListPage />} />
          <Route path="/note/:id" element={<NoteEditorPage />} />
        </Routes>
      </ElectronProvider>
    </HashRouter>
  );
}

export default App;
