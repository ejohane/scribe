/**
 * Tests for SlashCommandContext
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import {
  SlashCommandProvider,
  useSlashCommandContext,
  type SlashCommandProviderConfig,
} from './SlashCommandContext';
import type { LexicalEditor } from 'lexical';

// Mock Lexical imports
vi.mock('lexical', () => ({
  $getSelection: vi.fn(() => ({
    insertText: vi.fn(),
    insertNodes: vi.fn(),
  })),
  $isRangeSelection: vi.fn(() => true),
}));

// Mock editor
const createMockEditor = () =>
  ({
    update: vi.fn((callback: () => void) => callback()),
    getEditorState: vi.fn(),
    registerUpdateListener: vi.fn(),
  }) as unknown as LexicalEditor;

describe('SlashCommandContext', () => {
  describe('SlashCommandProvider', () => {
    it('provides context to children', () => {
      const config: SlashCommandProviderConfig = {
        editor: createMockEditor(),
        showToast: vi.fn(),
        closeMenu: vi.fn(),
        noteId: 'test-note',
      };

      function TestConsumer() {
        const ctx = useSlashCommandContext();
        return <div data-testid="has-context">{ctx.noteId}</div>;
      }

      render(
        <SlashCommandProvider config={config}>
          <TestConsumer />
        </SlashCommandProvider>
      );

      expect(screen.getByTestId('has-context')).toHaveTextContent('test-note');
    });

    it('provides editor instance', () => {
      const editor = createMockEditor();
      const config: SlashCommandProviderConfig = {
        editor,
        showToast: vi.fn(),
        closeMenu: vi.fn(),
      };

      function TestConsumer() {
        const ctx = useSlashCommandContext();
        return <div data-testid="editor">{ctx.editor ? 'has-editor' : 'no-editor'}</div>;
      }

      render(
        <SlashCommandProvider config={config}>
          <TestConsumer />
        </SlashCommandProvider>
      );

      expect(screen.getByTestId('editor')).toHaveTextContent('has-editor');
    });
  });

  describe('useSlashCommandContext', () => {
    it('throws when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      function TestConsumer() {
        useSlashCommandContext();
        return null;
      }

      expect(() => render(<TestConsumer />)).toThrow(
        'useSlashCommandContext must be used within a SlashCommandProvider'
      );

      consoleSpy.mockRestore();
    });

    it('provides insertText function that calls editor.update', () => {
      const editor = createMockEditor();
      const config: SlashCommandProviderConfig = {
        editor,
        showToast: vi.fn(),
        closeMenu: vi.fn(),
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SlashCommandProvider config={config}>{children}</SlashCommandProvider>
      );

      const { result } = renderHook(() => useSlashCommandContext(), { wrapper });

      act(() => {
        result.current.insertText('test');
      });

      expect(editor.update).toHaveBeenCalled();
    });

    it('provides insertNode function that calls editor.update', () => {
      const editor = createMockEditor();
      const config: SlashCommandProviderConfig = {
        editor,
        showToast: vi.fn(),
        closeMenu: vi.fn(),
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SlashCommandProvider config={config}>{children}</SlashCommandProvider>
      );

      const { result } = renderHook(() => useSlashCommandContext(), { wrapper });

      const mockNode = {} as never;
      act(() => {
        result.current.insertNode(mockNode);
      });

      expect(editor.update).toHaveBeenCalled();
    });

    it('provides toast function that calls showToast', () => {
      const showToast = vi.fn();
      const config: SlashCommandProviderConfig = {
        editor: createMockEditor(),
        showToast,
        closeMenu: vi.fn(),
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SlashCommandProvider config={config}>{children}</SlashCommandProvider>
      );

      const { result } = renderHook(() => useSlashCommandContext(), { wrapper });

      act(() => {
        result.current.toast('Test message', 'success');
      });

      expect(showToast).toHaveBeenCalledWith('Test message', 'success');
    });

    it('maps info toast type to success', () => {
      const showToast = vi.fn();
      const config: SlashCommandProviderConfig = {
        editor: createMockEditor(),
        showToast,
        closeMenu: vi.fn(),
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SlashCommandProvider config={config}>{children}</SlashCommandProvider>
      );

      const { result } = renderHook(() => useSlashCommandContext(), { wrapper });

      act(() => {
        result.current.toast('Test message', 'info');
      });

      expect(showToast).toHaveBeenCalledWith('Test message', 'success');
    });

    it('provides close function that calls closeMenu', () => {
      const closeMenu = vi.fn();
      const config: SlashCommandProviderConfig = {
        editor: createMockEditor(),
        showToast: vi.fn(),
        closeMenu,
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SlashCommandProvider config={config}>{children}</SlashCommandProvider>
      );

      const { result } = renderHook(() => useSlashCommandContext(), { wrapper });

      act(() => {
        result.current.close();
      });

      expect(closeMenu).toHaveBeenCalled();
    });

    it('provides noteId from config', () => {
      const config: SlashCommandProviderConfig = {
        editor: createMockEditor(),
        showToast: vi.fn(),
        closeMenu: vi.fn(),
        noteId: 'my-note-id',
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SlashCommandProvider config={config}>{children}</SlashCommandProvider>
      );

      const { result } = renderHook(() => useSlashCommandContext(), { wrapper });

      expect(result.current.noteId).toBe('my-note-id');
    });

    it('noteId is undefined when not provided', () => {
      const config: SlashCommandProviderConfig = {
        editor: createMockEditor(),
        showToast: vi.fn(),
        closeMenu: vi.fn(),
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SlashCommandProvider config={config}>{children}</SlashCommandProvider>
      );

      const { result } = renderHook(() => useSlashCommandContext(), { wrapper });

      expect(result.current.noteId).toBeUndefined();
    });
  });
});
