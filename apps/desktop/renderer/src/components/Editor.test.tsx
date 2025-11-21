/**
 * Tests for the dual-layer Editor component.
 */

import React from 'react';
import { describe, test, expect, mock } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { Editor } from './Editor';

describe('Editor', () => {
  test('renders with initial content', () => {
    render(<Editor initialContent="Hello World" />);
    const editor = screen.getByRole('textbox');
    expect(editor.textContent).toBe('Hello World');
  });

  test('calls onChange when content changes', async () => {
    const onChange = mock();
    const { container } = render(<Editor onChange={onChange} />);

    const editor = container.querySelector('.editor-input');
    if (!editor) throw new Error('Editor input not found');

    // Simulate input event
    editor.textContent = 'New content';
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith('New content');
  });

  test('has both input and overlay layers', () => {
    const { container } = render(<Editor />);

    const input = container.querySelector('.editor-input');
    const overlay = container.querySelector('.editor-overlay');

    expect(input).toBeTruthy();
    expect(overlay).toBeTruthy();
  });

  test('overlay is non-interactive', () => {
    const { container } = render(<Editor />);
    const overlay = container.querySelector('.editor-overlay') as HTMLElement;

    expect(overlay).toBeTruthy();
    expect(window.getComputedStyle(overlay).pointerEvents).toBe('none');
  });

  test('input layer is contentEditable', () => {
    const { container } = render(<Editor />);
    const input = container.querySelector('.editor-input');

    expect(input?.getAttribute('contenteditable')).toBe('true');
  });
});
