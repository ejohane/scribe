import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { lightTheme } from './themes/light.css';
import { darkTheme } from './themes/dark.css';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeStorage {
  getTheme: () => Promise<Theme | null> | Theme | null;
  setTheme: (theme: Theme) => Promise<void> | void;
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  storage?: ThemeStorage;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'scribe-theme',
  storage,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Load theme from storage on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        let savedTheme: Theme | null = null;

        if (storage) {
          // Use custom storage adapter
          savedTheme = await storage.getTheme();
        } else if (typeof window !== 'undefined') {
          // Use localStorage by default
          savedTheme = localStorage.getItem(storageKey) as Theme;
        }

        if (savedTheme) {
          setThemeState(savedTheme);
        }
      } catch (error) {
        // eslint-disable-next-line no-console -- Browser-side theme loading error, acceptable for design-system
        console.error('Failed to load theme preference:', error);
      }
    };

    loadTheme();
  }, [storageKey, storage]);

  useEffect(() => {
    const resolve = () => {
      if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return theme;
    };
    setResolvedTheme(resolve());

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        setResolvedTheme(resolve());
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  useEffect(() => {
    // Apply theme class to root
    document.documentElement.classList.remove(lightTheme, darkTheme);
    document.documentElement.classList.add(resolvedTheme === 'dark' ? darkTheme : lightTheme);
  }, [resolvedTheme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);

    try {
      if (storage) {
        // Use custom storage adapter
        await storage.setTheme(newTheme);
      } else if (typeof window !== 'undefined') {
        // Use localStorage by default
        localStorage.setItem(storageKey, newTheme);
      }
    } catch (error) {
      // eslint-disable-next-line no-console -- Browser-side theme saving error, acceptable for design-system
      console.error('Failed to save theme preference:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
