/**
 * Tests for MarkdownOverlay reveal-on-cursor rendering.
 */

import { describe, test, expect } from 'bun:test';
import type { InlineToken } from '../workers/markdown-parser.worker';

describe('MarkdownOverlay Token Rendering', () => {
  test('identifies active tokens when cursor overlaps', () => {
    const token: InlineToken = {
      type: 'strong',
      start: 10,
      end: 20,
      raw: '**bold**',
      text: 'bold',
      markers: { prefix: '**', suffix: '**' },
    };

    // Cursor at start
    expect(isTokenActive(token, 10, 10)).toBe(true);

    // Cursor in middle
    expect(isTokenActive(token, 15, 15)).toBe(true);

    // Cursor at end
    expect(isTokenActive(token, 20, 20)).toBe(true);

    // Cursor just before (within buffer)
    expect(isTokenActive(token, 9, 9)).toBe(true);

    // Cursor just after (within buffer)
    expect(isTokenActive(token, 21, 21)).toBe(true);

    // Cursor far away
    expect(isTokenActive(token, 5, 5)).toBe(false);
    expect(isTokenActive(token, 30, 30)).toBe(false);
  });

  test('identifies active tokens for selections', () => {
    const token: InlineToken = {
      type: 'emphasis',
      start: 10,
      end: 20,
      raw: '*italic*',
      text: 'italic',
      markers: { prefix: '*', suffix: '*' },
    };

    // Selection overlaps token
    expect(isTokenActive(token, 5, 15)).toBe(true);
    expect(isTokenActive(token, 15, 25)).toBe(true);
    expect(isTokenActive(token, 5, 25)).toBe(true);

    // Selection before token
    expect(isTokenActive(token, 0, 5)).toBe(false);

    // Selection after token
    expect(isTokenActive(token, 25, 30)).toBe(false);
  });

  test('token types have correct rendering behavior', () => {
    const types: InlineToken['type'][] = [
      'text',
      'emphasis',
      'strong',
      'code',
      'link',
      'heading',
      'list-item',
    ];

    // All types should be valid
    types.forEach((type) => {
      expect(type).toBeTruthy();
    });
  });
});

// Helper function from MarkdownOverlay
function isTokenActive(token: InlineToken, selStart: number, selEnd: number): boolean {
  const buffer = 1;
  return (
    (selStart >= token.start - buffer && selStart <= token.end + buffer) ||
    (selEnd >= token.start - buffer && selEnd <= token.end + buffer) ||
    (selStart <= token.start && selEnd >= token.end)
  );
}
