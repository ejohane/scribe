/**
 * Tests for utility functions.
 */

import { describe, it, expect } from 'vitest';
import { extractTextFromLexical, extractTextFromLexicalJson } from './utils.js';

describe('extractTextFromLexical', () => {
  it('should extract text from simple paragraph', () => {
    const editorState = {
      root: {
        children: [
          {
            children: [{ text: 'Hello world' }],
          },
        ],
      },
    };

    const result = extractTextFromLexical(editorState);
    expect(result).toBe('Hello world');
  });

  it('should extract text from multiple text nodes', () => {
    const editorState = {
      root: {
        children: [
          {
            children: [{ text: 'Hello ' }, { text: 'world' }, { text: '!' }],
          },
        ],
      },
    };

    const result = extractTextFromLexical(editorState);
    expect(result).toBe('Hello  world !');
  });

  it('should extract text from nested structure', () => {
    const editorState = {
      root: {
        children: [
          {
            children: [{ text: 'First paragraph' }],
          },
          {
            children: [{ text: 'Second paragraph' }],
          },
        ],
      },
    };

    const result = extractTextFromLexical(editorState);
    expect(result).toBe('First paragraph Second paragraph');
  });

  it('should extract text from deeply nested structure', () => {
    const editorState = {
      root: {
        children: [
          {
            children: [
              {
                children: [
                  {
                    children: [{ text: 'Deep text' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const result = extractTextFromLexical(editorState);
    expect(result).toBe('Deep text');
  });

  it('should handle empty root', () => {
    const editorState = {
      root: {},
    };

    const result = extractTextFromLexical(editorState);
    expect(result).toBe('');
  });

  it('should handle root with empty children', () => {
    const editorState = {
      root: {
        children: [],
      },
    };

    const result = extractTextFromLexical(editorState);
    expect(result).toBe('');
  });

  it('should handle null/undefined gracefully', () => {
    expect(extractTextFromLexical(null as unknown as { root: object })).toBe('');
    expect(extractTextFromLexical(undefined as unknown as { root: object })).toBe('');
    expect(extractTextFromLexical({} as { root: object })).toBe('');
  });

  it('should skip nodes without text', () => {
    const editorState = {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'linebreak' },
              { text: 'Some text' },
              { type: 'image', src: 'test.png' },
            ],
          },
        ],
      },
    };

    const result = extractTextFromLexical(editorState);
    expect(result).toBe('Some text');
  });

  it('should extract text from realistic Lexical structure', () => {
    // A more realistic Lexical editor state
    const editorState = {
      root: {
        children: [
          {
            type: 'heading',
            tag: 'h1',
            children: [{ type: 'text', text: 'My Document' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'This is a ' },
              { type: 'text', text: 'bold', format: 1 },
              { type: 'text', text: ' paragraph.' },
            ],
          },
          {
            type: 'list',
            listType: 'bullet',
            children: [
              {
                type: 'listitem',
                children: [{ type: 'text', text: 'First item' }],
              },
              {
                type: 'listitem',
                children: [{ type: 'text', text: 'Second item' }],
              },
            ],
          },
        ],
      },
    };

    const result = extractTextFromLexical(editorState);
    expect(result).toContain('My Document');
    expect(result).toContain('This is a');
    expect(result).toContain('bold');
    expect(result).toContain('paragraph');
    expect(result).toContain('First item');
    expect(result).toContain('Second item');
  });
});

describe('extractTextFromLexicalJson', () => {
  it('should parse JSON and extract text', () => {
    const json = JSON.stringify({
      root: {
        children: [
          {
            children: [{ text: 'Hello from JSON' }],
          },
        ],
      },
    });

    const result = extractTextFromLexicalJson(json);
    expect(result).toBe('Hello from JSON');
  });

  it('should return empty string for invalid JSON', () => {
    const result = extractTextFromLexicalJson('not valid json {');
    expect(result).toBe('');
  });

  it('should return empty string for empty JSON', () => {
    const result = extractTextFromLexicalJson('');
    expect(result).toBe('');
  });

  it('should return empty string for null JSON string', () => {
    const result = extractTextFromLexicalJson('null');
    expect(result).toBe('');
  });

  it('should handle JSON with missing root', () => {
    const json = JSON.stringify({ notRoot: {} });
    const result = extractTextFromLexicalJson(json);
    expect(result).toBe('');
  });
});
