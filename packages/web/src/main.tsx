/**
 * @scribe/web
 *
 * Web client (MVP) for Scribe.
 * Provides a minimal browser-based interface for document editing.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';

export const VERSION = '0.0.0';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
