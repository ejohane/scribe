/**
 * Tests for metadata extraction
 */

import { describe, it, expect } from 'vitest';
import { extractMetadata, extractTags, extractLinks, extractMentions } from './metadata.js';
import type { EditorContent } from '@scribe/shared';

describe('extractTags', () => {
  it('should extract tags from text', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'This is a note with #scribe and #architecture tags',
              },
            ],
          },
        ],
      },
    };

    const tags = extractTags(content);
    expect(tags).toEqual(['architecture', 'scribe']);
  });

  it('should return empty array for content with no tags', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'No tags here',
              },
            ],
          },
        ],
      },
    };

    expect(extractTags(content)).toEqual([]);
  });

  it('should deduplicate tags', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: '#duplicate appears #duplicate twice',
              },
            ],
          },
        ],
      },
    };

    expect(extractTags(content)).toEqual(['duplicate']);
  });

  it('should extract tags from multiple paragraphs', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'First paragraph with #first',
              },
            ],
          },
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'Second paragraph with #second',
              },
            ],
          },
        ],
      },
    };

    expect(extractTags(content)).toEqual(['first', 'second']);
  });

  it('should support tags with hyphens and underscores', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'Tags like #multi-word and #snake_case',
              },
            ],
          },
        ],
      },
    };

    expect(extractTags(content)).toEqual(['multi-word', 'snake_case']);
  });
});

describe('extractLinks', () => {
  it('should extract links from link nodes with note:// protocol', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'note://note-123',
                children: [
                  {
                    type: 'text',
                    text: 'Link to note',
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    expect(extractLinks(content)).toEqual(['note-123']);
  });

  it('should extract links from wiki-link style URLs', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: '[[note-456]]',
                children: [],
              },
            ],
          },
        ],
      },
    };

    expect(extractLinks(content)).toEqual(['note-456']);
  });

  it('should extract links from entity-reference nodes', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'entity-reference',
                entityType: 'note',
                id: 'note-789',
              },
            ],
          },
        ],
      },
    };

    expect(extractLinks(content)).toEqual(['note-789']);
  });

  it('should extract links from note-reference nodes', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'note-reference',
                noteId: 'note-abc',
              },
            ],
          },
        ],
      },
    };

    expect(extractLinks(content)).toEqual(['note-abc']);
  });

  it('should return empty array for content with no links', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'No links here',
              },
            ],
          },
        ],
      },
    };

    expect(extractLinks(content)).toEqual([]);
  });

  it('should deduplicate links', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'note://note-123',
                children: [],
              },
            ],
          },
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'note://note-123',
                children: [],
              },
            ],
          },
        ],
      },
    };

    expect(extractLinks(content)).toEqual(['note-123']);
  });

  it('should extract wiki-link nodes with resolved targetId', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'wiki-link',
                noteTitle: 'Meeting Notes',
                displayText: 'Meeting Notes',
                targetId: 'note-123',
              },
            ],
          },
        ],
      },
    };

    expect(extractLinks(content)).toEqual(['note-123']);
  });

  it('should ignore wiki-link nodes with null targetId', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'wiki-link',
                noteTitle: 'New Note',
                displayText: 'New Note',
                targetId: null,
              },
            ],
          },
        ],
      },
    };

    expect(extractLinks(content)).toEqual([]);
  });
});

describe('extractMentions', () => {
  it('should extract mentions from person-mention nodes', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'Meeting with ',
              },
              {
                type: 'person-mention',
                personId: 'person-123',
                personName: 'John Smith',
              },
            ],
          },
        ],
      },
    };

    expect(extractMentions(content)).toEqual(['person-123']);
  });

  it('should return empty array for content with no mentions', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'No mentions here',
              },
            ],
          },
        ],
      },
    };

    expect(extractMentions(content)).toEqual([]);
  });

  it('should deduplicate mentions', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'person-mention',
                personId: 'person-123',
                personName: 'John Smith',
              },
              {
                type: 'text',
                text: ' and again ',
              },
              {
                type: 'person-mention',
                personId: 'person-123',
                personName: 'John Smith',
              },
            ],
          },
        ],
      },
    };

    expect(extractMentions(content)).toEqual(['person-123']);
  });

  it('should extract mentions from multiple paragraphs', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'person-mention',
                personId: 'person-1',
                personName: 'John',
              },
            ],
          },
          {
            type: 'paragraph',
            children: [
              {
                type: 'person-mention',
                personId: 'person-2',
                personName: 'Jane',
              },
            ],
          },
        ],
      },
    };

    expect(extractMentions(content)).toEqual(['person-1', 'person-2']);
  });

  it('should extract mentions from nested structures', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'quote',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'person-mention',
                    personId: 'person-nested',
                    personName: 'Nested Person',
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    expect(extractMentions(content)).toEqual(['person-nested']);
  });

  it('should handle person-mention nodes with missing personId gracefully', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'person-mention',
                // Missing personId
                personName: 'Missing ID',
              },
              {
                type: 'person-mention',
                personId: 'person-valid',
                personName: 'Valid Person',
              },
            ],
          },
        ],
      },
    };

    // Should only include the valid mention
    expect(extractMentions(content)).toEqual(['person-valid']);
  });

  it('should return empty array for empty content', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [],
      },
    };

    expect(extractMentions(content)).toEqual([]);
  });

  it('should return empty array for undefined root children', () => {
    // Testing malformed content that doesn't conform to NoteContent type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Intentional: testing defensive handling of malformed input
    const content: any = {
      root: {
        type: 'root',
        // Missing children property
      },
    };

    expect(extractMentions(content)).toEqual([]);
  });
});

describe('extractMetadata', () => {
  it('should extract all metadata from content with title always null', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'My Note Title with #scribe tag',
              },
            ],
          },
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'note://linked-note',
                children: [],
              },
            ],
          },
        ],
      },
    };

    const metadata = extractMetadata(content);
    // metadata.title is always null - title is now stored on Note.title
    expect(metadata.title).toBeNull();
    expect(metadata.tags).toEqual(['scribe']);
    expect(metadata.links).toEqual(['linked-note']);
  });

  it('should extract mentions in metadata', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'Meeting with ',
              },
              {
                type: 'person-mention',
                personId: 'person-123',
                personName: 'John Smith',
              },
            ],
          },
        ],
      },
    };

    const metadata = extractMetadata(content);
    expect(metadata.title).toBeNull(); // title is always null
    expect(metadata.mentions).toEqual(['person-123']);
  });

  it('should always return null for title field', () => {
    const content: EditorContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'Some content that would have been a title',
              },
            ],
          },
        ],
      },
    };

    const metadata = extractMetadata(content);
    // Title is now stored on Note.title, not derived from metadata
    expect(metadata.title).toBeNull();
  });
});
