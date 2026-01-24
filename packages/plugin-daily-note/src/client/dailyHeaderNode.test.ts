/**
 * DailyHeaderNode tests.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { $getRoot, createEditor, type LexicalEditor } from 'lexical';
import { $createDailyHeaderNode, DailyHeaderNode, formatDailyHeaderDate } from './index.js';

const createTestEditor = (): LexicalEditor =>
  createEditor({
    namespace: 'DailyHeaderNodeTest',
    nodes: [DailyHeaderNode],
    onError: (error: Error) => {
      throw error;
    },
  });

describe('DailyHeaderNode', () => {
  it('renders a non-editable header element', () => {
    const date = new Date(2024, 0, 15, 12, 0, 0);
    const expectedDate = formatDailyHeaderDate(date);
    const editor = createTestEditor();

    editor.update(() => {
      const node = $createDailyHeaderNode('01/15/2024');
      $getRoot().append(node);
      const element = node.decorate() as ReactElement;

      expect(element.type).toBe('h1');
      expect(element.props.className).toBe('daily-note-header-title scribe-h1');
      expect(element.props.contentEditable).toBe(false);
      expect(element.props.children).toBe(expectedDate);
    });
  });

  it('exports DOM with contenteditable disabled', () => {
    const date = new Date(2024, 0, 15, 12, 0, 0);
    const expectedDate = formatDailyHeaderDate(date);
    const editor = createTestEditor();

    editor.update(() => {
      const node = $createDailyHeaderNode('01/15/2024');
      $getRoot().append(node);
      const exportResult = node.exportDOM();
      const element = exportResult.element as HTMLElement;

      expect(element.tagName).toBe('H1');
      expect(element.textContent).toBe(expectedDate);
      expect(element.getAttribute('contenteditable')).toBe('false');
    });
  });

  it('returns text content from date', () => {
    const date = new Date(2024, 1, 1, 12, 0, 0);
    const expectedDate = formatDailyHeaderDate(date);
    const editor = createTestEditor();

    editor.update(() => {
      const node = $createDailyHeaderNode('02/01/2024');
      $getRoot().append(node);

      expect(node.getTextContent()).toBe(expectedDate);
      expect(node.getDate()).toBe(expectedDate);
    });
  });
});
