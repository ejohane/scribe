/**
 * Tests for ScribeEditor component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScribeEditor } from './ScribeEditor';

describe('ScribeEditor', () => {
  it('renders without crashing', () => {
    render(<ScribeEditor />);

    const editor = screen.getByRole('textbox', { name: 'Scribe Editor' });
    expect(editor).toBeInTheDocument();
  });

  it('displays placeholder text when no content', () => {
    render(<ScribeEditor placeholder="Enter text here" />);

    const editor = screen.getByRole('textbox');
    expect(editor).toHaveTextContent('Enter text here');
    expect(editor).toHaveAttribute('aria-placeholder', 'Enter text here');
  });

  it('displays initial content when provided', () => {
    render(<ScribeEditor initialContent="Hello, world!" />);

    const editor = screen.getByRole('textbox');
    expect(editor).toHaveTextContent('Hello, world!');
  });

  it('applies read-only state correctly', () => {
    render(<ScribeEditor readOnly />);

    const editor = screen.getByRole('textbox');
    expect(editor).toHaveAttribute('aria-readonly', 'true');
    expect(editor).toHaveAttribute('contenteditable', 'false');
  });

  it('is editable when not read-only', () => {
    render(<ScribeEditor readOnly={false} />);

    const editor = screen.getByRole('textbox');
    expect(editor).toHaveAttribute('aria-readonly', 'false');
    expect(editor).toHaveAttribute('contenteditable', 'true');
  });

  it('calls onChange when content changes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<ScribeEditor onChange={handleChange} initialContent="" />);

    const editor = screen.getByRole('textbox');
    await user.type(editor, 'New text');

    expect(handleChange).toHaveBeenCalled();
  });

  it('has correct test id for e2e testing', () => {
    render(<ScribeEditor />);

    expect(screen.getByTestId('scribe-editor')).toBeInTheDocument();
  });
});
