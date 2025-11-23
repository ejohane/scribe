import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface UseThemeReturn {
  /** Current active theme */
  theme: Theme;

  /** Resolved theme (system preference resolved to light/dark) */
  resolvedTheme: 'light' | 'dark';

  /** Set theme preference */
  setTheme: (theme: Theme) => void;
}

/**
 * Custom hook to manage theme state
 *
 * Features:
 * - Respects system preference when theme is 'system'
 * - Persists theme preference to config
 * - Applies theme by setting data-theme attribute on document root
 */
export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>('system');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Set initial value
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Load saved theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const config = await window.scribe.app.getConfig();
        if (config?.theme) {
          setThemeState(config.theme as Theme);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      }
    };

    loadTheme();
  }, []);

  // Calculate resolved theme
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  // Set theme and persist to config
  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);

    try {
      await window.scribe.app.setConfig({ theme: newTheme });
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  return {
    theme,
    resolvedTheme,
    setTheme,
  };
}
