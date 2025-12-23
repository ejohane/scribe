/**
 * FindReplacePlugin Tests
 *
 * Integration tests for the FindReplacePlugin which provides:
 * - Cmd/Ctrl+F keyboard shortcut handling
 * - Open/close state management
 * - Portal rendering
 * - Focus management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { MarkNode } from '@lexical/mark';
import type { ReactNode } from 'react';

import { FindReplacePlugin } from './FindReplacePlugin';

// Test wrapper that provides Lexical context
function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'find-replace-plugin-test',
        nodes: [MarkNode],
        onError: (error) => {
          throw error;
        },
      }}
    >
      <RichTextPlugin
        contentEditable={<ContentEditable data-testid="editor" />}
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      {children}
    </LexicalComposer>
  );
}

// Mock scrollIntoView
const mockScrollIntoView = vi.fn();

describe('FindReplacePlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock scrollIntoView on Element prototype
    if (typeof Element !== 'undefined') {
      Element.prototype.scrollIntoView = mockScrollIntoView;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial state', () => {
    it('does not render FindReplaceBar initially', () => {
      render(
        <TestWrapper>
          <FindReplacePlugin />
        </TestWrapper>
      );

      // Search bar should not be visible
      expect(screen.queryByRole('search')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard shortcut', () => {
    it('opens search bar on Cmd+F', async () => {
      render(
        <TestWrapper>
          <FindReplacePlugin />
        </TestWrapper>
      );

      const editor = screen.getByTestId('editor');

      // Trigger Cmd+F
      fireEvent.keyDown(editor, { key: 'f', metaKey: true });

      // Search bar should appear
      await waitFor(() => {
        expect(screen.getByRole('search')).toBeInTheDocument();
      });
    });

    it('opens search bar on Ctrl+F', async () => {
      render(
        <TestWrapper>
          <FindReplacePlugin />
        </TestWrapper>
      );

      const editor = screen.getByTestId('editor');

      // Trigger Ctrl+F
      fireEvent.keyDown(editor, { key: 'f', ctrlKey: true });

      // Search bar should appear
      await waitFor(() => {
        expect(screen.getByRole('search')).toBeInTheDocument();
      });
    });

    it('prevents default browser find on Cmd+F', async () => {
      render(
        <TestWrapper>
          <FindReplacePlugin />
        </TestWrapper>
      );

      const editor = screen.getByTestId('editor');

      const event = new KeyboardEvent('keydown', {
        key: 'f',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      fireEvent(editor, event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('does not open search bar on just F key', async () => {
      render(
        <TestWrapper>
          <FindReplacePlugin />
        </TestWrapper>
      );

      const editor = screen.getByTestId('editor');

      // Trigger just F (no modifier)
      fireEvent.keyDown(editor, { key: 'f' });

      // Wait a moment
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // Search bar should not appear
      expect(screen.queryByRole('search')).not.toBeInTheDocument();
    });

    it('does not open search bar on Cmd+other key', async () => {
      render(
        <TestWrapper>
          <FindReplacePlugin />
        </TestWrapper>
      );

      const editor = screen.getByTestId('editor');

      // Trigger Cmd+G (not F)
      fireEvent.keyDown(editor, { key: 'g', metaKey: true });

      // Wait a moment
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // Search bar should not appear
      expect(screen.queryByRole('search')).not.toBeInTheDocument();
    });
  });

  describe('Search bar lifecycle', () => {
    it('closes search bar when close button is clicked', async () => {
      render(
        <TestWrapper>
          <FindReplacePlugin />
        </TestWrapper>
      );

      const editor = screen.getByTestId('editor');

      // Open search bar
      fireEvent.keyDown(editor, { key: 'f', metaKey: true });

      await waitFor(() => {
        expect(screen.getByRole('search')).toBeInTheDocument();
      });

      // Click close button
      const closeButton = screen.getByRole('button', { name: /close search/i });
      fireEvent.click(closeButton);

      // Search bar should be gone
      await waitFor(() => {
        expect(screen.queryByRole('search')).not.toBeInTheDocument();
      });
    });

    it('closes search bar on Escape key', async () => {
      render(
        <TestWrapper>
          <FindReplacePlugin />
        </TestWrapper>
      );

      const editor = screen.getByTestId('editor');

      // Open search bar
      fireEvent.keyDown(editor, { key: 'f', metaKey: true });

      await waitFor(() => {
        expect(screen.getByRole('search')).toBeInTheDocument();
      });

      // Press Escape in the search input
      const input = screen.getByPlaceholderText('Find...');
      fireEvent.keyDown(input, { key: 'Escape' });

      // Search bar should be gone
      await waitFor(() => {
        expect(screen.queryByRole('search')).not.toBeInTheDocument();
      });
    });

    it('auto-focuses search input when opened', async () => {
      render(
        <TestWrapper>
          <FindReplacePlugin />
        </TestWrapper>
      );

      const editor = screen.getByTestId('editor');

      // Open search bar
      fireEvent.keyDown(editor, { key: 'f', metaKey: true });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Find...')).toHaveFocus();
      });
    });
  });

  describe('Portal rendering', () => {
    it('renders FindReplaceBar in document.body', async () => {
      render(
        <TestWrapper>
          <FindReplacePlugin />
        </TestWrapper>
      );

      const editor = screen.getByTestId('editor');

      // Open search bar
      fireEvent.keyDown(editor, { key: 'f', metaKey: true });

      await waitFor(() => {
        expect(screen.getByRole('search')).toBeInTheDocument();
      });

      // Check that it's rendered in body (portal)
      const searchBar = screen.getByRole('search');
      expect(searchBar.parentElement).toBe(document.body);
    });
  });

  describe('Integration with FindReplaceBar', () => {
    it('renders all FindReplaceBar elements when open', async () => {
      render(
        <TestWrapper>
          <FindReplacePlugin />
        </TestWrapper>
      );

      const editor = screen.getByTestId('editor');

      // Open search bar
      fireEvent.keyDown(editor, { key: 'f', metaKey: true });

      await waitFor(() => {
        // Check for search bar elements
        expect(screen.getByPlaceholderText('Find...')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /previous match/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /next match/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /close search/i })).toBeInTheDocument();
      });
    });
  });

  describe('Reopening', () => {
    it('can reopen after closing', async () => {
      render(
        <TestWrapper>
          <FindReplacePlugin />
        </TestWrapper>
      );

      const editor = screen.getByTestId('editor');

      // Open search bar
      fireEvent.keyDown(editor, { key: 'f', metaKey: true });

      await waitFor(() => {
        expect(screen.getByRole('search')).toBeInTheDocument();
      });

      // Close it
      const closeButton = screen.getByRole('button', { name: /close search/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('search')).not.toBeInTheDocument();
      });

      // Reopen
      fireEvent.keyDown(editor, { key: 'f', metaKey: true });

      await waitFor(() => {
        expect(screen.getByRole('search')).toBeInTheDocument();
      });
    });
  });
});
