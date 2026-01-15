/**
 * @scribe/web
 *
 * Web client (MVP) for Scribe.
 * Provides a minimal browser-based interface for document editing.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const VERSION = '0.0.0';

function App() {
  return (
    <div>
      <h1>Scribe Web</h1>
      <p>Web client - not yet implemented</p>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
