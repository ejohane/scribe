/**
 * Tests for content.ts - Lexical editor content creation utilities
 *
 * Tests cover:
 * - Empty content creation
 * - Daily note content structure
 * - Meeting note content structure
 * - Person note content structure
 * - Content independence (no shared references)
 * - Lexical node structure validation
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyContent,
  createDailyContent,
  createMeetingContent,
  createPersonContent,
} from './content.js';
import type { EditorContent } from './types.js';

describe('content', () => {
  describe('createEmptyContent', () => {
    it('creates valid EditorContent structure', () => {
      const content = createEmptyContent();
      expect(content.root).toBeDefined();
      expect(content.root.type).toBe('root');
    });

    it('root has required Lexical properties', () => {
      const content = createEmptyContent();
      expect(content.root.format).toBe('');
      expect(content.root.indent).toBe(0);
      expect(content.root.version).toBe(1);
    });

    it('includes single empty paragraph as child', () => {
      const content = createEmptyContent();
      expect(content.root.children).toHaveLength(1);
      const paragraph = content.root.children[0] as Record<string, unknown>;
      expect(paragraph.type).toBe('paragraph');
    });

    it('paragraph has correct structure', () => {
      const content = createEmptyContent();
      const paragraph = content.root.children[0] as Record<string, unknown>;
      expect(paragraph.children).toEqual([]);
      expect(paragraph.format).toBe('');
      expect(paragraph.indent).toBe(0);
      expect(paragraph.direction).toBeNull();
      expect(paragraph.version).toBe(1);
    });

    it('creates independent instances (not shared references)', () => {
      const content1 = createEmptyContent();
      const content2 = createEmptyContent();

      // Modify content1
      (content1.root.children[0] as Record<string, unknown>).testProp = 'modified';

      // content2 should not be affected
      expect((content2.root.children[0] as Record<string, unknown>).testProp).toBeUndefined();
    });

    it('returns EditorContent type', () => {
      const content: EditorContent = createEmptyContent();
      expect(content).toBeDefined();
      expect(content.root).toBeDefined();
    });
  });

  describe('createDailyContent', () => {
    it('creates valid EditorContent structure', () => {
      const content = createDailyContent();
      expect(content.root).toBeDefined();
      expect(content.root.type).toBe('root');
    });

    it('root has required Lexical properties', () => {
      const content = createDailyContent();
      expect(content.root.format).toBe('');
      expect(content.root.indent).toBe(0);
      expect(content.root.version).toBe(1);
    });

    it('includes single empty paragraph as child', () => {
      const content = createDailyContent();
      expect(content.root.children).toHaveLength(1);
      const paragraph = content.root.children[0] as Record<string, unknown>;
      expect(paragraph.type).toBe('paragraph');
    });

    it('paragraph has correct structure', () => {
      const content = createDailyContent();
      const paragraph = content.root.children[0] as Record<string, unknown>;
      expect(paragraph.children).toEqual([]);
      expect(paragraph.format).toBe('');
      expect(paragraph.indent).toBe(0);
      expect(paragraph.direction).toBeNull();
      expect(paragraph.version).toBe(1);
    });

    it('sets type property to daily', () => {
      const content = createDailyContent();
      expect((content as unknown as { type: string }).type).toBe('daily');
    });

    it('creates independent instances', () => {
      const content1 = createDailyContent();
      const content2 = createDailyContent();

      // Modify content1
      (content1.root.children[0] as Record<string, unknown>).testProp = 'modified';

      // content2 should not be affected
      expect((content2.root.children[0] as Record<string, unknown>).testProp).toBeUndefined();
    });
  });

  describe('createMeetingContent', () => {
    it('creates valid EditorContent structure', () => {
      const content = createMeetingContent();
      expect(content.root).toBeDefined();
      expect(content.root.type).toBe('root');
    });

    it('root has required Lexical properties', () => {
      const content = createMeetingContent();
      expect(content.root.format).toBe('');
      expect(content.root.indent).toBe(0);
      expect(content.root.version).toBe(1);
    });

    it('includes single empty paragraph as child', () => {
      const content = createMeetingContent();
      expect(content.root.children).toHaveLength(1);
      const paragraph = content.root.children[0] as Record<string, unknown>;
      expect(paragraph.type).toBe('paragraph');
    });

    it('paragraph has correct structure', () => {
      const content = createMeetingContent();
      const paragraph = content.root.children[0] as Record<string, unknown>;
      expect(paragraph.children).toEqual([]);
      expect(paragraph.format).toBe('');
      expect(paragraph.indent).toBe(0);
      expect(paragraph.direction).toBeNull();
      expect(paragraph.version).toBe(1);
    });

    it('sets type property to meeting', () => {
      const content = createMeetingContent();
      expect((content as unknown as { type: string }).type).toBe('meeting');
    });

    it('creates independent instances', () => {
      const content1 = createMeetingContent();
      const content2 = createMeetingContent();

      // Modify content1
      (content1.root.children[0] as Record<string, unknown>).testProp = 'modified';

      // content2 should not be affected
      expect((content2.root.children[0] as Record<string, unknown>).testProp).toBeUndefined();
    });
  });

  describe('createPersonContent', () => {
    it('creates valid EditorContent structure', () => {
      const content = createPersonContent('Alice');
      expect(content.root).toBeDefined();
      expect(content.root.type).toBe('root');
    });

    it('root has required Lexical properties', () => {
      const content = createPersonContent('Bob');
      expect(content.root.format).toBe('');
      expect(content.root.indent).toBe(0);
      expect(content.root.version).toBe(1);
    });

    it('includes H1 heading with person name', () => {
      const content = createPersonContent('Charlie');
      expect(content.root.children).toHaveLength(2);

      const heading = content.root.children[0] as Record<string, unknown>;
      expect(heading.type).toBe('heading');
      expect(heading.tag).toBe('h1');
    });

    it('heading contains person name as text', () => {
      const content = createPersonContent('Diana');
      const heading = content.root.children[0] as Record<string, unknown>;
      const textNode = (heading.children as Record<string, unknown>[])[0];

      expect(textNode.type).toBe('text');
      expect(textNode.text).toBe('Diana');
    });

    it('heading text has correct structure', () => {
      const content = createPersonContent('Eve');
      const heading = content.root.children[0] as Record<string, unknown>;
      const textNode = (heading.children as Record<string, unknown>[])[0];

      expect(textNode.format).toBe(0);
      expect(textNode.mode).toBe('normal');
      expect(textNode.style).toBe('');
      expect(textNode.detail).toBe(0);
      expect(textNode.version).toBe(1);
    });

    it('includes empty paragraph after heading', () => {
      const content = createPersonContent('Frank');
      const paragraph = content.root.children[1] as Record<string, unknown>;

      expect(paragraph.type).toBe('paragraph');
      expect(paragraph.children).toEqual([]);
    });

    it('paragraph has correct structure', () => {
      const content = createPersonContent('Grace');
      const paragraph = content.root.children[1] as Record<string, unknown>;

      expect(paragraph.direction).toBeNull();
      expect(paragraph.format).toBe('');
      expect(paragraph.indent).toBe(0);
      expect(paragraph.version).toBe(1);
    });

    it('sets type property to person', () => {
      const content = createPersonContent('Henry');
      expect((content as unknown as { type: string }).type).toBe('person');
    });

    it('handles name with special characters', () => {
      const content = createPersonContent("O'Brien-Smith");
      const heading = content.root.children[0] as Record<string, unknown>;
      const textNode = (heading.children as Record<string, unknown>[])[0];

      expect(textNode.text).toBe("O'Brien-Smith");
    });

    it('handles name with emoji', () => {
      const content = createPersonContent('Alice ');
      const heading = content.root.children[0] as Record<string, unknown>;
      const textNode = (heading.children as Record<string, unknown>[])[0];

      expect(textNode.text).toBe('Alice ');
    });

    it('handles empty name', () => {
      const content = createPersonContent('');
      const heading = content.root.children[0] as Record<string, unknown>;
      const textNode = (heading.children as Record<string, unknown>[])[0];

      expect(textNode.text).toBe('');
    });

    it('handles very long name', () => {
      const longName = 'A'.repeat(500);
      const content = createPersonContent(longName);
      const heading = content.root.children[0] as Record<string, unknown>;
      const textNode = (heading.children as Record<string, unknown>[])[0];

      expect(textNode.text).toBe(longName);
    });

    it('creates independent instances', () => {
      const content1 = createPersonContent('Alice');
      const content2 = createPersonContent('Bob');

      // Modify content1's heading text
      const heading1 = content1.root.children[0] as Record<string, unknown>;
      ((heading1.children as Record<string, unknown>[])[0] as Record<string, unknown>).text =
        'Modified';

      // content2 should not be affected
      const heading2 = content2.root.children[0] as Record<string, unknown>;
      expect((heading2.children as Record<string, unknown>[])[0].text).toBe('Bob');
    });

    it('different names create different content', () => {
      const contentAlice = createPersonContent('Alice');
      const contentBob = createPersonContent('Bob');

      const headingAlice = contentAlice.root.children[0] as Record<string, unknown>;
      const headingBob = contentBob.root.children[0] as Record<string, unknown>;

      expect((headingAlice.children as Record<string, unknown>[])[0].text).toBe('Alice');
      expect((headingBob.children as Record<string, unknown>[])[0].text).toBe('Bob');
    });
  });

  describe('content structure validation', () => {
    it('all content types have valid root node', () => {
      const contents = [
        createEmptyContent(),
        createDailyContent(),
        createMeetingContent(),
        createPersonContent('Test'),
      ];

      for (const content of contents) {
        expect(content.root).toBeDefined();
        expect(content.root.type).toBe('root');
        expect(content.root.children).toBeInstanceOf(Array);
        expect(content.root.children.length).toBeGreaterThan(0);
      }
    });

    it('all content types have version 1', () => {
      const contents = [
        createEmptyContent(),
        createDailyContent(),
        createMeetingContent(),
        createPersonContent('Test'),
      ];

      for (const content of contents) {
        expect(content.root.version).toBe(1);
      }
    });

    it('child nodes have required properties', () => {
      const contents = [
        createEmptyContent(),
        createDailyContent(),
        createMeetingContent(),
        createPersonContent('Test'),
      ];

      for (const content of contents) {
        for (const child of content.root.children) {
          const node = child as Record<string, unknown>;
          expect(node.type).toBeDefined();
          expect(node.version).toBe(1);
        }
      }
    });
  });
});
