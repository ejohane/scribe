/**
 * FindReplaceBar Component Tests
 *
 * Tests for the FindReplaceBar UI component including:
 * - Rendering and layout
 * - Keyboard shortcuts
 * - Accessibility features
 * - User interactions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
// Note: Lexical primitives available if needed for future tests
// import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import { MarkNode } from '@lexical/mark';
import type { ReactNode } from 'react';

import { FindReplaceBar } from './FindReplaceBar';

// Test wrapper that provides Lexical context
function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'find-replace-bar-test',
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

// Note: Helper available for debounce tests if needed
// const waitForDebounce = () => new Promise((r) => setTimeout(r, SEARCH_DEBOUNCE_MS + 50));

describe('FindReplaceBar', () => {
  let onCloseMock: ReturnType<typeof vi.fn>;
  const mockScrollIntoView = vi.fn();

  beforeEach(() => {
    onCloseMock = vi.fn();
    vi.clearAllMocks();

    // Mock scrollIntoView
    if (typeof Element !== 'undefined') {
      Element.prototype.scrollIntoView = mockScrollIntoView;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders all UI elements', () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      // Search input
      expect(screen.getByRole('textbox', { name: /search text/i })).toBeInTheDocument();

      // Navigation buttons
      expect(screen.getByRole('button', { name: /previous match/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next match/i })).toBeInTheDocument();

      // Close button
      expect(screen.getByRole('button', { name: /close search/i })).toBeInTheDocument();
    });

    it('renders with role="search"', () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      expect(screen.getByRole('search')).toBeInTheDocument();
    });

    it('auto-focuses input on mount', async () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} autoFocus={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Find...')).toHaveFocus();
      });
    });

    it('does not auto-focus when autoFocus is false', async () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} autoFocus={false} />
        </TestWrapper>
      );

      // Give it a moment
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(screen.getByPlaceholderText('Find...')).not.toHaveFocus();
    });
  });

  describe('Search input', () => {
    it('updates query on typing', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Find...');
      await user.type(input, 'test');

      expect(input).toHaveValue('test');
    });

    it('has correct placeholder', () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      expect(screen.getByPlaceholderText('Find...')).toBeInTheDocument();
    });

    it('has correct ARIA attributes', () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Find...');
      expect(input).toHaveAttribute('aria-label', 'Search text');
      expect(input).toHaveAttribute('aria-describedby', 'match-count');
    });
  });

  describe('Match counter', () => {
    it('shows empty when no query', () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      // Match count should be empty or minimal
      const counter = screen.getByLabelText(/find in document/i).querySelector('#match-count');
      expect(counter).toBeInTheDocument();
      expect(counter?.textContent).toBe('');
    });

    it('has aria-live="polite" for screen readers', () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      const counter = document.getElementById('match-count');
      expect(counter).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Navigation buttons', () => {
    it('disables navigation buttons when no results', () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /previous match/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /next match/i })).toBeDisabled();
    });

    it('has correct title attributes for tooltips', () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /previous match/i })).toHaveAttribute(
        'title',
        'Previous match (Shift+Enter)'
      );
      expect(screen.getByRole('button', { name: /next match/i })).toHaveAttribute(
        'title',
        'Next match (Enter)'
      );
    });
  });

  describe('Close button', () => {
    it('calls onClose when clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      await user.click(screen.getByRole('button', { name: /close search/i }));

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('has correct title attribute', () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /close search/i })).toHaveAttribute(
        'title',
        'Close search (Escape)'
      );
    });
  });

  describe('Keyboard shortcuts', () => {
    it('closes on Escape key', async () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Find...');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('prevents default on Escape', async () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Find...');
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      fireEvent(input, event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('handles Enter key', async () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Find...');
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      fireEvent(input, event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('handles Shift+Enter key', async () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Find...');
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      fireEvent(input, event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('handles Cmd+G key', async () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Find...');
      const event = new KeyboardEvent('keydown', {
        key: 'g',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      fireEvent(input, event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('handles Cmd+Shift+G key', async () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Find...');
      const event = new KeyboardEvent('keydown', {
        key: 'g',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      fireEvent(input, event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has accessible search region', () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      const searchRegion = screen.getByRole('search');
      expect(searchRegion).toHaveAttribute('aria-label', 'Find in document');
    });

    it('has accessible input', () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Find...');
      expect(input).toHaveAttribute('aria-label');
      expect(input).toHaveAttribute('aria-describedby');
    });

    it('has accessible buttons', () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      const prevButton = screen.getByRole('button', { name: /previous match/i });
      const nextButton = screen.getByRole('button', { name: /next match/i });
      const closeButton = screen.getByRole('button', { name: /close search/i });

      expect(prevButton).toHaveAttribute('aria-label');
      expect(nextButton).toHaveAttribute('aria-label');
      expect(closeButton).toHaveAttribute('aria-label');
    });

    it('has live region for match count', () => {
      render(
        <TestWrapper>
          <FindReplaceBar onClose={onCloseMock} />
        </TestWrapper>
      );

      const counter = document.getElementById('match-count');
      expect(counter).toHaveAttribute('aria-live', 'polite');
      expect(counter).toHaveAttribute('aria-atomic', 'true');
    });
  });
});
