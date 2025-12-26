/**
 * Tests for markdown-escaper module
 *
 * This file provides comprehensive tests for the context-aware Markdown escaping
 * functionality, covering all escape rules and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { escapeMarkdownText, TEXT_FORMAT, type EscapeContext } from './markdown-escaper.js';

describe('markdown-escaper', () => {
  const defaultContext: EscapeContext = { isLineStart: false, isInTable: false };
  const lineStartContext: EscapeContext = { isLineStart: true, isInTable: false };
  const tableContext: EscapeContext = { isLineStart: false, isInTable: true };

  describe('TEXT_FORMAT constants', () => {
    it('defines correct bitmask values', () => {
      expect(TEXT_FORMAT.BOLD).toBe(1);
      expect(TEXT_FORMAT.ITALIC).toBe(2);
      expect(TEXT_FORMAT.STRIKETHROUGH).toBe(4);
      expect(TEXT_FORMAT.UNDERLINE).toBe(8);
      expect(TEXT_FORMAT.CODE).toBe(16);
      expect(TEXT_FORMAT.SUBSCRIPT).toBe(32);
      expect(TEXT_FORMAT.SUPERSCRIPT).toBe(64);
      expect(TEXT_FORMAT.HIGHLIGHT).toBe(128);
    });
  });

  describe('escapeMarkdownText', () => {
    describe('empty/null input', () => {
      it('returns empty string for empty input', () => {
        expect(escapeMarkdownText('', defaultContext)).toBe('');
      });

      it('returns empty string for undefined-ish input', () => {
        expect(escapeMarkdownText(null as unknown as string, defaultContext)).toBe('');
        expect(escapeMarkdownText(undefined as unknown as string, defaultContext)).toBe('');
      });
    });

    describe('newline handling', () => {
      it('preserves newlines', () => {
        const result = escapeMarkdownText('line1\nline2', defaultContext);
        expect(result).toBe('line1\nline2');
      });

      it('resets line-start state after newline', () => {
        // # is only escaped at line start
        const result = escapeMarkdownText('text\n# heading', defaultContext);
        expect(result).toBe('text\n\\# heading');
      });

      it('handles multiple newlines', () => {
        const result = escapeMarkdownText('a\n\nb', defaultContext);
        expect(result).toBe('a\n\nb');
      });
    });

    describe('backslash escaping', () => {
      it('escapes backslash before special character', () => {
        expect(escapeMarkdownText('\\*', defaultContext)).toBe('\\\\*');
        expect(escapeMarkdownText('\\#', defaultContext)).toBe('\\\\#');
        expect(escapeMarkdownText('\\[', defaultContext)).toBe('\\\\[');
      });

      it('preserves backslash before non-special character', () => {
        expect(escapeMarkdownText('\\n', defaultContext)).toBe('\\n');
        expect(escapeMarkdownText('\\a', defaultContext)).toBe('\\a');
      });

      it('handles backslash at end of string', () => {
        expect(escapeMarkdownText('test\\', defaultContext)).toBe('test\\');
      });

      it('escapes backslash before tilde', () => {
        expect(escapeMarkdownText('\\~', defaultContext)).toBe('\\\\~');
      });

      it('escapes backslash before pipe', () => {
        expect(escapeMarkdownText('\\|', defaultContext)).toBe('\\\\|');
      });
    });

    describe('heading syntax (# at line start)', () => {
      it('escapes # at line start', () => {
        expect(escapeMarkdownText('# heading', lineStartContext)).toBe('\\# heading');
      });

      it('does not escape # mid-line', () => {
        expect(escapeMarkdownText('Issue #123', defaultContext)).toBe('Issue #123');
      });

      it('does not escape # mid-line even in lineStart context', () => {
        // After the first character, we're no longer at line start
        expect(escapeMarkdownText('x# not heading', lineStartContext)).toBe('x# not heading');
      });

      it('escapes multiple # at line start', () => {
        expect(escapeMarkdownText('## h2', lineStartContext)).toBe('\\## h2');
      });
    });

    describe('blockquote syntax (> at line start)', () => {
      it('escapes > at line start', () => {
        expect(escapeMarkdownText('> quote', lineStartContext)).toBe('\\> quote');
      });

      it('does not escape > mid-line', () => {
        expect(escapeMarkdownText('a > b', defaultContext)).toBe('a > b');
      });

      it('escapes > after newline', () => {
        const result = escapeMarkdownText('text\n> quote', defaultContext);
        expect(result).toBe('text\n\\> quote');
      });
    });

    describe('unordered list markers (-, +, * at line start + space)', () => {
      it('escapes dash at line start followed by space', () => {
        expect(escapeMarkdownText('- item', lineStartContext)).toBe('\\- item');
      });

      it('does not escape dash at line start without space', () => {
        expect(escapeMarkdownText('-item', lineStartContext)).toBe('-item');
      });

      it('escapes plus at line start followed by space', () => {
        expect(escapeMarkdownText('+ item', lineStartContext)).toBe('\\+ item');
      });

      it('escapes asterisk at line start followed by space', () => {
        expect(escapeMarkdownText('* item', lineStartContext)).toBe('\\* item');
      });

      it('does not escape list markers mid-line', () => {
        expect(escapeMarkdownText('text - dash', defaultContext)).toBe('text - dash');
        expect(escapeMarkdownText('text + plus', defaultContext)).toBe('text + plus');
      });
    });

    describe('ordered list markers (digits + dot at line start)', () => {
      it('escapes single digit + dot + space at line start', () => {
        expect(escapeMarkdownText('1. item', lineStartContext)).toBe('1\\. item');
      });

      it('escapes multi-digit + dot + space at line start', () => {
        expect(escapeMarkdownText('10. item', lineStartContext)).toBe('10\\. item');
        expect(escapeMarkdownText('123. item', lineStartContext)).toBe('123\\. item');
      });

      it('does not escape digit + dot without space', () => {
        expect(escapeMarkdownText('1.5', lineStartContext)).toBe('1.5');
      });

      it('does not escape digit + dot mid-line', () => {
        expect(escapeMarkdownText('Version 1. is good', defaultContext)).toBe('Version 1. is good');
      });

      it('handles digit + dot at end of line', () => {
        // At line start with dot at end of string (no space after)
        expect(escapeMarkdownText('1.', lineStartContext)).toBe('1\\.');
      });
    });

    describe('link bracket escaping', () => {
      it('escapes [ when matching ] exists', () => {
        expect(escapeMarkdownText('[link]', defaultContext)).toBe('\\[link]');
      });

      it('does not escape [ when no matching ]', () => {
        expect(escapeMarkdownText('[incomplete', defaultContext)).toBe('[incomplete');
      });

      it('escapes [ in complex link pattern', () => {
        expect(escapeMarkdownText('[text](url)', defaultContext)).toBe('\\[text](url)');
      });

      it('handles multiple bracket pairs', () => {
        const result = escapeMarkdownText('[a] and [b]', defaultContext);
        expect(result).toBe('\\[a] and \\[b]');
      });
    });

    describe('pipe escaping in table context', () => {
      it('escapes | in table context', () => {
        expect(escapeMarkdownText('a | b', tableContext)).toBe('a \\| b');
      });

      it('does not escape | outside table context', () => {
        expect(escapeMarkdownText('a | b', defaultContext)).toBe('a | b');
      });

      it('escapes multiple pipes in table', () => {
        expect(escapeMarkdownText('a | b | c', tableContext)).toBe('a \\| b \\| c');
      });
    });

    describe('emphasis characters (* and _)', () => {
      describe('mid-word (no escape)', () => {
        it('preserves underscore in snake_case', () => {
          expect(escapeMarkdownText('snake_case', defaultContext)).toBe('snake_case');
        });

        it('preserves asterisk in multiplication', () => {
          expect(escapeMarkdownText('2*3', defaultContext)).toBe('2*3');
        });

        it('preserves multiple underscores mid-word', () => {
          expect(escapeMarkdownText('foo_bar_baz', defaultContext)).toBe('foo_bar_baz');
        });
      });

      describe('isolated (no escape)', () => {
        it('preserves asterisk surrounded by whitespace', () => {
          expect(escapeMarkdownText('a * b', defaultContext)).toBe('a * b');
        });

        it('preserves underscore surrounded by whitespace', () => {
          expect(escapeMarkdownText('a _ b', defaultContext)).toBe('a _ b');
        });
      });

      describe('opening emphasis (escape)', () => {
        it('escapes asterisk at word boundary opening', () => {
          expect(escapeMarkdownText(' *word', defaultContext)).toBe(' \\*word');
        });

        it('escapes underscore at word boundary opening', () => {
          expect(escapeMarkdownText(' _word', defaultContext)).toBe(' \\_word');
        });

        it('escapes asterisk at start of string', () => {
          // At start, prevChar is '' which counts as whitespace
          expect(escapeMarkdownText('*word', defaultContext)).toBe('\\*word');
        });
      });

      describe('closing emphasis (escape)', () => {
        it('escapes asterisk at word boundary closing', () => {
          expect(escapeMarkdownText('word* ', defaultContext)).toBe('word\\* ');
        });

        it('escapes underscore at word boundary closing', () => {
          expect(escapeMarkdownText('word_ ', defaultContext)).toBe('word\\_ ');
        });

        it('escapes emphasis before punctuation', () => {
          expect(escapeMarkdownText('word*.', defaultContext)).toBe('word\\*.');
          expect(escapeMarkdownText('word*,', defaultContext)).toBe('word\\*,');
          expect(escapeMarkdownText('word*!', defaultContext)).toBe('word\\*!');
          expect(escapeMarkdownText('word*?', defaultContext)).toBe('word\\*?');
          expect(escapeMarkdownText('word*;', defaultContext)).toBe('word\\*;');
          expect(escapeMarkdownText('word*:', defaultContext)).toBe('word\\*:');
          expect(escapeMarkdownText('word*)', defaultContext)).toBe('word\\*)');
        });

        it('escapes emphasis at end of string', () => {
          // At end, nextChar is '' which counts as whitespace
          expect(escapeMarkdownText('word*', defaultContext)).toBe('word\\*');
        });
      });

      describe('double emphasis (** and __)', () => {
        it('escapes double asterisk at start', () => {
          expect(escapeMarkdownText('**bold**', defaultContext)).toBe('\\*\\*bold\\*\\*');
        });

        it('escapes double underscore', () => {
          expect(escapeMarkdownText('__bold__', defaultContext)).toBe('\\_\\_bold\\_\\_');
        });

        it('escapes triple emphasis', () => {
          expect(escapeMarkdownText('***bold-italic***', defaultContext)).toBe(
            '\\*\\*\\*bold-italic\\*\\*\\*'
          );
        });
      });
    });

    describe('complex combinations', () => {
      it('handles multiple escape scenarios in one string', () => {
        const result = escapeMarkdownText('# Title with *emphasis* and [link]', lineStartContext);
        expect(result).toBe('\\# Title with \\*emphasis\\* and \\[link]');
      });

      it('handles code in table context', () => {
        const result = escapeMarkdownText('a | b | c', tableContext);
        expect(result).toBe('a \\| b \\| c');
      });

      it('handles snake_case next to emphasis', () => {
        const result = escapeMarkdownText('use snake_case *not* camelCase', defaultContext);
        expect(result).toBe('use snake_case \\*not\\* camelCase');
      });

      it('handles real-world code comment', () => {
        // Comments often have * at start of lines
        const result = escapeMarkdownText('* TODO: Fix this', lineStartContext);
        expect(result).toBe('\\* TODO: Fix this');
      });

      it('handles GitHub issue reference', () => {
        const result = escapeMarkdownText('Fixed in #123', defaultContext);
        expect(result).toBe('Fixed in #123');
      });
    });

    describe('state machine behavior', () => {
      it('correctly tracks line-start state through text', () => {
        // First line: # should be escaped
        // After text: # should not be escaped (mid-line)
        // After newline: # should be escaped again
        const result = escapeMarkdownText('# h1\ntext # hash\n# h2', lineStartContext);
        expect(result).toBe('\\# h1\ntext # hash\n\\# h2');
      });

      it('correctly resets after each character', () => {
        // Starting at line start, but after first char we're not
        const result = escapeMarkdownText('a# b', lineStartContext);
        expect(result).toBe('a# b');
      });
    });

    describe('edge cases', () => {
      it('handles single character strings', () => {
        expect(escapeMarkdownText('#', lineStartContext)).toBe('\\#');
        expect(escapeMarkdownText('a', defaultContext)).toBe('a');
        expect(escapeMarkdownText('*', defaultContext)).toBe('*'); // Isolated asterisk
      });

      it('handles string with only newlines', () => {
        expect(escapeMarkdownText('\n\n\n', defaultContext)).toBe('\n\n\n');
      });

      it('handles Unicode text', () => {
        expect(escapeMarkdownText('Hello  World', defaultContext)).toBe('Hello  World');
        expect(escapeMarkdownText(' *emphasis*', defaultContext)).toBe(' \\*emphasis\\*');
      });

      it('handles whitespace preservation', () => {
        expect(escapeMarkdownText('  spaces  ', defaultContext)).toBe('  spaces  ');
        expect(escapeMarkdownText('\ttabs\t', defaultContext)).toBe('\ttabs\t');
      });
    });
  });
});
