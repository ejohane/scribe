/**
 * Tests for MetadataIndex
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetadataIndex } from './metadata-index.js';
import type { NoteMetadata } from '@scribe/shared';

describe('MetadataIndex', () => {
  let index: MetadataIndex;

  beforeEach(() => {
    index = new MetadataIndex();
  });

  describe('set and get', () => {
    it('should store and retrieve metadata', () => {
      const metadata: NoteMetadata = {
        title: 'Test Note',
        tags: ['test'],
        links: [],
        mentions: [],
      };

      index.set('note-1', metadata);
      expect(index.get('note-1')).toEqual(metadata);
    });

    it('should return undefined for non-existent note', () => {
      expect(index.get('non-existent')).toBeUndefined();
    });

    it('should update metadata when set is called again', () => {
      const metadata1: NoteMetadata = {
        title: 'First Title',
        tags: ['tag1'],
        links: [],
        mentions: [],
      };

      const metadata2: NoteMetadata = {
        title: 'Second Title',
        tags: ['tag2'],
        links: [],
        mentions: [],
      };

      index.set('note-1', metadata1);
      index.set('note-1', metadata2);

      expect(index.get('note-1')).toEqual(metadata2);
    });
  });

  describe('delete', () => {
    it('should remove metadata for a note', () => {
      const metadata: NoteMetadata = {
        title: 'Test Note',
        tags: ['test'],
        links: [],
        mentions: [],
      };

      index.set('note-1', metadata);
      index.delete('note-1');

      expect(index.get('note-1')).toBeUndefined();
    });

    it('should not throw when deleting non-existent note', () => {
      expect(() => index.delete('non-existent')).not.toThrow();
    });
  });

  describe('tag indexing', () => {
    it('should index notes by tag', () => {
      const metadata1: NoteMetadata = {
        title: 'Note 1',
        tags: ['scribe', 'architecture'],
        links: [],
        mentions: [],
      };

      const metadata2: NoteMetadata = {
        title: 'Note 2',
        tags: ['scribe', 'design'],
        links: [],
        mentions: [],
      };

      index.set('note-1', metadata1);
      index.set('note-2', metadata2);

      expect(index.getNotesWithTag('scribe')).toEqual(['note-1', 'note-2']);
      expect(index.getNotesWithTag('architecture')).toEqual(['note-1']);
      expect(index.getNotesWithTag('design')).toEqual(['note-2']);
    });

    it('should return empty array for non-existent tag', () => {
      expect(index.getNotesWithTag('non-existent')).toEqual([]);
    });

    it('should remove tag index when note is deleted', () => {
      const metadata: NoteMetadata = {
        title: 'Test Note',
        tags: ['test'],
        links: [],
        mentions: [],
      };

      index.set('note-1', metadata);
      index.delete('note-1');

      expect(index.getNotesWithTag('test')).toEqual([]);
    });

    it('should update tag index when metadata is updated', () => {
      const metadata1: NoteMetadata = {
        title: 'Test Note',
        tags: ['old-tag'],
        links: [],
        mentions: [],
      };

      const metadata2: NoteMetadata = {
        title: 'Test Note',
        tags: ['new-tag'],
        links: [],
        mentions: [],
      };

      index.set('note-1', metadata1);
      index.set('note-1', metadata2);

      expect(index.getNotesWithTag('old-tag')).toEqual([]);
      expect(index.getNotesWithTag('new-tag')).toEqual(['note-1']);
    });

    it('should get all tags', () => {
      const metadata1: NoteMetadata = {
        title: 'Note 1',
        tags: ['alpha', 'beta'],
        links: [],
        mentions: [],
      };

      const metadata2: NoteMetadata = {
        title: 'Note 2',
        tags: ['gamma', 'alpha'],
        links: [],
        mentions: [],
      };

      index.set('note-1', metadata1);
      index.set('note-2', metadata2);

      expect(index.getAllTags()).toEqual(['alpha', 'beta', 'gamma']);
    });
  });

  describe('backlink indexing', () => {
    it('should index backlinks', () => {
      const metadata1: NoteMetadata = {
        title: 'Note 1',
        tags: [],
        links: ['note-2', 'note-3'],
        mentions: [],
      };

      const metadata2: NoteMetadata = {
        title: 'Note 2',
        tags: [],
        links: ['note-3'],
        mentions: [],
      };

      index.set('note-1', metadata1);
      index.set('note-2', metadata2);

      // note-2 is linked from note-1
      expect(index.getBacklinks('note-2')).toEqual(['note-1']);

      // note-3 is linked from both note-1 and note-2
      expect(index.getBacklinks('note-3').sort()).toEqual(['note-1', 'note-2']);
    });

    it('should return empty array for note with no backlinks', () => {
      expect(index.getBacklinks('note-1')).toEqual([]);
    });

    it('should remove backlinks when note is deleted', () => {
      const metadata: NoteMetadata = {
        title: 'Note 1',
        tags: [],
        links: ['note-2'],
        mentions: [],
      };

      index.set('note-1', metadata);
      index.delete('note-1');

      expect(index.getBacklinks('note-2')).toEqual([]);
    });

    it('should update backlinks when metadata is updated', () => {
      const metadata1: NoteMetadata = {
        title: 'Note 1',
        tags: [],
        links: ['note-2'],
        mentions: [],
      };

      const metadata2: NoteMetadata = {
        title: 'Note 1',
        tags: [],
        links: ['note-3'],
        mentions: [],
      };

      index.set('note-1', metadata1);
      index.set('note-1', metadata2);

      expect(index.getBacklinks('note-2')).toEqual([]);
      expect(index.getBacklinks('note-3')).toEqual(['note-1']);
    });
  });

  describe('clear', () => {
    it('should clear all indexes', () => {
      const metadata: NoteMetadata = {
        title: 'Test Note',
        tags: ['test'],
        links: ['note-2'],
        mentions: [],
      };

      index.set('note-1', metadata);
      index.clear();

      expect(index.get('note-1')).toBeUndefined();
      expect(index.getNotesWithTag('test')).toEqual([]);
      expect(index.getBacklinks('note-2')).toEqual([]);
      expect(index.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return number of indexed notes', () => {
      expect(index.size()).toBe(0);

      index.set('note-1', { title: 'Note 1', tags: [], links: [], mentions: [] });
      expect(index.size()).toBe(1);

      index.set('note-2', { title: 'Note 2', tags: [], links: [], mentions: [] });
      expect(index.size()).toBe(2);

      index.delete('note-1');
      expect(index.size()).toBe(1);
    });
  });
});
