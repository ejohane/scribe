/**
 * Tests for EditorToolbar component
 *
 * Tests cover:
 * - Basic rendering and accessibility
 * - Text formatting buttons (bold, italic, underline)
 * - Active state tracking for formats
 * - Heading selector
 * - List buttons
 * - Link button
 * - Undo/Redo buttons
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import type { Klass, LexicalNode } from 'lexical';
import { EditorToolbar } from './EditorToolbar';

// Node configuration for testing
const EDITOR_NODES: Klass<LexicalNode>[] = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
];

// Test wrapper that provides the necessary Lexical context
function TestEditorWrapper({ children }: { children: React.ReactNode }) {
  const initialConfig = {
    namespace: 'TestEditor',
    nodes: EDITOR_NODES,
    onError: (error: Error) => {
      throw error;
    },
    theme: {},
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      {children}
      <RichTextPlugin
        contentEditable={<ContentEditable className="test-editor-input" />}
        ErrorBoundary={({ children }) => <>{children}</>}
      />
      <ListPlugin />
      <LinkPlugin />
      <HistoryPlugin />
    </LexicalComposer>
  );
}

describe('EditorToolbar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Basic rendering', () => {
    it('renders toolbar with correct role', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toBeInTheDocument();
      expect(toolbar).toHaveAttribute('aria-label', 'Editor formatting');
    });

    it('renders all toolbar groups', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      // Check for all groups
      expect(screen.getByRole('group', { name: 'History' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Text formatting' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Block type' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Lists' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Links' })).toBeInTheDocument();
    });

    it('renders dividers between groups', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const dividers = screen.getAllByRole('separator');
      expect(dividers.length).toBeGreaterThanOrEqual(4);
    });

    it('applies custom className', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar className="custom-toolbar" />
        </TestEditorWrapper>
      );

      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toHaveClass('custom-toolbar');
      expect(toolbar).toHaveClass('scribe-editor-toolbar');
    });
  });

  describe('Undo/Redo buttons', () => {
    it('renders undo and redo buttons', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Redo' })).toBeInTheDocument();
    });

    it('undo button starts disabled', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const undoButton = screen.getByRole('button', { name: 'Undo' });
      expect(undoButton).toBeDisabled();
    });

    it('redo button starts disabled', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const redoButton = screen.getByRole('button', { name: 'Redo' });
      expect(redoButton).toBeDisabled();
    });

    it('has correct titles with keyboard shortcuts', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      expect(screen.getByRole('button', { name: 'Undo' })).toHaveAttribute(
        'title',
        'Undo (Ctrl+Z)'
      );
      expect(screen.getByRole('button', { name: 'Redo' })).toHaveAttribute(
        'title',
        'Redo (Ctrl+Y)'
      );
    });
  });

  describe('Text formatting buttons', () => {
    it('renders bold, italic, and underline buttons', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Underline' })).toBeInTheDocument();
    });

    it('formatting buttons have correct aria-pressed initially', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(screen.getByRole('button', { name: 'Underline' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('has correct titles with keyboard shortcuts', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute(
        'title',
        'Bold (Ctrl+B)'
      );
      expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute(
        'title',
        'Italic (Ctrl+I)'
      );
      expect(screen.getByRole('button', { name: 'Underline' })).toHaveAttribute(
        'title',
        'Underline (Ctrl+U)'
      );
    });

    it('bold button can be clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const boldButton = screen.getByRole('button', { name: 'Bold' });

      await act(async () => {
        await user.click(boldButton);
      });

      // Button should still be in the document after click
      expect(boldButton).toBeInTheDocument();
    });
  });

  describe('Block type selector', () => {
    it('renders block type select', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const select = screen.getByRole('combobox', { name: 'Block type' });
      expect(select).toBeInTheDocument();
    });

    it('has paragraph selected by default', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const select = screen.getByRole('combobox', { name: 'Block type' });
      expect(select).toHaveValue('paragraph');
    });

    it('includes all heading options', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const select = screen.getByRole('combobox', { name: 'Block type' });
      const options = select.querySelectorAll('option');

      expect(options).toHaveLength(4);
      expect(options[0]).toHaveValue('paragraph');
      expect(options[1]).toHaveValue('h1');
      expect(options[2]).toHaveValue('h2');
      expect(options[3]).toHaveValue('h3');
    });

    it('options have correct text', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      expect(screen.getByRole('option', { name: 'Paragraph' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Heading 1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Heading 2' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Heading 3' })).toBeInTheDocument();
    });
  });

  describe('List buttons', () => {
    it('renders bullet and numbered list buttons', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      expect(screen.getByRole('button', { name: 'Bullet list' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Numbered list' })).toBeInTheDocument();
    });

    it('list buttons have correct aria-pressed initially', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      expect(screen.getByRole('button', { name: 'Bullet list' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(screen.getByRole('button', { name: 'Numbered list' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('has correct titles', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      expect(screen.getByRole('button', { name: 'Bullet list' })).toHaveAttribute(
        'title',
        'Bullet List'
      );
      expect(screen.getByRole('button', { name: 'Numbered list' })).toHaveAttribute(
        'title',
        'Numbered List'
      );
    });
  });

  describe('Link button', () => {
    it('renders link button', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      expect(screen.getByRole('button', { name: 'Insert link' })).toBeInTheDocument();
    });

    it('link button has correct aria-pressed initially', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      expect(screen.getByRole('button', { name: 'Insert link' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('has correct title for inserting link', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      expect(screen.getByRole('button', { name: 'Insert link' })).toHaveAttribute(
        'title',
        'Insert Link'
      );
    });
  });

  describe('Button interactions', () => {
    it('buttons are not disabled by default (except undo/redo)', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      expect(screen.getByRole('button', { name: 'Bold' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Italic' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Underline' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Bullet list' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Numbered list' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Insert link' })).not.toBeDisabled();
    });

    it('all buttons have type="button"', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });
  });

  describe('Accessibility', () => {
    it('toolbar has correct ARIA role and label', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toHaveAttribute('aria-label', 'Editor formatting');
    });

    it('all buttons have aria-label', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label');
      });
    });

    it('groups have proper role and aria-label', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const groups = screen.getAllByRole('group');
      expect(groups.length).toBe(5);
      groups.forEach((group) => {
        expect(group).toHaveAttribute('aria-label');
      });
    });

    it('dividers have separator role', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const separators = screen.getAllByRole('separator');
      expect(separators.length).toBeGreaterThan(0);
    });

    it('select has aria-label', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const select = screen.getByRole('combobox', { name: 'Block type' });
      expect(select).toHaveAttribute('aria-label', 'Block type');
    });
  });

  describe('SVG icons', () => {
    it('all SVG icons have aria-hidden', () => {
      render(
        <TestEditorWrapper>
          <EditorToolbar />
        </TestEditorWrapper>
      );

      const toolbar = screen.getByRole('toolbar');
      const svgs = toolbar.querySelectorAll('svg');

      expect(svgs.length).toBeGreaterThan(0);
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });
});

describe('EditorToolbar integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('clicking format buttons does not throw', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <TestEditorWrapper>
        <EditorToolbar />
      </TestEditorWrapper>
    );

    // Click all format buttons - should not throw
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Bold' }));
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Italic' }));
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Underline' }));
    });

    // Verify toolbar still renders
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('clicking list buttons does not throw', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <TestEditorWrapper>
        <EditorToolbar />
      </TestEditorWrapper>
    );

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Bullet list' }));
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Numbered list' }));
    });

    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('changing block type select does not throw', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <TestEditorWrapper>
        <EditorToolbar />
      </TestEditorWrapper>
    );

    const select = screen.getByRole('combobox', { name: 'Block type' });

    await act(async () => {
      await user.selectOptions(select, 'h1');
    });

    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('link button prompts for URL', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Mock window.prompt
    const mockPrompt = vi.spyOn(window, 'prompt').mockReturnValue(null);

    render(
      <TestEditorWrapper>
        <EditorToolbar />
      </TestEditorWrapper>
    );

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Insert link' }));
    });

    expect(mockPrompt).toHaveBeenCalledWith('Enter URL:');

    mockPrompt.mockRestore();
  });
});
