import { describe, test, expect } from 'bun:test';
import { parseNote } from './index';
import type { RawFile } from '@scribe/domain-model';

describe('parseNote', () => {
  describe('basic parsing', () => {
    test('should parse a basic note', () => {
      const file: RawFile = {
        path: 'notes/test.md',
        content: 'Hello world',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.id).toBe('note:notes/test.md');
      expect(result.path).toBe('notes/test.md');
      expect(result.fileName).toBe('test.md');
      expect(result.resolvedTitle).toBe('test');
      expect(result.plainText).toContain('Hello world');
    });

    test('should extract file name from path', () => {
      const file: RawFile = {
        path: 'deep/nested/path/document.md',
        content: 'Content',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.fileName).toBe('document.md');
      expect(result.resolvedTitle).toBe('document');
    });

    test('should handle path without extension', () => {
      const file: RawFile = {
        path: 'notes/readme',
        content: 'Content',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.fileName).toBe('readme');
      expect(result.resolvedTitle).toBe('readme');
    });

    test('should initialize empty arrays and objects', () => {
      const file: RawFile = {
        path: 'test.md',
        content: 'Test',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.frontmatter).toEqual({});
      expect(result.inlineTags).toEqual([]);
      expect(result.fmTags).toEqual([]);
      expect(result.allTags).toEqual([]);
      expect(result.aliases).toEqual([]);
      expect(result.headings).toEqual([]);
      expect(result.links).toEqual([]);
      expect(result.embeds).toEqual([]);
      expect(result.peopleMentions).toEqual([]);
    });
  });

  describe('frontmatter parsing', () => {
    test('should extract YAML frontmatter', () => {
      const file: RawFile = {
        path: 'test.md',
        content: `---
title: Test Note
tags:
  - planning
  - architecture
aliases:
  - Test Alias
---
Body content`,
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.frontmatter.title).toBe('Test Note');
      expect(result.frontmatterTitle).toBe('Test Note');
      expect(result.resolvedTitle).toBe('Test Note');
      expect(result.fmTags).toEqual(['tag:planning', 'tag:architecture']);
      expect(result.aliases).toEqual(['Test Alias']);
    });

    test('should handle single string tags', () => {
      const file: RawFile = {
        path: 'test.md',
        content: `---
tags: single-tag
---`,
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.fmTags).toEqual(['tag:single-tag']);
    });

    test('should handle single string aliases', () => {
      const file: RawFile = {
        path: 'test.md',
        content: `---
aliases: Single Alias
---`,
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.aliases).toEqual(['Single Alias']);
    });

    test('should tolerate malformed frontmatter', () => {
      const file: RawFile = {
        path: 'test.md',
        content: `---
bad yaml: [unclosed
---
Body content`,
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      // Should not throw, should continue parsing
      expect(result.plainText).toContain('Body content');
    });
  });

  describe('title resolution', () => {
    test('should prefer frontmatter title over H1', () => {
      const file: RawFile = {
        path: 'test.md',
        content: `---
title: Frontmatter Title
---
# H1 Title`,
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.frontmatterTitle).toBe('Frontmatter Title');
      expect(result.h1Title).toBe('H1 Title');
      expect(result.resolvedTitle).toBe('Frontmatter Title');
    });

    test('should use H1 if no frontmatter title', () => {
      const file: RawFile = {
        path: 'test.md',
        content: '# H1 Title\n\nContent',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.frontmatterTitle).toBeUndefined();
      expect(result.h1Title).toBe('H1 Title');
      expect(result.resolvedTitle).toBe('H1 Title');
    });

    test('should use filename if no frontmatter or H1', () => {
      const file: RawFile = {
        path: 'My Note.md',
        content: 'Just content',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.frontmatterTitle).toBeUndefined();
      expect(result.h1Title).toBeUndefined();
      expect(result.resolvedTitle).toBe('My Note');
    });
  });

  describe('heading extraction', () => {
    test('should extract all heading levels', () => {
      const file: RawFile = {
        path: 'test.md',
        content: `# H1
## H2
### H3
#### H4
##### H5
###### H6`,
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.headings).toHaveLength(6);
      expect(result.headings[0].level).toBe(1);
      expect(result.headings[0].rawText).toBe('H1');
      expect(result.headings[1].level).toBe(2);
      expect(result.headings[1].rawText).toBe('H2');
    });

    test('should normalize heading anchors', () => {
      const file: RawFile = {
        path: 'test.md',
        content: '## Goals & Scope',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.headings[0].normalized).toBe('goals-scope');
    });

    test('should track heading line numbers', () => {
      const file: RawFile = {
        path: 'test.md',
        content: `Line 1
## Heading on line 2
Line 3`,
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.headings[0].line).toBe(2);
    });
  });

  describe('inline tag extraction', () => {
    test('should extract inline tags', () => {
      const file: RawFile = {
        path: 'test.md',
        content: 'This is #planning and #architecture content',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.inlineTags).toContain('tag:planning');
      expect(result.inlineTags).toContain('tag:architecture');
    });

    test('should handle tags with underscores and dashes', () => {
      const file: RawFile = {
        path: 'test.md',
        content: '#deep_work #high-priority',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.inlineTags).toContain('tag:deep_work');
      expect(result.inlineTags).toContain('tag:high-priority');
    });

    test('should normalize tags to lowercase', () => {
      const file: RawFile = {
        path: 'test.md',
        content: '#UPPERCASE #MixedCase',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.inlineTags).toContain('tag:uppercase');
      expect(result.inlineTags).toContain('tag:mixedcase');
    });

    test('should deduplicate tags', () => {
      const file: RawFile = {
        path: 'test.md',
        content: '#planning #planning #planning',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.inlineTags.filter((t) => t === 'tag:planning')).toHaveLength(1);
    });
  });

  describe('tag merging', () => {
    test('should merge inline and frontmatter tags', () => {
      const file: RawFile = {
        path: 'test.md',
        content: `---
tags:
  - planning
---
This is #architecture content`,
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.allTags).toContain('tag:planning');
      expect(result.allTags).toContain('tag:architecture');
      expect(result.allTags).toHaveLength(2);
    });

    test('should deduplicate merged tags', () => {
      const file: RawFile = {
        path: 'test.md',
        content: `---
tags:
  - planning
---
This is #planning content`,
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.allTags.filter((t) => t === 'tag:planning')).toHaveLength(1);
    });
  });

  describe('link extraction', () => {
    test('should extract basic links', () => {
      const file: RawFile = {
        path: 'test.md',
        content: 'Link to [[Other Note]]',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.links).toHaveLength(1);
      expect(result.links[0].noteName).toBe('Other Note');
      expect(result.links[0].raw).toBe('[[Other Note]]');
    });

    test('should extract links with headings', () => {
      const file: RawFile = {
        path: 'test.md',
        content: 'Link to [[Note#Heading]]',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.links[0].noteName).toBe('Note');
      expect(result.links[0].headingText).toBe('Heading');
    });

    test('should track link positions', () => {
      const file: RawFile = {
        path: 'test.md',
        content: `Line 1
Link to [[Note]] on line 2`,
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.links[0].position.line).toBe(2);
      expect(result.links[0].position.column).toBeGreaterThan(0);
    });

    test('should handle multiple links', () => {
      const file: RawFile = {
        path: 'test.md',
        content: '[[Note1]] and [[Note2]] and [[Note3]]',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.links).toHaveLength(3);
      expect(result.links[0].noteName).toBe('Note1');
      expect(result.links[1].noteName).toBe('Note2');
      expect(result.links[2].noteName).toBe('Note3');
    });
  });

  describe('embed extraction', () => {
    test('should extract embeds', () => {
      const file: RawFile = {
        path: 'test.md',
        content: 'Embed: ![[Other Note]]',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.embeds).toHaveLength(1);
      expect(result.embeds[0].noteName).toBe('Other Note');
      expect(result.embeds[0].raw).toBe('![[Other Note]]');
    });

    test('should not confuse embeds with links', () => {
      const file: RawFile = {
        path: 'test.md',
        content: '[[Link]] and ![[Embed]]',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.links).toHaveLength(1);
      expect(result.links[0].noteName).toBe('Link');
      expect(result.embeds).toHaveLength(1);
      expect(result.embeds[0].noteName).toBe('Embed');
    });
  });

  describe('person mention extraction', () => {
    test('should extract person mentions', () => {
      const file: RawFile = {
        path: 'test.md',
        content: 'Met with @Erik today',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.peopleMentions).toHaveLength(1);
      expect(result.peopleMentions[0].personName).toBe('Erik');
      expect(result.peopleMentions[0].raw).toBe('@Erik');
    });

    test('should extract multiple mentions', () => {
      const file: RawFile = {
        path: 'test.md',
        content: 'Met with @Erik and @Mary today',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.peopleMentions).toHaveLength(2);
      expect(result.peopleMentions[0].personName).toBe('Erik');
      expect(result.peopleMentions[1].personName).toBe('Mary');
    });

    test('should track mention positions', () => {
      const file: RawFile = {
        path: 'test.md',
        content: `Line 1
@Erik on line 2`,
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.peopleMentions[0].position.line).toBe(2);
    });

    test('should handle mentions with underscores', () => {
      const file: RawFile = {
        path: 'test.md',
        content: 'Met with @Mary_Smith',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.peopleMentions[0].personName).toBe('Mary_Smith');
    });
  });

  describe('plain text extraction', () => {
    test('should strip markdown formatting', () => {
      const file: RawFile = {
        path: 'test.md',
        content: '**bold** and *italic* and `code`',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.plainText).toContain('bold');
      expect(result.plainText).toContain('italic');
      expect(result.plainText).toContain('code');
      expect(result.plainText).not.toContain('**');
      expect(result.plainText).not.toContain('`');
    });

    test('should strip links but keep text', () => {
      const file: RawFile = {
        path: 'test.md',
        content: 'Link to [[Note]]',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.plainText).toContain('Note');
      expect(result.plainText).not.toContain('[[');
    });

    test('should strip heading markers', () => {
      const file: RawFile = {
        path: 'test.md',
        content: '## Heading',
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      expect(result.plainText).toContain('Heading');
      expect(result.plainText).not.toContain('##');
    });
  });

  describe('complex real-world example', () => {
    test('should parse a complete note', () => {
      const file: RawFile = {
        path: 'notes/2025/Planning.md',
        content: `---
title: 2025 Planning
tags:
  - planning
  - 2025
aliases:
  - Planning Doc
  - 2025 Plan
---

# 2025 Planning

This is a planning document for 2025.

## Goals

- Work with @Erik on #architecture
- Review [[Previous Planning]]
- Embed the graph: ![[Graph Overview]]

## References

See [[Architecture]] and [[Design#Implementation]] for details.

#planning #deep_work
`,
        lastModified: Date.now(),
      };

      const result = parseNote(file);

      // Title resolution
      expect(result.frontmatterTitle).toBe('2025 Planning');
      expect(result.h1Title).toBe('2025 Planning');
      expect(result.resolvedTitle).toBe('2025 Planning');

      // Tags
      expect(result.fmTags).toContain('tag:planning');
      expect(result.fmTags).toContain('tag:2025');
      expect(result.inlineTags).toContain('tag:architecture');
      expect(result.inlineTags).toContain('tag:deep_work');
      expect(result.allTags.length).toBeGreaterThan(0);

      // Aliases
      expect(result.aliases).toContain('Planning Doc');
      expect(result.aliases).toContain('2025 Plan');

      // Headings
      expect(result.headings.length).toBeGreaterThan(0);
      const goalsHeading = result.headings.find((h) => h.rawText === 'Goals');
      expect(goalsHeading).toBeDefined();
      expect(goalsHeading?.level).toBe(2);

      // Links
      expect(result.links.length).toBeGreaterThan(0);
      const archLink = result.links.find((l) => l.noteName === 'Architecture');
      expect(archLink).toBeDefined();
      const designLink = result.links.find((l) => l.noteName === 'Design');
      expect(designLink).toBeDefined();
      expect(designLink?.headingText).toBe('Implementation');

      // Embeds
      expect(result.embeds.length).toBeGreaterThan(0);
      expect(result.embeds[0].noteName).toBe('Graph Overview');

      // People mentions
      expect(result.peopleMentions.length).toBeGreaterThan(0);
      expect(result.peopleMentions[0].personName).toBe('Erik');

      // Plain text
      expect(result.plainText).toContain('planning document');
      expect(result.plainText).toContain('Goals');
    });
  });
});
