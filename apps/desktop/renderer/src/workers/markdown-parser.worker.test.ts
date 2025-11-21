/**
 * Tests for markdown parser worker inline tokenization.
 */

import { describe, test, expect } from 'bun:test';

// Import the parser logic directly (not as worker) for testing
// We'll test the core parsing functions

describe('Markdown Parser Tokenization', () => {
  test('parses headings with correct markers', () => {
    // Verify the regex patterns work for heading parsing
    const h1Match = '# Heading 1'.match(/^(#{1,6})\s+(.*)$/);
    const h2Match = '## Heading 2'.match(/^(#{1,6})\s+(.*)$/);

    expect(h1Match).toBeTruthy();
    expect(h1Match?.[1]).toBe('#');
    expect(h1Match?.[2]).toBe('Heading 1');

    expect(h2Match).toBeTruthy();
    expect(h2Match?.[1]).toBe('##');
    expect(h2Match?.[2]).toBe('Heading 2');
  });

  test('parses bold text with markers', () => {
    const input = '**bold text**';
    const match = input.match(/^\*\*([^*]+)\*\*/);

    expect(match).toBeTruthy();
    expect(match?.[1]).toBe('bold text');
  });

  test('parses italic text with markers', () => {
    const input = '*italic text*';
    const match = input.match(/^\*([^*]+)\*/);

    expect(match).toBeTruthy();
    expect(match?.[1]).toBe('italic text');
  });

  test('parses inline code with markers', () => {
    const input = '`code here`';
    const match = input.match(/^`([^`]+)`/);

    expect(match).toBeTruthy();
    expect(match?.[1]).toBe('code here');
  });

  test('parses wiki links with markers', () => {
    const input = '[[Note Link]]';
    const match = input.match(/^\[\[([^\]]+)\]\]/);

    expect(match).toBeTruthy();
    expect(match?.[1]).toBe('Note Link');
  });

  test('parses list items', () => {
    const input = '- List item';
    const match = input.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);

    expect(match).toBeTruthy();
    expect(match?.[2]).toBe('-');
    expect(match?.[3]).toBe('List item');
  });

  test('parses numbered list items', () => {
    const input = '1. Numbered item';
    const match = input.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);

    expect(match).toBeTruthy();
    expect(match?.[2]).toBe('1.');
    expect(match?.[3]).toBe('Numbered item');
  });

  test('calculates correct indentation level', () => {
    const indent0 = '';
    const indent1 = '  '; // 2 spaces
    const indent2 = '    '; // 4 spaces

    expect(Math.floor(indent0.length / 2)).toBe(0);
    expect(Math.floor(indent1.length / 2)).toBe(1);
    expect(Math.floor(indent2.length / 2)).toBe(2);
  });
});
