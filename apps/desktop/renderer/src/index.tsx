import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, type ThemeStorage } from '@scribe/design-system';
import App from './App';
import './global.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

// Create Electron IPC storage adapter for ThemeProvider
const electronThemeStorage: ThemeStorage = {
  getTheme: async () => {
    try {
      const config = await window.scribe.app.getConfig();
      return (config?.theme as 'light' | 'dark' | 'system') || null;
    } catch (error) {
      console.error('Failed to load theme from config:', error);
      return null;
    }
  },
  setTheme: async (theme) => {
    try {
      await window.scribe.app.setConfig({ theme });
    } catch (error) {
      console.error('Failed to save theme to config:', error);
    }
  },
};

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider storage={electronThemeStorage} defaultTheme="system">
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
