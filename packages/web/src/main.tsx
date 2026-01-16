/**
 * @scribe/web
 *
 * Web client (MVP) for Scribe.
 * Provides a minimal browser-based interface for document editing.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
