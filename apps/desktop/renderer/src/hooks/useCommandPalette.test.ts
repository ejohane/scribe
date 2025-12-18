import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommandPalette } from './useCommandPalette';

describe('useCommandPalette', () => {
  describe('initial state', () => {
    it('starts with palette closed', () => {
      const { result } = renderHook(() => useCommandPalette());

      expect(result.current.isOpen).toBe(false);
    });

    it('starts in command mode', () => {
      const { result } = renderHook(() => useCommandPalette());

      expect(result.current.mode).toBe('command');
    });

    it('starts with empty prompt placeholder', () => {
      const { result } = renderHook(() => useCommandPalette());

      expect(result.current.promptPlaceholder).toBe('');
    });
  });

  describe('open function', () => {
    it('opens the palette', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('defaults to command mode when no mode specified', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open();
      });

      expect(result.current.mode).toBe('command');
    });

    it('opens in specified mode', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open('file-browse');
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.mode).toBe('file-browse');
    });

    it('opens in delete-browse mode', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open('delete-browse');
      });

      expect(result.current.mode).toBe('delete-browse');
    });

    it('opens in person-browse mode', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open('person-browse');
      });

      expect(result.current.mode).toBe('person-browse');
    });
  });

  describe('close function', () => {
    it('closes the palette', () => {
      const { result } = renderHook(() => useCommandPalette());

      // Open first
      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);

      // Then close
      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('can close from any mode', () => {
      const { result } = renderHook(() => useCommandPalette());

      // Open in file-browse mode
      act(() => {
        result.current.open('file-browse');
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.mode).toBe('file-browse');

      // Close
      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('setMode function', () => {
    it('changes the palette mode', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open();
      });

      expect(result.current.mode).toBe('command');

      act(() => {
        result.current.setMode('file-browse');
      });

      expect(result.current.mode).toBe('file-browse');
    });

    it('can set mode without opening palette', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.setMode('delete-confirm');
      });

      expect(result.current.mode).toBe('delete-confirm');
      expect(result.current.isOpen).toBe(false);
    });

    it('can cycle through all modes', () => {
      const { result } = renderHook(() => useCommandPalette());

      const modes = [
        'command',
        'file-browse',
        'delete-browse',
        'delete-confirm',
        'person-browse',
        'prompt-input',
      ] as const;

      for (const mode of modes) {
        act(() => {
          result.current.setMode(mode);
        });

        expect(result.current.mode).toBe(mode);
      }
    });
  });

  describe('promptInput function', () => {
    it('opens palette in prompt-input mode', async () => {
      const { result } = renderHook(() => useCommandPalette());

      let promptPromise: Promise<string | undefined>;

      act(() => {
        promptPromise = result.current.promptInput('Enter title');
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.mode).toBe('prompt-input');
      expect(result.current.promptPlaceholder).toBe('Enter title');

      // Resolve the prompt to clean up
      act(() => {
        result.current.resolvePrompt(undefined);
      });

      const promptResult = await promptPromise!;
      expect(promptResult).toBeUndefined();
    });

    it('resolves with user input when resolvePrompt is called with value', async () => {
      const { result } = renderHook(() => useCommandPalette());

      let promptPromise: Promise<string | undefined>;

      act(() => {
        promptPromise = result.current.promptInput('Enter name');
      });

      act(() => {
        result.current.resolvePrompt('Test Value');
      });

      const promptResult = await promptPromise!;
      expect(promptResult).toBe('Test Value');
    });

    it('resolves with undefined when resolvePrompt is called with undefined', async () => {
      const { result } = renderHook(() => useCommandPalette());

      let promptPromise: Promise<string | undefined>;

      act(() => {
        promptPromise = result.current.promptInput('Enter something');
      });

      act(() => {
        result.current.resolvePrompt(undefined);
      });

      const promptResult = await promptPromise!;
      expect(promptResult).toBeUndefined();
    });

    it('closes palette when resolvePrompt is called', async () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.promptInput('Prompt');
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.resolvePrompt('value');
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('close function with prompt', () => {
    it('resolves pending prompt with undefined when close is called', async () => {
      const { result } = renderHook(() => useCommandPalette());

      let promptPromise: Promise<string | undefined>;

      act(() => {
        promptPromise = result.current.promptInput('Enter text');
      });

      expect(result.current.isOpen).toBe(true);

      // Close the palette instead of resolving
      act(() => {
        result.current.close();
      });

      const promptResult = await promptPromise!;
      expect(promptResult).toBeUndefined();
      expect(result.current.isOpen).toBe(false);
    });

    it('handles close when no prompt is pending', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open();
      });

      // Close should work fine without a pending prompt
      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('resolvePrompt function', () => {
    it('only resolves once even if called multiple times', async () => {
      const { result } = renderHook(() => useCommandPalette());

      let promptPromise: Promise<string | undefined>;

      act(() => {
        promptPromise = result.current.promptInput('Enter value');
      });

      // Resolve multiple times
      act(() => {
        result.current.resolvePrompt('first');
      });

      act(() => {
        result.current.resolvePrompt('second');
      });

      const promptResult = await promptPromise!;
      // Should be the first value
      expect(promptResult).toBe('first');
    });

    it('does nothing when no prompt is pending', () => {
      const { result } = renderHook(() => useCommandPalette());

      // Should not throw
      act(() => {
        result.current.resolvePrompt('some value');
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('return value stability', () => {
    it('returns memoized object when dependencies do not change', () => {
      const { result, rerender } = renderHook(() => useCommandPalette());

      const firstReturn = result.current;

      // Rerender without changes
      rerender();

      // The object reference should be stable due to useMemo
      expect(result.current).toBe(firstReturn);
    });

    it('function references are stable across rerenders', () => {
      const { result, rerender } = renderHook(() => useCommandPalette());

      const firstOpen = result.current.open;
      const firstClose = result.current.close;
      const firstSetMode = result.current.setMode;
      const firstPromptInput = result.current.promptInput;
      const firstResolvePrompt = result.current.resolvePrompt;

      rerender();

      expect(result.current.open).toBe(firstOpen);
      expect(result.current.close).toBe(firstClose);
      expect(result.current.setMode).toBe(firstSetMode);
      expect(result.current.promptInput).toBe(firstPromptInput);
      expect(result.current.resolvePrompt).toBe(firstResolvePrompt);
    });
  });

  describe('edge cases', () => {
    it('handles rapid open/close cycles', () => {
      const { result } = renderHook(() => useCommandPalette());

      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.open();
        });
        expect(result.current.isOpen).toBe(true);

        act(() => {
          result.current.close();
        });
        expect(result.current.isOpen).toBe(false);
      }
    });

    it('handles rapid mode changes', () => {
      const { result } = renderHook(() => useCommandPalette());

      const modes = [
        'command',
        'file-browse',
        'delete-browse',
        'command',
        'person-browse',
      ] as const;

      for (const mode of modes) {
        act(() => {
          result.current.setMode(mode);
        });
        expect(result.current.mode).toBe(mode);
      }
    });

    it('handles opening while already open', () => {
      const { result } = renderHook(() => useCommandPalette());

      act(() => {
        result.current.open('command');
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.mode).toBe('command');

      // Open again with different mode
      act(() => {
        result.current.open('file-browse');
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.mode).toBe('file-browse');
    });

    it('handles closing while already closed', () => {
      const { result } = renderHook(() => useCommandPalette());

      expect(result.current.isOpen).toBe(false);

      // Close while already closed
      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });
});
