/**
 * Heading Extractor Tests
 *
 * Unit tests for the heading extraction utility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractHeadings } from './heading-extractor.js';
import type { EditorContent, EditorNode } from './types.js';

/**
 * Helper to create a minimal EditorContent structure
 */
function createContent(children: EditorNode[]): EditorContent {
  return {
    root: {
      type: 'root',
      children,
    },
  };
}

/**
 * Helper to create a heading node
 */
function createHeading(level: number, text: string, key: string): EditorNode {
  return {
    type: 'heading',
    tag: `h${level}`,
    __key: key,
    children: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Helper to create a collapsible heading node (used in live editor)
 */
function createCollapsibleHeading(
  level: number,
  text: string,
  key: string,
  collapsed: boolean = false
): EditorNode {
  return {
    type: 'collapsible-heading',
    tag: `h${level}`,
    __key: key,
    collapsed,
    children: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Helper to create a paragraph node
 */
function createParagraph(text: string, key: string): EditorNode {
  return {
    type: 'paragraph',
    __key: key,
    children: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Helper to create a code block node
 */
function createCodeBlock(content: EditorNode[], key: string): EditorNode {
  return {
    type: 'code',
    __key: key,
    children: content,
  };
}

describe('extractHeadings', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('edge cases', () => {
    it('returns empty array for null content', () => {
      expect(extractHeadings(null)).toEqual([]);
    });

    it('returns empty array for undefined content', () => {
      expect(extractHeadings(undefined)).toEqual([]);
    });

    it('returns empty array for content with no root', () => {
      expect(extractHeadings({} as EditorContent)).toEqual([]);
    });

    it('returns empty array for content with empty children', () => {
      const content = createContent([]);
      expect(extractHeadings(content)).toEqual([]);
    });

    it('returns empty array for content with no headings', () => {
      const content = createContent([
        createParagraph('Just a paragraph', 'p1'),
        createParagraph('Another paragraph', 'p2'),
      ]);
      expect(extractHeadings(content)).toEqual([]);
    });
  });

  describe('single heading', () => {
    it('extracts a single h1 heading', () => {
      const content = createContent([createHeading(1, 'Main Title', 'h1_1')]);

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0]).toMatchObject({
        nodeKey: 'h1_1',
        text: 'Main Title',
        level: 1,
        depth: 0,
        lineIndex: 0,
      });
      expect(headings[0].textHash).toBeDefined();
    });

    it('handles heading with empty text', () => {
      const content = createContent([createHeading(2, '', 'h2_empty')]);

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0]).toMatchObject({
        nodeKey: 'h2_empty',
        text: '',
        level: 2,
        depth: 0,
      });
    });
  });

  describe('collapsible-heading type (live editor)', () => {
    it('extracts collapsible-heading nodes', () => {
      const content = createContent([
        createCollapsibleHeading(2, 'Code Cleanup', 'ch_1'),
        createCollapsibleHeading(2, 'Communication', 'ch_2'),
        createCollapsibleHeading(2, 'Stories', 'ch_3'),
      ]);

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(3);
      expect(headings.map((h) => h.text)).toEqual(['Code Cleanup', 'Communication', 'Stories']);
      expect(headings.every((h) => h.depth === 0)).toBe(true);
      expect(headings.every((h) => h.level === 2)).toBe(true);
    });

    it('handles mixed heading and collapsible-heading nodes', () => {
      const content = createContent([
        createHeading(1, 'Standard Heading', 'h1_1'),
        createCollapsibleHeading(2, 'Collapsible Heading', 'ch_1'),
        createHeading(2, 'Another Standard', 'h2_1'),
      ]);

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(3);
      expect(headings.map((h) => ({ text: h.text, depth: h.depth }))).toEqual([
        { text: 'Standard Heading', depth: 0 },
        { text: 'Collapsible Heading', depth: 1 },
        { text: 'Another Standard', depth: 1 },
      ]);
    });

    it('extracts collapsible headings regardless of collapsed state', () => {
      const content = createContent([
        createCollapsibleHeading(2, 'Expanded', 'ch_1', false),
        createCollapsibleHeading(2, 'Collapsed', 'ch_2', true),
      ]);

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(2);
      expect(headings.map((h) => h.text)).toEqual(['Expanded', 'Collapsed']);
    });
  });

  describe('multiple headings at same level', () => {
    it('extracts multiple h2 headings with depth 0', () => {
      const content = createContent([
        createHeading(2, 'Section One', 'h2_1'),
        createParagraph('Some text', 'p1'),
        createHeading(2, 'Section Two', 'h2_2'),
        createHeading(2, 'Section Three', 'h2_3'),
      ]);

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(3);
      expect(headings.map((h) => h.text)).toEqual(['Section One', 'Section Two', 'Section Three']);
      expect(headings.every((h) => h.depth === 0)).toBe(true);
      expect(headings.every((h) => h.level === 2)).toBe(true);
    });
  });

  describe('nested heading hierarchy', () => {
    it('calculates correct depths for h1 > h2 > h3', () => {
      const content = createContent([
        createHeading(1, 'Title', 'h1_1'),
        createHeading(2, 'Chapter 1', 'h2_1'),
        createHeading(3, 'Section 1.1', 'h3_1'),
        createHeading(2, 'Chapter 2', 'h2_2'),
      ]);

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(4);
      expect(headings.map((h) => ({ text: h.text, depth: h.depth }))).toEqual([
        { text: 'Title', depth: 0 },
        { text: 'Chapter 1', depth: 1 },
        { text: 'Section 1.1', depth: 2 },
        { text: 'Chapter 2', depth: 1 },
      ]);
    });

    it('calculates relative depths when document starts with h2', () => {
      const content = createContent([
        createHeading(2, 'Overview', 'h2_1'),
        createHeading(3, 'Details', 'h3_1'),
        createHeading(2, 'Summary', 'h2_2'),
      ]);

      const headings = extractHeadings(content);

      expect(headings.map((h) => ({ level: h.level, depth: h.depth }))).toEqual([
        { level: 2, depth: 0 },
        { level: 3, depth: 1 },
        { level: 2, depth: 0 },
      ]);
    });
  });

  describe('non-sequential heading levels', () => {
    it('handles h1 > h3 > h2 correctly', () => {
      const content = createContent([
        createHeading(1, 'Title', 'h1_1'),
        createHeading(3, 'Deep Section', 'h3_1'),
        createHeading(2, 'Chapter', 'h2_1'),
      ]);

      const headings = extractHeadings(content);

      expect(headings.map((h) => ({ level: h.level, depth: h.depth }))).toEqual([
        { level: 1, depth: 0 },
        { level: 3, depth: 2 },
        { level: 2, depth: 1 },
      ]);
    });

    it('handles document with only h3 and h4', () => {
      const content = createContent([
        createHeading(3, 'Section A', 'h3_1'),
        createHeading(4, 'Subsection A.1', 'h4_1'),
        createHeading(3, 'Section B', 'h3_2'),
      ]);

      const headings = extractHeadings(content);

      expect(headings.map((h) => ({ level: h.level, depth: h.depth }))).toEqual([
        { level: 3, depth: 0 },
        { level: 4, depth: 1 },
        { level: 3, depth: 0 },
      ]);
    });
  });

  describe('headings inside code blocks', () => {
    it('skips headings inside code blocks', () => {
      const content = createContent([
        createHeading(1, 'Real Title', 'h1_1'),
        createCodeBlock([createHeading(2, 'Fake Heading', 'h2_fake')], 'code_1'),
        createHeading(2, 'Real Section', 'h2_1'),
      ]);

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(2);
      expect(headings.map((h) => h.text)).toEqual(['Real Title', 'Real Section']);
    });
  });

  describe('line index tracking', () => {
    it('tracks correct line indices for headings', () => {
      const content = createContent([
        createHeading(1, 'Title', 'h1_1'), // line 0
        createParagraph('Text', 'p1'), // line 1
        createParagraph('More text', 'p2'), // line 2
        createHeading(2, 'Section', 'h2_1'), // line 3
      ]);

      const headings = extractHeadings(content);

      expect(headings.map((h) => h.lineIndex)).toEqual([0, 3]);
    });
  });

  describe('missing or invalid properties', () => {
    it('generates fallback key for heading missing __key (common in stored content)', () => {
      const content = createContent([
        {
          type: 'heading',
          tag: 'h1',
          // Missing __key - this is normal for stored content (Lexical adds __key at runtime)
          children: [{ type: 'text', text: 'Title' }],
        },
        createHeading(2, 'Valid Section', 'h2_1'),
      ]);

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(2);
      expect(headings[0].text).toBe('Title');
      expect(headings[0].nodeKey).toBe('heading-0'); // Fallback key based on lineIndex
      expect(headings[1].text).toBe('Valid Section');
      expect(headings[1].nodeKey).toBe('h2_1'); // Original key preserved
    });

    it('generates fallback key for heading with empty __key', () => {
      const content = createContent([
        {
          type: 'heading',
          tag: 'h1',
          __key: '',
          children: [{ type: 'text', text: 'Title' }],
        },
        createHeading(2, 'Valid Section', 'h2_1'),
      ]);

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(2);
      expect(headings[0].text).toBe('Title');
      expect(headings[0].nodeKey).toBe('heading-0'); // Fallback key
      expect(headings[1].nodeKey).toBe('h2_1');
    });

    it('skips heading missing tag property', () => {
      const content = createContent([
        {
          type: 'heading',
          __key: 'h_notag',
          // Missing tag
          children: [{ type: 'text', text: 'No Tag' }],
        },
        createHeading(2, 'Valid Section', 'h2_1'),
      ]);

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].text).toBe('Valid Section');
    });

    it('skips heading with invalid tag format', () => {
      const content = createContent([
        {
          type: 'heading',
          __key: 'h_invalid',
          tag: 'h7', // Invalid - only h1-h6 are valid
          children: [{ type: 'text', text: 'Invalid' }],
        },
        {
          type: 'heading',
          __key: 'h_weird',
          tag: 'title', // Not a heading tag
          children: [{ type: 'text', text: 'Weird' }],
        },
        createHeading(2, 'Valid Section', 'h2_1'),
      ]);

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].text).toBe('Valid Section');
    });
  });

  describe('text hash generation', () => {
    it('generates different hashes for different text', () => {
      const content = createContent([
        createHeading(1, 'Title A', 'h1_1'),
        createHeading(1, 'Title B', 'h1_2'),
      ]);

      const headings = extractHeadings(content);

      expect(headings[0].textHash).not.toBe(headings[1].textHash);
    });

    it('generates same hash for same text', () => {
      const content = createContent([
        createHeading(1, 'Same Title', 'h1_1'),
        createHeading(1, 'Same Title', 'h1_2'),
      ]);

      const headings = extractHeadings(content);

      expect(headings[0].textHash).toBe(headings[1].textHash);
    });

    it('generates deterministic hashes', () => {
      const content = createContent([createHeading(1, 'Test Title', 'h1_1')]);

      const headings1 = extractHeadings(content);
      const headings2 = extractHeadings(content);

      expect(headings1[0].textHash).toBe(headings2[0].textHash);
    });
  });

  describe('complex document structure', () => {
    it('handles a realistic document structure', () => {
      const content = createContent([
        createHeading(1, 'Project Plan', 'h1_1'),
        createParagraph('Introduction text...', 'p1'),
        createHeading(2, 'Goals', 'h2_1'),
        createParagraph('Goal list...', 'p2'),
        createHeading(3, 'Short-term', 'h3_1'),
        createHeading(3, 'Long-term', 'h3_2'),
        createHeading(2, 'Timeline', 'h2_2'),
        createCodeBlock([createHeading(3, 'Code Example', 'h3_code')], 'code_1'),
        createHeading(3, 'Phase 1', 'h3_3'),
        createHeading(3, 'Phase 2', 'h3_4'),
        createHeading(2, 'Resources', 'h2_3'),
      ]);

      const headings = extractHeadings(content);

      expect(headings).toHaveLength(8);
      expect(headings.map((h) => ({ text: h.text, level: h.level, depth: h.depth }))).toEqual([
        { text: 'Project Plan', level: 1, depth: 0 },
        { text: 'Goals', level: 2, depth: 1 },
        { text: 'Short-term', level: 3, depth: 2 },
        { text: 'Long-term', level: 3, depth: 2 },
        { text: 'Timeline', level: 2, depth: 1 },
        { text: 'Phase 1', level: 3, depth: 2 },
        { text: 'Phase 2', level: 3, depth: 2 },
        { text: 'Resources', level: 2, depth: 1 },
      ]);
    });
  });
});
