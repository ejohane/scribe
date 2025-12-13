import { useState, useCallback, useRef, useMemo } from 'react';
import type { PaletteMode } from '../commands/types';

/** Type for the prompt input resolver function */
type PromptInputResolver = (value: string | undefined) => void;

interface UseCommandPaletteReturn {
  /** Whether the command palette is open */
  isOpen: boolean;
  /** Current palette mode */
  mode: PaletteMode;
  /** Placeholder text for prompt input mode */
  promptPlaceholder: string;
  /** Open the palette (defaults to command mode) */
  open: (mode?: PaletteMode) => void;
  /** Close the palette */
  close: () => void;
  /** Set the palette mode */
  setMode: (mode: PaletteMode) => void;
  /**
   * Prompt user for text input with a modal dialog.
   * Returns the entered text, or undefined if cancelled.
   */
  promptInput: (placeholder: string) => Promise<string | undefined>;
  /**
   * Resolve a pending prompt input.
   * Called when the user submits or cancels the prompt.
   */
  resolvePrompt: (value: string | undefined) => void;
}

/**
 * Custom hook for managing command palette state
 *
 * Provides:
 * - Open/close state
 * - Mode switching (command, file-browse, delete-browse, etc.)
 * - Text input prompt functionality
 */
export function useCommandPalette(): UseCommandPaletteReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setModeState] = useState<PaletteMode>('command');
  const [promptPlaceholder, setPromptPlaceholder] = useState('');

  // Ref to track the current prompt resolver
  const promptResolverRef = useRef<PromptInputResolver | null>(null);

  const open = useCallback((newMode: PaletteMode = 'command') => {
    setModeState(newMode);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    // If we're in prompt-input mode, resolve the promise with undefined
    if (promptResolverRef.current) {
      promptResolverRef.current(undefined);
      promptResolverRef.current = null;
    }
    setIsOpen(false);
  }, []);

  const setMode = useCallback((newMode: PaletteMode) => {
    setModeState(newMode);
  }, []);

  const promptInput = useCallback((placeholder: string): Promise<string | undefined> => {
    return new Promise<string | undefined>((resolve) => {
      setPromptPlaceholder(placeholder);
      promptResolverRef.current = resolve;
      setModeState('prompt-input');
      setIsOpen(true);
    });
  }, []);

  const resolvePrompt = useCallback((value: string | undefined) => {
    if (promptResolverRef.current) {
      promptResolverRef.current(value);
      promptResolverRef.current = null;
    }
    setIsOpen(false);
  }, []);

  return useMemo(
    () => ({
      isOpen,
      mode,
      promptPlaceholder,
      open,
      close,
      setMode,
      promptInput,
      resolvePrompt,
    }),
    [isOpen, mode, promptPlaceholder, open, close, setMode, promptInput, resolvePrompt]
  );
}
