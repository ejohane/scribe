import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppKeyboardShortcuts } from './useAppKeyboardShortcuts';

describe('useAppKeyboardShortcuts', () => {
  // Mock functions for all handlers
  const createMockConfig = () => ({
    isPaletteOpen: false,
    setPaletteMode: vi.fn(),
    openPalette: vi.fn(),
    createNote: vi.fn().mockResolvedValue(undefined),
    closePalette: vi.fn(),
    canGoBack: false,
    canGoForward: false,
    navigateBack: vi.fn(),
    navigateForward: vi.fn(),
    toggleSidebar: vi.fn(),
    toggleContextPanel: vi.fn(),
    hasCurrentNote: false,
    openShareMenu: vi.fn(),
  });

  // Helper to create and dispatch keyboard events
  const dispatchKeyEvent = (
    key: string,
    options: {
      metaKey?: boolean;
      ctrlKey?: boolean;
      shiftKey?: boolean;
    } = {}
  ) => {
    const event = new KeyboardEvent('keydown', {
      key,
      metaKey: options.metaKey ?? false,
      ctrlKey: options.ctrlKey ?? false,
      shiftKey: options.shiftKey ?? false,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    return event;
  };

  describe('event listener registration', () => {
    it('registers keyboard event listeners on mount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const config = createMockConfig();

      renderHook(() => useAppKeyboardShortcuts(config));

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      addEventListenerSpy.mockRestore();
    });

    it('unregisters listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const config = createMockConfig();

      const { unmount } = renderHook(() => useAppKeyboardShortcuts(config));
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Cmd+K (command palette)', () => {
    it('opens command palette in command mode when closed', () => {
      const config = createMockConfig();
      config.isPaletteOpen = false;

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent('k', { metaKey: true });
      });

      expect(config.setPaletteMode).toHaveBeenCalledWith('command');
      expect(config.openPalette).toHaveBeenCalled();
    });

    it('switches to command mode when palette is already open', () => {
      const config = createMockConfig();
      config.isPaletteOpen = true;

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent('k', { metaKey: true });
      });

      expect(config.setPaletteMode).toHaveBeenCalledWith('command');
      // openPalette should not be called since it's already open
      expect(config.openPalette).not.toHaveBeenCalled();
    });

    it('works with Ctrl+K as well', () => {
      const config = createMockConfig();
      config.isPaletteOpen = false;

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent('k', { ctrlKey: true });
      });

      expect(config.setPaletteMode).toHaveBeenCalledWith('command');
      expect(config.openPalette).toHaveBeenCalled();
    });
  });

  describe('Cmd+O (file browse)', () => {
    it('opens command palette in file-browse mode when closed', () => {
      const config = createMockConfig();
      config.isPaletteOpen = false;

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent('o', { metaKey: true });
      });

      expect(config.setPaletteMode).toHaveBeenCalledWith('file-browse');
      expect(config.openPalette).toHaveBeenCalled();
    });

    it('switches to file-browse mode when palette is already open', () => {
      const config = createMockConfig();
      config.isPaletteOpen = true;

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent('o', { metaKey: true });
      });

      expect(config.setPaletteMode).toHaveBeenCalledWith('file-browse');
      expect(config.openPalette).not.toHaveBeenCalled();
    });
  });

  describe('Cmd+N (create note)', () => {
    it('creates a new note', () => {
      const config = createMockConfig();

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent('n', { metaKey: true });
      });

      expect(config.closePalette).toHaveBeenCalled();
      expect(config.createNote).toHaveBeenCalled();
    });

    it('closes palette before creating note', () => {
      const config = createMockConfig();
      config.isPaletteOpen = true;

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent('n', { metaKey: true });
      });

      expect(config.closePalette).toHaveBeenCalled();
      expect(config.createNote).toHaveBeenCalled();
    });
  });

  describe('Cmd+[ (navigate back)', () => {
    it('navigates back when canGoBack is true', () => {
      const config = createMockConfig();
      config.canGoBack = true;

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent('[', { metaKey: true });
      });

      expect(config.navigateBack).toHaveBeenCalled();
    });

    it('does nothing when canGoBack is false', () => {
      const config = createMockConfig();
      config.canGoBack = false;

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent('[', { metaKey: true });
      });

      expect(config.navigateBack).not.toHaveBeenCalled();
    });
  });

  describe('Cmd+] (navigate forward)', () => {
    it('navigates forward when canGoForward is true', () => {
      const config = createMockConfig();
      config.canGoForward = true;

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent(']', { metaKey: true });
      });

      expect(config.navigateForward).toHaveBeenCalled();
    });

    it('does nothing when canGoForward is false', () => {
      const config = createMockConfig();
      config.canGoForward = false;

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent(']', { metaKey: true });
      });

      expect(config.navigateForward).not.toHaveBeenCalled();
    });
  });

  describe('Cmd+J (toggle sidebar)', () => {
    it('toggles sidebar', () => {
      const config = createMockConfig();

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent('j', { metaKey: true });
      });

      expect(config.toggleSidebar).toHaveBeenCalled();
    });
  });

  describe('Cmd+L (toggle context panel)', () => {
    it('toggles context panel', () => {
      const config = createMockConfig();

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent('l', { metaKey: true });
      });

      expect(config.toggleContextPanel).toHaveBeenCalled();
    });
  });

  describe('Cmd+Shift+E (share menu)', () => {
    it('opens share menu when note is visible', () => {
      const config = createMockConfig();
      config.hasCurrentNote = true;

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent('e', { metaKey: true, shiftKey: true });
      });

      expect(config.openShareMenu).toHaveBeenCalled();
    });

    it('does nothing when no note is visible', () => {
      const config = createMockConfig();
      config.hasCurrentNote = false;

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent('e', { metaKey: true, shiftKey: true });
      });

      expect(config.openShareMenu).not.toHaveBeenCalled();
    });

    it('works with uppercase E', () => {
      const config = createMockConfig();
      config.hasCurrentNote = true;

      renderHook(() => useAppKeyboardShortcuts(config));

      act(() => {
        dispatchKeyEvent('E', { metaKey: true, shiftKey: true });
      });

      expect(config.openShareMenu).toHaveBeenCalled();
    });
  });

  describe('event prevention', () => {
    it('prevents default for handled shortcuts', () => {
      const config = createMockConfig();
      const preventDefaultSpy = vi.fn();

      renderHook(() => useAppKeyboardShortcuts(config));

      // Create a custom event to test preventDefault
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'preventDefault', { value: preventDefaultSpy });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('dependency updates', () => {
    it('updates handlers when config changes', () => {
      const initialConfig = createMockConfig();
      const { rerender } = renderHook(({ config }) => useAppKeyboardShortcuts(config), {
        initialProps: { config: initialConfig },
      });

      // Navigate back should not be called initially (canGoBack is false)
      act(() => {
        dispatchKeyEvent('[', { metaKey: true });
      });
      expect(initialConfig.navigateBack).not.toHaveBeenCalled();

      // Update config to allow back navigation
      const updatedConfig = createMockConfig();
      updatedConfig.canGoBack = true;
      rerender({ config: updatedConfig });

      act(() => {
        dispatchKeyEvent('[', { metaKey: true });
      });
      expect(updatedConfig.navigateBack).toHaveBeenCalled();
    });
  });

  describe('non-shortcut keys', () => {
    it('does not trigger handlers for regular key presses', () => {
      const config = createMockConfig();

      renderHook(() => useAppKeyboardShortcuts(config));

      // Press 'k' without modifier
      act(() => {
        dispatchKeyEvent('k', {});
      });

      expect(config.openPalette).not.toHaveBeenCalled();
      expect(config.setPaletteMode).not.toHaveBeenCalled();
    });

    it('does not trigger handlers for unhandled modifier combinations', () => {
      const config = createMockConfig();

      renderHook(() => useAppKeyboardShortcuts(config));

      // Press 'x' with Cmd (not a registered shortcut)
      act(() => {
        dispatchKeyEvent('x', { metaKey: true });
      });

      expect(config.openPalette).not.toHaveBeenCalled();
      expect(config.createNote).not.toHaveBeenCalled();
      expect(config.toggleSidebar).not.toHaveBeenCalled();
    });
  });
});
