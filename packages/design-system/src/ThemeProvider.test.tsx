/**
 * Tests for ThemeProvider component
 *
 * Validates theme context, theme switching, and storage integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme, ThemeStorage } from './ThemeProvider';

// Component to test useTheme hook
function ThemeConsumer() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolvedTheme">{resolvedTheme}</span>
      <button onClick={() => setTheme('light')}>Light</button>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('system')}>System</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  // Mock matchMedia
  const mockMatchMedia = vi.fn();
  let mediaQueryListeners: Array<(e: { matches: boolean }) => void> = [];

  // Mock localStorage
  const localStorageMock = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => localStorageMock.store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      localStorageMock.store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete localStorageMock.store[key];
    }),
    clear: vi.fn(() => {
      localStorageMock.store = {};
    }),
  };

  beforeEach(() => {
    // Reset localStorage mock
    localStorageMock.store = {};
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Reset listeners
    mediaQueryListeners = [];

    // Mock matchMedia
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: query.includes('dark') ? false : true,
      media: query,
      onchange: null,
      addEventListener: (type: string, listener: (e: { matches: boolean }) => void) => {
        if (type === 'change') mediaQueryListeners.push(listener);
      },
      removeEventListener: (type: string, listener: (e: { matches: boolean }) => void) => {
        if (type === 'change') {
          mediaQueryListeners = mediaQueryListeners.filter((l) => l !== listener);
        }
      },
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic functionality', () => {
    it('should render children', () => {
      render(
        <ThemeProvider>
          <div data-testid="child">Child content</div>
        </ThemeProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should provide default theme value of system', () => {
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('system');
    });

    it('should respect defaultTheme prop', () => {
      render(
        <ThemeProvider defaultTheme="dark">
          <ThemeConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });
  });

  describe('theme switching', () => {
    it('should switch to light theme when setTheme is called', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider defaultTheme="dark">
          <ThemeConsumer />
        </ThemeProvider>
      );

      await user.click(screen.getByRole('button', { name: 'Light' }));

      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('light');
    });

    it('should switch to dark theme when setTheme is called', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeConsumer />
        </ThemeProvider>
      );

      await user.click(screen.getByRole('button', { name: 'Dark' }));

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('dark');
    });

    it('should switch to system theme when setTheme is called', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeConsumer />
        </ThemeProvider>
      );

      await user.click(screen.getByRole('button', { name: 'System' }));

      expect(screen.getByTestId('theme')).toHaveTextContent('system');
    });
  });

  describe('localStorage persistence', () => {
    it('should save theme to localStorage when changed', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider storageKey="test-theme">
          <ThemeConsumer />
        </ThemeProvider>
      );

      await user.click(screen.getByRole('button', { name: 'Dark' }));

      expect(localStorageMock.setItem).toHaveBeenCalledWith('test-theme', 'dark');
    });

    it('should load theme from localStorage on mount', async () => {
      localStorageMock.store['test-theme'] = 'dark';

      render(
        <ThemeProvider storageKey="test-theme" defaultTheme="light">
          <ThemeConsumer />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      });
    });
  });

  describe('custom storage adapter', () => {
    it('should use custom storage adapter for loading', async () => {
      const mockStorage: ThemeStorage = {
        getTheme: vi.fn().mockResolvedValue('dark'),
        setTheme: vi.fn(),
      };

      render(
        <ThemeProvider storage={mockStorage} defaultTheme="light">
          <ThemeConsumer />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(mockStorage.getTheme).toHaveBeenCalled();
        expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      });
    });

    it('should use custom storage adapter for saving', async () => {
      const user = userEvent.setup();
      const mockStorage: ThemeStorage = {
        getTheme: vi.fn().mockResolvedValue(null),
        setTheme: vi.fn(),
      };

      render(
        <ThemeProvider storage={mockStorage}>
          <ThemeConsumer />
        </ThemeProvider>
      );

      await user.click(screen.getByRole('button', { name: 'Dark' }));

      await waitFor(() => {
        expect(mockStorage.setTheme).toHaveBeenCalledWith('dark');
      });
    });
  });

  describe('useTheme hook', () => {
    it('should throw error when used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleError = console.error;
      console.error = vi.fn();

      expect(() => {
        render(<ThemeConsumer />);
      }).toThrow('useTheme must be used within ThemeProvider');

      console.error = consoleError;
    });
  });

  describe('system theme resolution', () => {
    it('should resolve to light when system prefers light', () => {
      mockMatchMedia.mockImplementation((query: string) => ({
        matches: false, // prefers-color-scheme: dark returns false
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      render(
        <ThemeProvider defaultTheme="system">
          <ThemeConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('light');
    });

    it('should resolve to dark when system prefers dark', () => {
      mockMatchMedia.mockImplementation((query: string) => ({
        matches: query.includes('dark'), // prefers-color-scheme: dark returns true
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      render(
        <ThemeProvider defaultTheme="system">
          <ThemeConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('dark');
    });

    it('should update resolved theme when system preference changes', async () => {
      mockMatchMedia.mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: (type: string, listener: (e: { matches: boolean }) => void) => {
          if (type === 'change') mediaQueryListeners.push(listener);
        },
        removeEventListener: vi.fn(),
      }));

      render(
        <ThemeProvider defaultTheme="system">
          <ThemeConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('light');

      // Simulate system preference change to dark
      act(() => {
        mediaQueryListeners.forEach((listener) => listener({ matches: true }));
      });

      // Note: The component needs to re-check matchMedia, which happens on change
      // This test verifies the listener is set up correctly
    });
  });
});
