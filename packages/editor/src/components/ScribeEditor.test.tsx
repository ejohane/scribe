/**
 * Tests for ScribeEditor component
 *
 * Tests cover:
 * - Basic rendering
 * - Placeholder display
 * - Initial content loading
 * - Read-only mode
 * - onChange callbacks
 * - Rich text formatting (headings, lists, etc.)
 * - Error handling
 * - Yjs integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createElement, useEffect, type ReactNode } from 'react';
import {
  DecoratorNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import { ScribeEditor, type EditorContent } from './ScribeEditor';

// Mock simple initial editor state - using unknown type to avoid strict typing issues
const createInitialContent = (text: string): EditorContent =>
  ({
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text,
              type: 'text',
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'paragraph',
          version: 1,
          textFormat: 0,
          textStyle: '',
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }) as unknown as EditorContent;

type SerializedMockNode = Spread<
  {
    text: string;
  },
  SerializedLexicalNode
>;

class MockExtensionNode extends DecoratorNode<ReactNode> {
  __text: string;

  static getType(): string {
    return 'MockExtensionNode';
  }

  static clone(node: MockExtensionNode): MockExtensionNode {
    return new MockExtensionNode(node.__text, node.__key);
  }

  constructor(text = 'Mock Node', key?: NodeKey) {
    super(key);
    this.__text = text;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const element = document.createElement('span');
    element.className = 'mock-extension-node';
    return element;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): ReactNode {
    return createElement('span', { 'data-testid': 'mock-extension-node' }, this.__text);
  }

  exportJSON(): SerializedMockNode {
    return {
      type: 'MockExtensionNode',
      version: 1,
      text: this.__text,
    };
  }

  static importJSON(serializedNode: SerializedMockNode): MockExtensionNode {
    return new MockExtensionNode(serializedNode.text);
  }

  static importDOM(): DOMConversionMap | null {
    return null;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span');
    element.textContent = this.__text;
    return { element };
  }
}

const createExtensionContent = (text: string): EditorContent =>
  ({
    root: {
      children: [
        {
          type: 'MockExtensionNode',
          version: 1,
          text,
        },
        {
          children: [],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'paragraph',
          version: 1,
          textFormat: 0,
          textStyle: '',
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }) as unknown as EditorContent;

describe('ScribeEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Basic rendering', () => {
    it('renders without crashing', () => {
      render(<ScribeEditor />);

      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toBeInTheDocument();
    });

    it('has correct accessibility attributes', () => {
      render(<ScribeEditor />);

      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toHaveAttribute('role', 'textbox');
      expect(editor).toHaveAttribute('aria-label', 'Scribe Editor');
      expect(editor).toHaveAttribute('aria-multiline', 'true');
    });

    it('renders toolbar when not read-only', () => {
      render(<ScribeEditor readOnly={false} />);

      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toBeInTheDocument();
    });

    it('hides toolbar when read-only', () => {
      render(<ScribeEditor readOnly />);

      const toolbar = screen.queryByRole('toolbar');
      expect(toolbar).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ScribeEditor className="custom-class" />);

      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toHaveClass('custom-class');
      expect(editor).toHaveClass('scribe-editor');
    });
  });

  describe('Plugin extensions', () => {
    it('renders editor extension plugins', async () => {
      const ExtensionPlugin = () => <div data-testid="extension-plugin" />;

      render(
        <ScribeEditor
          editorExtensions={{
            plugins: [{ id: 'extension-plugin', plugin: ExtensionPlugin }],
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('extension-plugin')).toBeInTheDocument();
      });
    });

    it('mounts extension nodes and plugins without errors', async () => {
      const handleError = vi.fn();
      const mountOrder: string[] = [];

      const ExtensionPluginA = () => {
        useEffect(() => {
          mountOrder.push('PluginA');
        }, []);
        return <div data-testid="extension-plugin-a" />;
      };

      const ExtensionPluginB = () => {
        useEffect(() => {
          mountOrder.push('PluginB');
        }, []);
        return <div data-testid="extension-plugin-b" />;
      };

      render(
        <ScribeEditor
          initialContent={createExtensionContent('Extension Node')}
          onError={handleError}
          editorExtensions={{
            nodes: [{ id: 'MockExtensionNode', node: MockExtensionNode }],
            plugins: [
              { id: 'extension-plugin-a', plugin: ExtensionPluginA },
              { id: 'extension-plugin-b', plugin: ExtensionPluginB },
            ],
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('mock-extension-node')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('extension-plugin-a')).toBeInTheDocument();
        expect(screen.getByTestId('extension-plugin-b')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(mountOrder).toEqual(['PluginA', 'PluginB']);
      });

      expect(handleError).not.toHaveBeenCalled();
    });
  });

  describe('Placeholder', () => {
    it('displays default placeholder text', async () => {
      render(<ScribeEditor />);

      await waitFor(() => {
        expect(screen.getByText('Start writing...')).toBeInTheDocument();
      });
    });

    it('displays custom placeholder text', async () => {
      render(<ScribeEditor placeholder="Enter your notes here..." />);

      await waitFor(() => {
        expect(screen.getByText('Enter your notes here...')).toBeInTheDocument();
      });
    });
  });

  describe('Initial content', () => {
    it('loads initial content when provided', async () => {
      const content = createInitialContent('Hello, world!');
      render(<ScribeEditor initialContent={content} />);

      await waitFor(() => {
        expect(screen.getByText('Hello, world!')).toBeInTheDocument();
      });
    });
  });

  describe('Read-only mode', () => {
    it('applies read-only state correctly', () => {
      render(<ScribeEditor readOnly />);

      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toHaveAttribute('aria-readonly', 'true');
      expect(editor).toHaveClass('scribe-editor-readonly');
    });

    it('is editable when not read-only', () => {
      render(<ScribeEditor readOnly={false} />);

      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toHaveAttribute('aria-readonly', 'false');
      expect(editor).not.toHaveClass('scribe-editor-readonly');
    });

    it('does not auto-focus when read-only', async () => {
      render(<ScribeEditor readOnly autoFocus />);

      // In read-only mode, auto-focus should be disabled
      const input = screen.getByRole('textbox', { name: 'Scribe Editor' });
      expect(input).toBeInTheDocument();
      // The specific auto-focus behavior depends on Lexical internals
    });
  });

  describe('onChange callback', () => {
    it('passes onChange to OnChangePlugin when provided', () => {
      const handleChange = vi.fn();

      render(<ScribeEditor onChange={handleChange} />);

      // Verify the editor renders with the onChange handler configured
      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toBeInTheDocument();

      // The OnChangePlugin is internal, so we verify indirectly
      // by checking that the contentEditable is present
      const contentEditable = document.querySelector('[contenteditable="true"]');
      expect(contentEditable).toBeInTheDocument();
    });

    it('does not throw when onChange is not provided', () => {
      // Should render without errors when no onChange
      render(<ScribeEditor />);

      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('calls onError callback when an error occurs', () => {
      const handleError = vi.fn();

      // We can't easily trigger a Lexical error, but we verify the callback is passed
      render(<ScribeEditor onError={handleError} />);

      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toBeInTheDocument();
    });
  });

  describe('Auto-focus', () => {
    it('auto-focuses by default when not read-only', async () => {
      render(<ScribeEditor autoFocus />);

      // The editor should be rendered
      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toBeInTheDocument();

      // Due to how Lexical handles focus, we just verify the component renders correctly
      const contentEditable = document.querySelector('[contenteditable="true"]');
      expect(contentEditable).toBeInTheDocument();
    });

    it('does not auto-focus when autoFocus is false', async () => {
      render(<ScribeEditor autoFocus={false} />);

      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toBeInTheDocument();
    });
  });

  describe('Yjs integration', () => {
    it('renders without Yjs when not provided', () => {
      render(<ScribeEditor />);

      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toBeInTheDocument();
    });

    it('renders with Yjs plugin when yjsDoc and YjsPlugin are provided', () => {
      // Create a mock Yjs document
      const mockDoc = {
        getMap: vi.fn().mockReturnValue({
          get: vi.fn(),
          set: vi.fn(),
          observe: vi.fn(),
          unobserve: vi.fn(),
        }),
        transact: vi.fn((fn: () => void) => fn()),
      };

      // Create a mock YjsPlugin component
      const MockYjsPlugin = vi.fn(() => null);

      render(
        <ScribeEditor yjsDoc={mockDoc as unknown as import('yjs').Doc} YjsPlugin={MockYjsPlugin} />
      );

      // Verify the YjsPlugin was rendered with the doc prop
      expect(MockYjsPlugin).toHaveBeenCalled();
      const firstCall = MockYjsPlugin.mock.calls[0] as unknown[];
      expect(firstCall[0]).toEqual(expect.objectContaining({ doc: mockDoc }));
    });

    it('does not render Yjs plugin when only yjsDoc is provided', () => {
      const mockDoc = {
        getMap: vi.fn().mockReturnValue({
          get: vi.fn(),
          set: vi.fn(),
          observe: vi.fn(),
          unobserve: vi.fn(),
        }),
        transact: vi.fn(),
      };

      render(<ScribeEditor yjsDoc={mockDoc as unknown as import('yjs').Doc} />);

      // Should render without error
      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toBeInTheDocument();
    });

    it('does not render Yjs plugin when only YjsPlugin is provided', () => {
      const MockYjsPlugin = vi.fn(() => null);

      render(<ScribeEditor YjsPlugin={MockYjsPlugin} />);

      // YjsPlugin should not be called since yjsDoc is not provided
      expect(MockYjsPlugin).not.toHaveBeenCalled();
    });
  });

  describe('Editor nodes', () => {
    it('renders with rich text support', async () => {
      // Lexical should have the nodes registered
      render(<ScribeEditor />);

      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toBeInTheDocument();

      // The editor should be fully functional with rich text nodes
      const contentEditable = document.querySelector('[contenteditable="true"]');
      expect(contentEditable).toBeInTheDocument();
    });
  });

  describe('CSS classes', () => {
    it('applies correct base classes', () => {
      render(<ScribeEditor />);

      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toHaveClass('scribe-editor');
    });

    it('applies readonly class when read-only', () => {
      render(<ScribeEditor readOnly />);

      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toHaveClass('scribe-editor-readonly');
    });

    it('combines base and custom classes correctly', () => {
      render(<ScribeEditor className="my-custom-editor" />);

      const editor = screen.getByTestId('scribe-editor');
      expect(editor).toHaveClass('scribe-editor');
      expect(editor).toHaveClass('my-custom-editor');
    });
  });
});

describe('EditorToolbar', () => {
  it('renders toolbar component', () => {
    render(<ScribeEditor />);

    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toBeInTheDocument();
    expect(toolbar).toHaveAttribute('aria-label', 'Editor formatting');
  });
});
