import { describe, it, expect } from 'vitest';
import {
  IS_BOLD,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_UNDERLINE,
  IS_CODE,
  MARKDOWN_DELIMITERS,
  BLOCK_PREFIXES,
  reconstructInlineMarkdown,
  reconstructHeadingPrefix,
  hasHandledFormat,
} from './markdownReconstruction';

describe('Format bit constants', () => {
  it('has correct bit values', () => {
    expect(IS_BOLD).toBe(1);
    expect(IS_ITALIC).toBe(2);
    expect(IS_STRIKETHROUGH).toBe(4);
    expect(IS_UNDERLINE).toBe(8);
    expect(IS_CODE).toBe(16);
  });

  it('all bits are unique and non-overlapping', () => {
    const formats = [IS_BOLD, IS_ITALIC, IS_STRIKETHROUGH, IS_UNDERLINE, IS_CODE];
    for (let i = 0; i < formats.length; i++) {
      for (let j = i + 1; j < formats.length; j++) {
        expect(formats[i] & formats[j]).toBe(0);
      }
    }
  });
});

describe('MARKDOWN_DELIMITERS', () => {
  it('has correct delimiter values', () => {
    expect(MARKDOWN_DELIMITERS.bold).toBe('**');
    expect(MARKDOWN_DELIMITERS.italic).toBe('*');
    expect(MARKDOWN_DELIMITERS.strikethrough).toBe('~~');
    expect(MARKDOWN_DELIMITERS.code).toBe('`');
  });
});

describe('BLOCK_PREFIXES', () => {
  it('has correct heading prefixes', () => {
    expect(BLOCK_PREFIXES.h1).toBe('# ');
    expect(BLOCK_PREFIXES.h2).toBe('## ');
    expect(BLOCK_PREFIXES.h3).toBe('### ');
    expect(BLOCK_PREFIXES.h4).toBe('#### ');
    expect(BLOCK_PREFIXES.h5).toBe('##### ');
    expect(BLOCK_PREFIXES.h6).toBe('###### ');
  });

  it('has correct quote prefix', () => {
    expect(BLOCK_PREFIXES.quote).toBe('> ');
  });

  it('has correct list item prefix', () => {
    expect(BLOCK_PREFIXES.listItem).toBe('- ');
  });

  it('has correct ordered list item function', () => {
    expect(BLOCK_PREFIXES.orderedListItem(1)).toBe('1. ');
    expect(BLOCK_PREFIXES.orderedListItem(2)).toBe('2. ');
    expect(BLOCK_PREFIXES.orderedListItem(10)).toBe('10. ');
  });

  it('has correct code block delimiters', () => {
    expect(BLOCK_PREFIXES.codeBlockOpen('')).toBe('```');
    expect(BLOCK_PREFIXES.codeBlockOpen('typescript')).toBe('```typescript');
    expect(BLOCK_PREFIXES.codeBlockOpen('js')).toBe('```js');
    expect(BLOCK_PREFIXES.codeBlockClose).toBe('```');
  });
});

