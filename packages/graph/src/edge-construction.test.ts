/**
 * Tests for edge construction from parsed notes.
 */

import { describe, test, expect } from 'bun:test';
import {
  createGraphIndex,
  buildEdgesForNote,
  ensureNoteNode,
  ensurePersonNode,
  ensureTagNode,
  ensureFolderNode,
  ensureHeadingNode,
  getEdgesByType,
  hasNode,
  type EdgeConstructionContext,
} from './index.js';
import {
  NoteRegistry,
  FolderRegistry,
  HeadingRegistry,
  PeopleRegistry,
  type ParsedNote,
  type NoteId,
  type FilePath,
  type TagId,
  type PersonId,
  type HeadingId,
} from '@scribe/domain-model';

describe('Edge Construction', () => {
  describe('Node Creation Helpers', () => {
    test('ensureNoteNode creates node if missing', () => {
      const graph = createGraphIndex();
      const noteId = 'notes/Test' as NoteId;

      const nodeId = ensureNoteNode(graph, noteId);

      expect(nodeId).toBe('note:notes/Test');
      expect(hasNode(graph, nodeId)).toBe(true);
      const node = graph.nodes.get(nodeId);
      expect(node?.entityType).toBe('note');
      expect(node?.refId).toBe(noteId);
    });

    test('ensureNoteNode returns existing node', () => {
      const graph = createGraphIndex();
      const noteId = 'notes/Test' as NoteId;

      const nodeId1 = ensureNoteNode(graph, noteId);
      const nodeId2 = ensureNoteNode(graph, noteId);

      expect(nodeId1).toBe(nodeId2);
      expect(graph.nodes.size).toBe(1);
    });

    test('ensurePersonNode creates person node', () => {
      const graph = createGraphIndex();
      const personId = 'Erik' as PersonId;

      const nodeId = ensurePersonNode(graph, personId);

      expect(nodeId).toBe('person:Erik');
      expect(hasNode(graph, nodeId)).toBe(true);
      const node = graph.nodes.get(nodeId);
      expect(node?.entityType).toBe('person');
    });

    test('ensureTagNode creates tag node', () => {
      const graph = createGraphIndex();
      const tagId = 'planning' as TagId;

      const nodeId = ensureTagNode(graph, tagId);

      expect(nodeId).toBe('tag:planning');
      expect(hasNode(graph, nodeId)).toBe(true);
      const node = graph.nodes.get(nodeId);
      expect(node?.entityType).toBe('tag');
    });

    test('ensureFolderNode creates folder node', () => {
      const graph = createGraphIndex();
      const folderId = 'notes/2025' as any;

      const nodeId = ensureFolderNode(graph, folderId);

      expect(nodeId).toBe('folder:notes/2025');
      expect(hasNode(graph, nodeId)).toBe(true);
      const node = graph.nodes.get(nodeId);
      expect(node?.entityType).toBe('folder');
    });

    test('ensureHeadingNode creates heading node', () => {
      const graph = createGraphIndex();
      const headingId = 'notes/Test#overview' as HeadingId;

      const nodeId = ensureHeadingNode(graph, headingId);

      expect(nodeId).toBe('heading:notes/Test#overview');
      expect(hasNode(graph, nodeId)).toBe(true);
      const node = graph.nodes.get(nodeId);
      expect(node?.entityType).toBe('heading');
    });
  });

  describe('buildEdgesForNote', () => {
    function createTestContext(): EdgeConstructionContext {
      return {
        noteRegistry: new NoteRegistry(),
        headingIndex: new HeadingRegistry(),
        peopleIndex: new PeopleRegistry(),
        folderRegistry: new FolderRegistry(),
      };
    }

    test('builds folder containment edge', () => {
      const graph = createGraphIndex();
      const context = createTestContext();

      const parsed: ParsedNote = {
        id: 'notes/2025/Plan' as NoteId,
        path: 'notes/2025/Plan.md' as FilePath,
        fileName: 'Plan.md',
        resolvedTitle: 'Plan',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: [],
        aliases: [],
        headings: [],
        links: [],
        embeds: [],
        peopleMentions: [],
        plainText: '',
      };

      buildEdgesForNote(graph, parsed, context);

      // Check that folder node exists
      expect(hasNode(graph, 'folder:notes/2025' as any)).toBe(true);

      // Check that edge exists
      const edges = getEdgesByType(
        graph,
        'folder:notes/2025' as any,
        'folder-contains-note',
        'outgoing'
      );
      expect(edges).toHaveLength(1);
      expect(edges[0].to).toBe('note:notes/2025/Plan');
    });

    test('handles root-level notes without folder edge', () => {
      const graph = createGraphIndex();
      const context = createTestContext();

      const parsed: ParsedNote = {
        id: 'RootNote' as NoteId,
        path: 'RootNote.md' as FilePath,
        fileName: 'RootNote.md',
        resolvedTitle: 'Root Note',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: [],
        aliases: [],
        headings: [],
        links: [],
        embeds: [],
        peopleMentions: [],
        plainText: '',
      };

      buildEdgesForNote(graph, parsed, context);

      // Should only have the note node, no folder
      expect(graph.nodes.size).toBe(1);
      expect(hasNode(graph, 'note:RootNote' as any)).toBe(true);
    });

    test('builds tag edges', () => {
      const graph = createGraphIndex();
      const context = createTestContext();

      const parsed: ParsedNote = {
        id: 'notes/Plan' as NoteId,
        path: 'notes/Plan.md' as FilePath,
        fileName: 'Plan.md',
        resolvedTitle: 'Plan',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: ['planning' as TagId, 'goals' as TagId],
        aliases: [],
        headings: [],
        links: [],
        embeds: [],
        peopleMentions: [],
        plainText: '',
      };

      buildEdgesForNote(graph, parsed, context);

      // Check tag nodes exist
      expect(hasNode(graph, 'tag:planning' as any)).toBe(true);
      expect(hasNode(graph, 'tag:goals' as any)).toBe(true);

      // Check edges exist
      const tagEdges = getEdgesByType(graph, 'note:notes/Plan' as any, 'note-has-tag', 'outgoing');
      expect(tagEdges).toHaveLength(2);
      expect(tagEdges.map((e) => e.to).sort()).toEqual(['tag:goals', 'tag:planning']);
    });

    test('builds person mention edges for resolved people', () => {
      const graph = createGraphIndex();
      const context = createTestContext();

      // Add Erik to people index
      context.peopleIndex.addPerson({
        id: 'Erik' as PersonId,
        name: 'Erik',
        noteId: 'people/Erik' as NoteId,
        path: 'people/Erik.md' as FilePath,
        metadata: {},
      });

      const parsed: ParsedNote = {
        id: 'notes/Meeting' as NoteId,
        path: 'notes/Meeting.md' as FilePath,
        fileName: 'Meeting.md',
        resolvedTitle: 'Meeting',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: [],
        aliases: [],
        headings: [],
        links: [],
        embeds: [],
        peopleMentions: [
          {
            raw: '@Erik',
            personName: 'Erik',
            position: { line: 1, column: 0 },
          },
        ],
        plainText: '',
      };

      buildEdgesForNote(graph, parsed, context);

      // Check person node exists
      expect(hasNode(graph, 'person:Erik' as any)).toBe(true);

      // Check edge exists
      const personEdges = getEdgesByType(
        graph,
        'note:notes/Meeting' as any,
        'note-mentions-person',
        'outgoing'
      );
      expect(personEdges).toHaveLength(1);
      expect(personEdges[0].to).toBe('person:Erik');
    });

    test('ignores unresolved person mentions', () => {
      const graph = createGraphIndex();
      const context = createTestContext();

      const parsed: ParsedNote = {
        id: 'notes/Meeting' as NoteId,
        path: 'notes/Meeting.md' as FilePath,
        fileName: 'Meeting.md',
        resolvedTitle: 'Meeting',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: [],
        aliases: [],
        headings: [],
        links: [],
        embeds: [],
        peopleMentions: [
          {
            raw: '@UnknownPerson',
            personName: 'UnknownPerson',
            position: { line: 1, column: 0 },
          },
        ],
        plainText: '',
      };

      buildEdgesForNote(graph, parsed, context);

      // Should not create edge for unresolved person
      const personEdges = getEdgesByType(
        graph,
        'note:notes/Meeting' as any,
        'note-mentions-person',
        'outgoing'
      );
      expect(personEdges).toHaveLength(0);
    });

    test('builds note link edges for resolved links', () => {
      const graph = createGraphIndex();
      const context = createTestContext();

      // Add target note to registry
      context.noteRegistry.add({
        id: 'notes/Target' as NoteId,
        path: 'notes/Target.md' as FilePath,
        fileName: 'Target.md',
        resolvedTitle: 'Target',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: [],
        aliases: [],
        headings: [],
        links: [],
        embeds: [],
        peopleMentions: [],
        plainText: '',
      });

      const parsed: ParsedNote = {
        id: 'notes/Source' as NoteId,
        path: 'notes/Source.md' as FilePath,
        fileName: 'Source.md',
        resolvedTitle: 'Source',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: [],
        aliases: [],
        headings: [],
        links: [
          {
            raw: '[[Target]]',
            targetText: 'Target',
            noteName: 'Target',
            position: { line: 1, column: 0 },
          },
        ],
        embeds: [],
        peopleMentions: [],
        plainText: '',
      };

      buildEdgesForNote(graph, parsed, context);

      // Check edge exists
      const linkEdges = getEdgesByType(
        graph,
        'note:notes/Source' as any,
        'note-links-note',
        'outgoing'
      );
      expect(linkEdges).toHaveLength(1);
      expect(linkEdges[0].to).toBe('note:notes/Target');
    });

    test('builds heading link edges for resolved heading links', () => {
      const graph = createGraphIndex();
      const context = createTestContext();

      // Add target note to registry
      const targetNote: ParsedNote = {
        id: 'notes/Target' as NoteId,
        path: 'notes/Target.md' as FilePath,
        fileName: 'Target.md',
        resolvedTitle: 'Target',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: [],
        aliases: [],
        headings: [
          {
            id: 'notes/Target#overview' as HeadingId,
            level: 2,
            rawText: 'Overview',
            normalized: 'overview',
            line: 3,
          },
        ],
        links: [],
        embeds: [],
        peopleMentions: [],
        plainText: '',
      };
      context.noteRegistry.add(targetNote);

      // Add headings to heading index
      context.headingIndex.addHeadingsForNote(targetNote.id, [
        {
          level: targetNote.headings[0].level,
          text: targetNote.headings[0].rawText,
          line: targetNote.headings[0].line,
        },
      ]);

      const parsed: ParsedNote = {
        id: 'notes/Source' as NoteId,
        path: 'notes/Source.md' as FilePath,
        fileName: 'Source.md',
        resolvedTitle: 'Source',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: [],
        aliases: [],
        headings: [],
        links: [
          {
            raw: '[[Target#Overview]]',
            targetText: 'Target#Overview',
            noteName: 'Target',
            headingText: 'Overview',
            position: { line: 1, column: 0 },
          },
        ],
        embeds: [],
        peopleMentions: [],
        plainText: '',
      };

      buildEdgesForNote(graph, parsed, context);

      // Check edge exists
      const headingEdges = getEdgesByType(
        graph,
        'note:notes/Source' as any,
        'note-links-heading',
        'outgoing'
      );
      expect(headingEdges).toHaveLength(1);
      // The heading ID is constructed as ${noteId}#${normalized}
      expect(headingEdges[0].to).toContain('heading:notes/Target#');
    });

    test('builds embed edges for resolved embeds', () => {
      const graph = createGraphIndex();
      const context = createTestContext();

      // Add target note to registry
      context.noteRegistry.add({
        id: 'notes/Template' as NoteId,
        path: 'notes/Template.md' as FilePath,
        fileName: 'Template.md',
        resolvedTitle: 'Template',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: [],
        aliases: [],
        headings: [],
        links: [],
        embeds: [],
        peopleMentions: [],
        plainText: '',
      });

      const parsed: ParsedNote = {
        id: 'notes/Document' as NoteId,
        path: 'notes/Document.md' as FilePath,
        fileName: 'Document.md',
        resolvedTitle: 'Document',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: [],
        aliases: [],
        headings: [],
        links: [],
        embeds: [
          {
            raw: '![[Template]]',
            noteName: 'Template',
            position: { line: 5, column: 0 },
          },
        ],
        peopleMentions: [],
        plainText: '',
      };

      buildEdgesForNote(graph, parsed, context);

      // Check edge exists
      const embedEdges = getEdgesByType(
        graph,
        'note:notes/Document' as any,
        'note-embeds-note',
        'outgoing'
      );
      expect(embedEdges).toHaveLength(1);
      expect(embedEdges[0].to).toBe('note:notes/Template');
    });

    test('builds multiple edge types for complex note', () => {
      const graph = createGraphIndex();
      const context = createTestContext();

      // Setup context
      context.peopleIndex.addPerson({
        id: 'Erik' as PersonId,
        name: 'Erik',
        noteId: 'people/Erik' as NoteId,
        path: 'people/Erik.md' as FilePath,
        metadata: {},
      });
      context.noteRegistry.add({
        id: 'notes/Target' as NoteId,
        path: 'notes/Target.md' as FilePath,
        fileName: 'Target.md',
        resolvedTitle: 'Target',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: [],
        aliases: [],
        headings: [],
        links: [],
        embeds: [],
        peopleMentions: [],
        plainText: '',
      });

      const parsed: ParsedNote = {
        id: 'notes/projects/Complex' as NoteId,
        path: 'notes/projects/Complex.md' as FilePath,
        fileName: 'Complex.md',
        resolvedTitle: 'Complex Note',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: ['planning' as TagId, 'important' as TagId],
        aliases: [],
        headings: [],
        links: [
          {
            raw: '[[Target]]',
            targetText: 'Target',
            noteName: 'Target',
            position: { line: 3, column: 0 },
          },
        ],
        embeds: [],
        peopleMentions: [
          {
            raw: '@Erik',
            personName: 'Erik',
            position: { line: 5, column: 0 },
          },
        ],
        plainText: '',
      };

      buildEdgesForNote(graph, parsed, context);

      const noteNodeId = 'note:notes/projects/Complex' as any;

      // Check all edge types
      expect(
        getEdgesByType(graph, 'folder:notes/projects' as any, 'folder-contains-note', 'outgoing')
      ).toHaveLength(1);
      expect(getEdgesByType(graph, noteNodeId, 'note-has-tag', 'outgoing')).toHaveLength(2);
      expect(getEdgesByType(graph, noteNodeId, 'note-mentions-person', 'outgoing')).toHaveLength(1);
      expect(getEdgesByType(graph, noteNodeId, 'note-links-note', 'outgoing')).toHaveLength(1);
    });

    test('ignores unresolved links', () => {
      const graph = createGraphIndex();
      const context = createTestContext();

      const parsed: ParsedNote = {
        id: 'notes/Source' as NoteId,
        path: 'notes/Source.md' as FilePath,
        fileName: 'Source.md',
        resolvedTitle: 'Source',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: [],
        aliases: [],
        headings: [],
        links: [
          {
            raw: '[[NonExistent]]',
            targetText: 'NonExistent',
            noteName: 'NonExistent',
            position: { line: 1, column: 0 },
          },
        ],
        embeds: [],
        peopleMentions: [],
        plainText: '',
      };

      buildEdgesForNote(graph, parsed, context);

      // Should not create edge for unresolved link
      const linkEdges = getEdgesByType(
        graph,
        'note:notes/Source' as any,
        'note-links-note',
        'outgoing'
      );
      expect(linkEdges).toHaveLength(0);
    });
  });
});
