import { useEffect } from 'react';
import type { PaletteMode } from '../commands/types';

interface UseAppKeyboardShortcutsConfig {
  /** Whether the command palette is currently open */
  isPaletteOpen: boolean;
  /** Set the palette mode */
  setPaletteMode: (mode: PaletteMode) => void;
  /** Open the command palette */
  openPalette: () => void;
  /** Create a new note */
  createNote: () => Promise<void>;
  /** Close the palette */
  closePalette: () => void;
  /** Whether back navigation is available */
  canGoBack: boolean;
  /** Whether forward navigation is available */
  canGoForward: boolean;
  /** Navigate back */
  navigateBack: () => void;
  /** Navigate forward */
  navigateForward: () => void;
  /** Toggle sidebar visibility */
  toggleSidebar: () => void;
  /** Toggle context panel visibility */
  toggleContextPanel: () => void;
}

/**
 * Custom hook for handling app-level keyboard shortcuts
 *
 * Shortcuts:
 * - Cmd+K: Toggle command palette (command mode)
 * - Cmd+O: Toggle command palette (file-browse mode)
 * - Cmd+N: Create new note
 * - Cmd+[: Navigate back
 * - Cmd+]: Navigate forward
 * - Cmd+J: Toggle left sidebar
 * - Cmd+L: Toggle right context panel
 *
 * @param config - Configuration for keyboard shortcut behavior
 */
export function useAppKeyboardShortcuts(config: UseAppKeyboardShortcutsConfig): void {
  const {
    isPaletteOpen,
    setPaletteMode,
    openPalette,
    createNote,
    closePalette,
    canGoBack,
    canGoForward,
    navigateBack,
    navigateForward,
    toggleSidebar,
    toggleContextPanel,
  } = config;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K: toggle palette in command mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isPaletteOpen) {
          // If already open, switch to command mode
          setPaletteMode('command');
        } else {
          // Open in command mode
          setPaletteMode('command');
          openPalette();
        }
      }
      // Cmd+O: open palette in file-browse mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        if (isPaletteOpen) {
          // If already open, switch to file-browse mode
          setPaletteMode('file-browse');
        } else {
          // Open in file-browse mode
          setPaletteMode('file-browse');
          openPalette();
        }
      }
      // Cmd+N: create new note
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        closePalette();
        createNote();
      }
      // Cmd+[ / Ctrl+[: Navigate back through wiki-link history
      if ((e.metaKey || e.ctrlKey) && e.key === '[') {
        e.preventDefault();
        if (canGoBack) {
          navigateBack();
        }
      }
      // Cmd+] / Ctrl+]: Navigate forward through wiki-link history
      if ((e.metaKey || e.ctrlKey) && e.key === ']') {
        e.preventDefault();
        if (canGoForward) {
          navigateForward();
        }
      }
      // Cmd+J / Ctrl+J: Toggle left sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        toggleSidebar();
      }
      // Cmd+L / Ctrl+L: Toggle right context panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        toggleContextPanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPaletteOpen,
    setPaletteMode,
    openPalette,
    createNote,
    closePalette,
    canGoBack,
    canGoForward,
    navigateBack,
    navigateForward,
    toggleSidebar,
    toggleContextPanel,
  ]);
}