describe('reconstructInlineMarkdown', () => {
  describe('single formats', () => {
    it('returns plain text when no format', () => {
      expect(reconstructInlineMarkdown('hello', 0)).toBe('hello');
    });

    it('wraps bold text with **', () => {
      expect(reconstructInlineMarkdown('hello', IS_BOLD)).toBe('**hello**');
    });

    it('wraps italic text with *', () => {
      expect(reconstructInlineMarkdown('hello', IS_ITALIC)).toBe('*hello*');
    });

    it('wraps strikethrough text with ~~', () => {
      expect(reconstructInlineMarkdown('hello', IS_STRIKETHROUGH)).toBe('~~hello~~');
    });

    it('wraps code text with `', () => {
      expect(reconstructInlineMarkdown('hello', IS_CODE)).toBe('`hello`');
    });

    it('ignores underline (no markdown equivalent)', () => {
      expect(reconstructInlineMarkdown('hello', IS_UNDERLINE)).toBe('hello');
    });
  });

  describe('combined formats', () => {
    it('handles bold + italic (produces ***text***)', () => {
      expect(reconstructInlineMarkdown('hello', IS_BOLD | IS_ITALIC)).toBe('***hello***');
    });

    it('handles bold + strikethrough', () => {
      expect(reconstructInlineMarkdown('hello', IS_BOLD | IS_STRIKETHROUGH)).toBe('**~~hello~~**');
    });

    it('handles bold + code', () => {
      expect(reconstructInlineMarkdown('hello', IS_BOLD | IS_CODE)).toBe('**`hello`**');
    });

    it('handles italic + strikethrough', () => {
      expect(reconstructInlineMarkdown('hello', IS_ITALIC | IS_STRIKETHROUGH)).toBe('*~~hello~~*');
    });

    it('handles italic + code', () => {
      expect(reconstructInlineMarkdown('hello', IS_ITALIC | IS_CODE)).toBe('*`hello`*');
    });

    it('handles strikethrough + code', () => {
      expect(reconstructInlineMarkdown('hello', IS_STRIKETHROUGH | IS_CODE)).toBe('~~`hello`~~');
    });
  });

  describe('triple format combinations', () => {
    it('handles bold + italic + strikethrough', () => {
      expect(reconstructInlineMarkdown('hello', IS_BOLD | IS_ITALIC | IS_STRIKETHROUGH)).toBe(
        '***~~hello~~***'
      );
    });

    it('handles bold + italic + code', () => {
      expect(reconstructInlineMarkdown('hello', IS_BOLD | IS_ITALIC | IS_CODE)).toBe(
        '***`hello`***'
      );
    });

    it('handles bold + strikethrough + code', () => {
      expect(reconstructInlineMarkdown('hello', IS_BOLD | IS_STRIKETHROUGH | IS_CODE)).toBe(
        '**~~`hello`~~**'
      );
    });

    it('handles italic + strikethrough + code', () => {
      expect(reconstructInlineMarkdown('hello', IS_ITALIC | IS_STRIKETHROUGH | IS_CODE)).toBe(
        '*~~`hello`~~*'
      );
    });
  });

  describe('all formats combined', () => {
    it('handles bold + italic + strikethrough + code', () => {
      const format = IS_BOLD | IS_ITALIC | IS_STRIKETHROUGH | IS_CODE;
      expect(reconstructInlineMarkdown('hello', format)).toBe('***~~`hello`~~***');
    });

    it('handles all formats including underline (underline ignored)', () => {
      const format = IS_BOLD | IS_ITALIC | IS_STRIKETHROUGH | IS_UNDERLINE | IS_CODE;
      expect(reconstructInlineMarkdown('hello', format)).toBe('***~~`hello`~~***');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(reconstructInlineMarkdown('', IS_BOLD)).toBe('****');
    });

    it('handles text with spaces', () => {
      expect(reconstructInlineMarkdown('hello world', IS_BOLD)).toBe('**hello world**');
    });

    it('handles text with special characters', () => {
      expect(reconstructInlineMarkdown('hello *world*', IS_BOLD)).toBe('**hello *world***');
    });

    it('handles text with backticks', () => {
      expect(reconstructInlineMarkdown('hello `code`', IS_BOLD)).toBe('**hello `code`**');
    });

    it('handles multiline text', () => {
      expect(reconstructInlineMarkdown('hello\nworld', IS_BOLD)).toBe('**hello\nworld**');
    });
  });
});

describe('reconstructHeadingPrefix', () => {
  it('returns correct prefix for h1', () => {
    expect(reconstructHeadingPrefix(1)).toBe('# ');
  });

  it('returns correct prefix for h2', () => {
    expect(reconstructHeadingPrefix(2)).toBe('## ');
  });

  it('returns correct prefix for h3', () => {
    expect(reconstructHeadingPrefix(3)).toBe('### ');
  });

  it('returns correct prefix for h4', () => {
    expect(reconstructHeadingPrefix(4)).toBe('#### ');
  });

  it('returns correct prefix for h5', () => {
    expect(reconstructHeadingPrefix(5)).toBe('##### ');
  });

  it('returns correct prefix for h6', () => {
    expect(reconstructHeadingPrefix(6)).toBe('###### ');
  });
});

describe('hasHandledFormat', () => {
  it('returns false for no format', () => {
    expect(hasHandledFormat(0)).toBe(false);
  });

  it('returns true for bold', () => {
    expect(hasHandledFormat(IS_BOLD)).toBe(true);
  });

  it('returns true for italic', () => {
    expect(hasHandledFormat(IS_ITALIC)).toBe(true);
  });

  it('returns true for strikethrough', () => {
    expect(hasHandledFormat(IS_STRIKETHROUGH)).toBe(true);
  });

  it('returns true for code', () => {
    expect(hasHandledFormat(IS_CODE)).toBe(true);
  });

  it('returns false for underline only (no markdown equivalent)', () => {
    expect(hasHandledFormat(IS_UNDERLINE)).toBe(false);
  });

  it('returns true for combined formats', () => {
    expect(hasHandledFormat(IS_BOLD | IS_ITALIC)).toBe(true);
  });

  it('returns true when underline combined with handled format', () => {
    expect(hasHandledFormat(IS_UNDERLINE | IS_BOLD)).toBe(true);
  });
});
