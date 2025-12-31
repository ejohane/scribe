/**
 * Unit tests for graph.ts command module
 *
 * Tests graph query CLI commands: backlinks, outlinks, neighbors, stats.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { createNoteId } from '@scribe/shared';
import { createMockNote } from '@scribe/test-utils';

// Mock the context module
vi.mock('../../../src/context.js', () => ({
  initializeContext: vi.fn(),
}));

// Mock the output module
vi.mock('../../../src/output.js', () => ({
  output: vi.fn(),
}));

// Mock the errors module
vi.mock('../../../src/errors.js', () => ({
  noteNotFound: vi.fn((id: string) => {
    const error = new Error(`Note not found: ${id}`);
    (error as Error & { code: string }).code = 'NOTE_NOT_FOUND';
    return error;
  }),
}));

import { registerGraphCommands } from '../../../src/commands/graph';
import { initializeContext } from '../../../src/context.js';
import { output } from '../../../src/output.js';

describe('graph commands', () => {
  let program: Command;
  let mockVault: {
    list: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
  };
  let mockGraphEngine: {
    backlinks: ReturnType<typeof vi.fn>;
    outlinks: ReturnType<typeof vi.fn>;
    neighbors: ReturnType<typeof vi.fn>;
    getStats: ReturnType<typeof vi.fn>;
  };
  let mockContext: {
    vault: typeof mockVault;
    graphEngine: typeof mockGraphEngine;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mock vault
    mockVault = {
      list: vi.fn(() => []),
      read: vi.fn(),
    };

    // Set up mock graph engine
    mockGraphEngine = {
      backlinks: vi.fn(() => []),
      outlinks: vi.fn(() => []),
      neighbors: vi.fn(() => []),
      getStats: vi.fn(() => ({ nodes: 0, edges: 0, tags: 0 })),
    };

    // Set up mock context
    mockContext = {
      vault: mockVault,
      graphEngine: mockGraphEngine,
    };

    vi.mocked(initializeContext).mockResolvedValue(
      mockContext as unknown as Awaited<ReturnType<typeof initializeContext>>
    );

    // Set up commander program
    program = new Command();
    program.option('--format <format>', 'output format', 'json');
    program.option('--vault <path>', 'vault path');
    registerGraphCommands(program);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('backlinks', () => {
    it('finds incoming links to a note', async () => {
      const targetNote = createMockNote({ id: 'target-note', title: 'Target Note' });
      const linkingNote1 = createMockNote({
        id: 'linking-1',
        title: 'Linking Note 1',
        tags: ['#work'],
      });
      const linkingNote2 = createMockNote({
        id: 'linking-2',
        title: 'Linking Note 2',
        type: 'project',
      });

      mockVault.read.mockReturnValue(targetNote);
      mockGraphEngine.backlinks.mockReturnValue([linkingNote1, linkingNote2]);

      await program.parseAsync(['node', 'test', 'graph', 'backlinks', 'target-note']);

      expect(mockGraphEngine.backlinks).toHaveBeenCalledWith(createNoteId('target-note'));
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          note: expect.objectContaining({ id: targetNote.id, title: targetNote.title }),
          backlinks: expect.arrayContaining([
            expect.objectContaining({
              id: linkingNote1.id,
              title: linkingNote1.title,
              tags: ['#work'],
              url: `scribe://note/${linkingNote1.id}`,
            }),
            expect.objectContaining({
              id: linkingNote2.id,
              title: linkingNote2.title,
              type: 'project',
              url: `scribe://note/${linkingNote2.id}`,
            }),
          ]),
          count: 2,
        }),
        expect.anything()
      );
    });

    it('returns empty array for no backlinks', async () => {
      const targetNote = createMockNote({ id: 'isolated-note', title: 'Isolated Note' });

      mockVault.read.mockReturnValue(targetNote);
      mockGraphEngine.backlinks.mockReturnValue([]);

      await program.parseAsync(['node', 'test', 'graph', 'backlinks', 'isolated-note']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          note: expect.objectContaining({ id: targetNote.id, title: targetNote.title }),
          backlinks: [],
          count: 0,
        }),
        expect.anything()
      );
    });

    it('handles note not found', async () => {
      mockVault.read.mockImplementation(() => {
        throw new Error('Note not found');
      });

      await expect(
        program.parseAsync(['node', 'test', 'graph', 'backlinks', 'nonexistent-note'])
      ).rejects.toThrow();
    });

    it('includes note type in backlink results', async () => {
      const targetNote = createMockNote({ id: 'target', title: 'Target' });
      const personNote = createMockNote({ id: 'person-1', title: 'John Doe', type: 'person' });
      const dailyNote = createMockNote({
        id: 'daily-2025-01-15',
        title: 'January 15, 2025',
        type: 'daily',
      });

      mockVault.read.mockReturnValue(targetNote);
      mockGraphEngine.backlinks.mockReturnValue([personNote, dailyNote]);

      await program.parseAsync(['node', 'test', 'graph', 'backlinks', 'target']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          backlinks: expect.arrayContaining([
            expect.objectContaining({ type: 'person' }),
            expect.objectContaining({ type: 'daily' }),
          ]),
        }),
        expect.anything()
      );
    });
  });

  describe('outlinks', () => {
    it('finds outgoing links from a note', async () => {
      const sourceNote = createMockNote({ id: 'source-note', title: 'Source Note' });
      const linkedNote1 = createMockNote({ id: 'linked-1', title: 'Linked Note 1' });
      const linkedNote2 = createMockNote({ id: 'linked-2', title: 'Linked Note 2' });

      mockVault.read.mockReturnValue(sourceNote);
      mockGraphEngine.outlinks.mockReturnValue([linkedNote1, linkedNote2]);

      await program.parseAsync(['node', 'test', 'graph', 'outlinks', 'source-note']);

      expect(mockGraphEngine.outlinks).toHaveBeenCalledWith(createNoteId('source-note'));
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          note: expect.objectContaining({ id: sourceNote.id, title: sourceNote.title }),
          outlinks: expect.arrayContaining([
            expect.objectContaining({
              id: linkedNote1.id,
              title: linkedNote1.title,
              url: `scribe://note/${linkedNote1.id}`,
            }),
            expect.objectContaining({
              id: linkedNote2.id,
              title: linkedNote2.title,
              url: `scribe://note/${linkedNote2.id}`,
            }),
          ]),
          count: 2,
        }),
        expect.anything()
      );
    });

    it('returns empty array when no outlinks', async () => {
      const note = createMockNote({ id: 'no-links', title: 'Note Without Links' });

      mockVault.read.mockReturnValue(note);
      mockGraphEngine.outlinks.mockReturnValue([]);

      await program.parseAsync(['node', 'test', 'graph', 'outlinks', 'no-links']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          outlinks: [],
          count: 0,
        }),
        expect.anything()
      );
    });

    it('handles note not found', async () => {
      mockVault.read.mockImplementation(() => {
        throw new Error('Note not found');
      });

      await expect(
        program.parseAsync(['node', 'test', 'graph', 'outlinks', 'nonexistent'])
      ).rejects.toThrow();
    });
  });

  describe('neighbors', () => {
    it('finds directly connected notes', async () => {
      const centerNote = createMockNote({ id: 'center', title: 'Center Note' });
      const neighborNote1 = createMockNote({ id: 'neighbor-1', title: 'Neighbor 1' });
      const neighborNote2 = createMockNote({ id: 'neighbor-2', title: 'Neighbor 2' });

      mockVault.read.mockReturnValue(centerNote);
      mockGraphEngine.neighbors.mockReturnValue([neighborNote1, neighborNote2]);
      mockGraphEngine.backlinks.mockReturnValue([neighborNote1]);
      mockGraphEngine.outlinks.mockReturnValue([neighborNote2]);

      await program.parseAsync(['node', 'test', 'graph', 'neighbors', 'center']);

      expect(mockGraphEngine.neighbors).toHaveBeenCalledWith(createNoteId('center'));
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          note: expect.objectContaining({ id: centerNote.id, title: centerNote.title }),
          neighbors: expect.arrayContaining([
            expect.objectContaining({
              id: neighborNote1.id,
              direction: 'incoming',
              url: `scribe://note/${neighborNote1.id}`,
            }),
            expect.objectContaining({
              id: neighborNote2.id,
              direction: 'outgoing',
              url: `scribe://note/${neighborNote2.id}`,
            }),
          ]),
          count: 2,
        }),
        expect.anything()
      );
    });

    it('handles empty graph (no neighbors)', async () => {
      const isolatedNote = createMockNote({ id: 'isolated', title: 'Isolated Note' });

      mockVault.read.mockReturnValue(isolatedNote);
      mockGraphEngine.neighbors.mockReturnValue([]);
      mockGraphEngine.backlinks.mockReturnValue([]);
      mockGraphEngine.outlinks.mockReturnValue([]);

      await program.parseAsync(['node', 'test', 'graph', 'neighbors', 'isolated']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          neighbors: [],
          count: 0,
        }),
        expect.anything()
      );
    });

    it('marks bidirectional connections as "both"', async () => {
      const centerNote = createMockNote({ id: 'center', title: 'Center Note' });
      const bidirectionalNote = createMockNote({
        id: 'bidirectional',
        title: 'Bidirectional Note',
      });

      mockVault.read.mockReturnValue(centerNote);
      mockGraphEngine.neighbors.mockReturnValue([bidirectionalNote]);
      // Note appears in both backlinks and outlinks = bidirectional
      mockGraphEngine.backlinks.mockReturnValue([bidirectionalNote]);
      mockGraphEngine.outlinks.mockReturnValue([bidirectionalNote]);

      await program.parseAsync(['node', 'test', 'graph', 'neighbors', 'center']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          neighbors: expect.arrayContaining([
            expect.objectContaining({
              id: bidirectionalNote.id,
              direction: 'both',
            }),
          ]),
        }),
        expect.anything()
      );
    });

    it('handles note not found', async () => {
      mockVault.read.mockImplementation(() => {
        throw new Error('Note not found');
      });

      await expect(
        program.parseAsync(['node', 'test', 'graph', 'neighbors', 'nonexistent'])
      ).rejects.toThrow();
    });
  });

  describe('stats', () => {
    it('returns vault-wide graph statistics', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Note 1' }),
        createMockNote({ id: 'note-2', title: 'Note 2' }),
        createMockNote({ id: 'note-3', title: 'Note 3' }),
      ];

      mockVault.list.mockReturnValue(notes);
      mockVault.read.mockImplementation((id: string) => {
        const note = notes.find((n) => n.id === id);
        if (note) return note;
        throw new Error('Note not found');
      });
      mockGraphEngine.getStats.mockReturnValue({
        nodes: 3,
        edges: 5,
        tags: 2,
      });
      mockGraphEngine.backlinks.mockReturnValue([]);
      mockGraphEngine.outlinks.mockReturnValue([]);

      await program.parseAsync(['node', 'test', 'graph', 'stats']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: 3,
          edges: 5,
          tags: 2,
        }),
        expect.anything()
      );
    });

    it('calculates average links per note', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Note 1' }),
        createMockNote({ id: 'note-2', title: 'Note 2' }),
      ];

      mockVault.list.mockReturnValue(notes);
      mockVault.read.mockImplementation((id: string) => {
        const note = notes.find((n) => n.id === id);
        if (note) return note;
        throw new Error('Note not found');
      });
      mockGraphEngine.getStats.mockReturnValue({
        nodes: 2,
        edges: 4,
        tags: 1,
      });
      mockGraphEngine.backlinks.mockReturnValue([]);
      mockGraphEngine.outlinks.mockReturnValue([]);

      await program.parseAsync(['node', 'test', 'graph', 'stats']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          avgLinksPerNote: 2, // 4 edges / 2 nodes
        }),
        expect.anything()
      );
    });

    it('identifies most linked notes', async () => {
      const popularNote = createMockNote({ id: 'popular', title: 'Popular Note' });
      const note1 = createMockNote({ id: 'note-1', title: 'Note 1' });
      const note2 = createMockNote({ id: 'note-2', title: 'Note 2' });

      mockVault.list.mockReturnValue([popularNote, note1, note2]);
      mockVault.read.mockImplementation((id: string) => {
        if (id === 'popular' || id === popularNote.id) return popularNote;
        if (id === 'note-1' || id === note1.id) return note1;
        if (id === 'note-2' || id === note2.id) return note2;
        throw new Error('Note not found');
      });
      mockGraphEngine.getStats.mockReturnValue({ nodes: 3, edges: 4, tags: 0 });
      // Popular note has 5 backlinks, others have 0
      mockGraphEngine.backlinks.mockImplementation((noteId: string) => {
        if (noteId === popularNote.id) {
          return [note1, note2, note1, note2, note1]; // 5 backlinks
        }
        return [];
      });
      mockGraphEngine.outlinks.mockReturnValue([]);

      await program.parseAsync(['node', 'test', 'graph', 'stats']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          mostLinked: expect.arrayContaining([
            expect.objectContaining({
              id: popularNote.id,
              title: 'Popular Note',
              linkCount: 5,
            }),
          ]),
        }),
        expect.anything()
      );
    });

    it('counts orphan notes (no links in or out)', async () => {
      const orphanNote = createMockNote({ id: 'orphan', title: 'Orphan Note' });
      const connectedNote = createMockNote({ id: 'connected', title: 'Connected Note' });

      mockVault.list.mockReturnValue([orphanNote, connectedNote]);
      mockVault.read.mockImplementation((id: string) => {
        if (id === 'orphan' || id === orphanNote.id) return orphanNote;
        if (id === 'connected' || id === connectedNote.id) return connectedNote;
        throw new Error('Note not found');
      });
      mockGraphEngine.getStats.mockReturnValue({ nodes: 2, edges: 1, tags: 0 });
      mockGraphEngine.backlinks.mockImplementation((noteId: string) => {
        if (noteId === connectedNote.id) return [orphanNote];
        return [];
      });
      mockGraphEngine.outlinks.mockImplementation((noteId: string) => {
        if (noteId === connectedNote.id) return [orphanNote];
        return [];
      });

      await program.parseAsync(['node', 'test', 'graph', 'stats']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          orphanNotes: 1,
        }),
        expect.anything()
      );
    });

    it('handles empty vault', async () => {
      mockVault.list.mockReturnValue([]);
      mockGraphEngine.getStats.mockReturnValue({ nodes: 0, edges: 0, tags: 0 });

      await program.parseAsync(['node', 'test', 'graph', 'stats']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: 0,
          edges: 0,
          avgLinksPerNote: 0,
          orphanNotes: 0,
        }),
        expect.anything()
      );
    });
  });
});
