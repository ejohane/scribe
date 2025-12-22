/**
 * Unit tests for search.ts command module
 *
 * Tests search functionality CLI commands with various options.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import type { Note } from '@scribe/shared';
import { createMockNote, createContent, paragraph, text } from '@scribe/test-utils';

// Mock the context module
vi.mock('../../../src/context.js', () => ({
  initializeContext: vi.fn(),
}));

// Mock the output module
vi.mock('../../../src/output.js', () => ({
  output: vi.fn(),
}));

// Mock the content-extractor module
vi.mock('../../../src/content-extractor.js', () => ({
  extractPlainText: vi.fn(),
}));

import { registerSearchCommand } from '../../../src/commands/search';
import { initializeContext } from '../../../src/context.js';
import { output } from '../../../src/output.js';
import { extractPlainText } from '../../../src/content-extractor.js';

describe('search commands', () => {
  let program: Command;
  let mockVault: {
    list: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
  };
  let mockSearchEngine: {
    search: ReturnType<typeof vi.fn>;
  };
  let mockContext: {
    vault: typeof mockVault;
    searchEngine: typeof mockSearchEngine;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mock vault
    mockVault = {
      list: vi.fn(() => []),
      read: vi.fn(),
    };

    // Set up mock search engine
    mockSearchEngine = {
      search: vi.fn(() => []),
    };

    // Set up mock context
    mockContext = {
      vault: mockVault,
      searchEngine: mockSearchEngine,
    };

    vi.mocked(initializeContext).mockResolvedValue(
      mockContext as unknown as Awaited<ReturnType<typeof initializeContext>>
    );
    vi.mocked(extractPlainText).mockReturnValue('');

    // Set up commander program
    program = new Command();
    program.option('--format <format>', 'output format', 'json');
    program.option('--vault <path>', 'vault path');
    registerSearchCommand(program);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper to create a mock note with content text
   */
  function createMockNoteWithContent(id: string, title: string, contentText: string): Note {
    return createMockNote({
      id,
      title,
      content: createContent(paragraph(text(contentText))),
    });
  }

  describe('basic search', () => {
    it('performs basic search', async () => {
      const note1 = createMockNoteWithContent(
        'note-1',
        'Test Note',
        'This is a test note about JavaScript'
      );
      const searchResults = [{ id: 'note-1', score: 0.95 }];

      mockSearchEngine.search.mockReturnValue(searchResults);
      mockVault.read.mockReturnValue(note1);
      vi.mocked(extractPlainText).mockReturnValue('This is a test note about JavaScript');

      await program.parseAsync(['node', 'test', 'search', 'JavaScript']);

      expect(mockSearchEngine.search).toHaveBeenCalledWith('JavaScript', expect.any(Number));
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'JavaScript',
          results: expect.arrayContaining([
            expect.objectContaining({
              id: 'note-1',
              title: 'Test Note',
            }),
          ]),
        }),
        expect.anything()
      );
    });

    it('returns results with relevance scoring', async () => {
      const note1 = createMockNoteWithContent(
        'note-1',
        'High Score',
        'JavaScript JavaScript JavaScript'
      );
      const note2 = createMockNoteWithContent('note-2', 'Low Score', 'Contains JavaScript once');

      const searchResults = [
        { id: 'note-1', score: 0.95 },
        { id: 'note-2', score: 0.42 },
      ];

      mockSearchEngine.search.mockReturnValue(searchResults);
      mockVault.read.mockImplementation((id: string) => {
        if (id === 'note-1') return note1;
        if (id === 'note-2') return note2;
        throw new Error('Note not found');
      });
      vi.mocked(extractPlainText).mockImplementation((note: Note) => {
        if (note.id === 'note-1') return 'JavaScript JavaScript JavaScript';
        if (note.id === 'note-2') return 'Contains JavaScript once';
        return '';
      });

      await program.parseAsync(['node', 'test', 'search', 'JavaScript']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({ id: 'note-1', score: 0.95 }),
            expect.objectContaining({ id: 'note-2', score: 0.42 }),
          ]),
        }),
        expect.anything()
      );
    });

    it('handles empty results', async () => {
      mockSearchEngine.search.mockReturnValue([]);

      await program.parseAsync(['node', 'test', 'search', 'nonexistent-term']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'nonexistent-term',
          results: [],
          total: 0,
        }),
        expect.anything()
      );
    });
  });

  describe('pagination', () => {
    it('supports limit option', async () => {
      const notes = Array.from({ length: 30 }, (_, i) =>
        createMockNoteWithContent(`note-${i}`, `Note ${i}`, `Content ${i}`)
      );
      const searchResults = notes.map((n, i) => ({ id: n.id, score: 1 - i * 0.01 }));

      mockSearchEngine.search.mockReturnValue(searchResults);
      mockVault.read.mockImplementation((id: string) => {
        const note = notes.find((n) => n.id === id);
        if (note) return note;
        throw new Error('Note not found');
      });
      vi.mocked(extractPlainText).mockReturnValue('Content');

      await program.parseAsync(['node', 'test', 'search', 'Content', '--limit', '5']);

      const call = vi.mocked(output).mock.calls[0][0] as { results: unknown[] };
      expect(call.results).toHaveLength(5);
    });

    it('supports offset option', async () => {
      const notes = Array.from({ length: 30 }, (_, i) =>
        createMockNoteWithContent(`note-${i}`, `Note ${i}`, `Content ${i}`)
      );
      const searchResults = notes.map((n, i) => ({ id: n.id, score: 1 - i * 0.01 }));

      mockSearchEngine.search.mockReturnValue(searchResults);
      mockVault.read.mockImplementation((id: string) => {
        const note = notes.find((n) => n.id === id);
        if (note) return note;
        throw new Error('Note not found');
      });
      vi.mocked(extractPlainText).mockReturnValue('Content');

      await program.parseAsync([
        'node',
        'test',
        'search',
        'Content',
        '--offset',
        '10',
        '--limit',
        '5',
      ]);

      const call = vi.mocked(output).mock.calls[0][0] as { results: Array<{ id: string }> };
      expect(call.results).toHaveLength(5);
      // First result should be note-10 (offset by 10)
      expect(call.results[0].id).toBe('note-10');
    });

    it('uses default limit of 20', async () => {
      const notes = Array.from({ length: 30 }, (_, i) =>
        createMockNoteWithContent(`note-${i}`, `Note ${i}`, `Content ${i}`)
      );
      const searchResults = notes.map((n, i) => ({ id: n.id, score: 1 - i * 0.01 }));

      mockSearchEngine.search.mockReturnValue(searchResults);
      mockVault.read.mockImplementation((id: string) => {
        const note = notes.find((n) => n.id === id);
        if (note) return note;
        throw new Error('Note not found');
      });
      vi.mocked(extractPlainText).mockReturnValue('Content');

      await program.parseAsync(['node', 'test', 'search', 'Content']);

      const call = vi.mocked(output).mock.calls[0][0] as { results: unknown[] };
      expect(call.results).toHaveLength(20);
    });

    it('requests enough results from engine to cover offset + limit', async () => {
      const notes = Array.from({ length: 50 }, (_, i) =>
        createMockNoteWithContent(`note-${i}`, `Note ${i}`, `Content ${i}`)
      );
      const searchResults = notes.map((n, i) => ({ id: n.id, score: 1 - i * 0.01 }));

      mockSearchEngine.search.mockReturnValue(searchResults);
      mockVault.read.mockImplementation((id: string) => {
        const note = notes.find((n) => n.id === id);
        if (note) return note;
        throw new Error('Note not found');
      });
      vi.mocked(extractPlainText).mockReturnValue('Content');

      await program.parseAsync([
        'node',
        'test',
        'search',
        'Content',
        '--offset',
        '20',
        '--limit',
        '10',
      ]);

      // Search engine should be called with offset + limit (20 + 10 = 30)
      expect(mockSearchEngine.search).toHaveBeenCalledWith('Content', 30);
    });
  });

  describe('result formatting', () => {
    it('includes snippet in results', async () => {
      const note = createMockNoteWithContent(
        'note-1',
        'JavaScript Tutorial',
        'Learn JavaScript basics today'
      );
      const searchResults = [{ id: 'note-1', score: 0.9 }];

      mockSearchEngine.search.mockReturnValue(searchResults);
      mockVault.read.mockReturnValue(note);
      vi.mocked(extractPlainText).mockReturnValue('Learn JavaScript basics today');

      await program.parseAsync(['node', 'test', 'search', 'JavaScript']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({
              snippet: expect.any(String),
            }),
          ]),
        }),
        expect.anything()
      );
    });

    it('includes match count in results', async () => {
      const note = createMockNoteWithContent('note-1', 'Test', 'JavaScript JavaScript JavaScript');
      const searchResults = [{ id: 'note-1', score: 0.9 }];

      mockSearchEngine.search.mockReturnValue(searchResults);
      mockVault.read.mockReturnValue(note);
      vi.mocked(extractPlainText).mockReturnValue('JavaScript JavaScript JavaScript');

      await program.parseAsync(['node', 'test', 'search', 'JavaScript']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({
              matches: expect.arrayContaining([
                expect.objectContaining({
                  field: 'content',
                  count: 3,
                }),
              ]),
            }),
          ]),
        }),
        expect.anything()
      );
    });

    it('includes total count in output', async () => {
      const notes = Array.from({ length: 25 }, (_, i) =>
        createMockNoteWithContent(`note-${i}`, `Note ${i}`, `Content ${i}`)
      );
      const searchResults = notes.map((n, i) => ({ id: n.id, score: 1 - i * 0.01 }));

      mockSearchEngine.search.mockReturnValue(searchResults);
      mockVault.read.mockImplementation((id: string) => {
        const note = notes.find((n) => n.id === id);
        if (note) return note;
        throw new Error('Note not found');
      });
      vi.mocked(extractPlainText).mockReturnValue('Content');

      await program.parseAsync(['node', 'test', 'search', 'Content', '--limit', '10']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 25,
        }),
        expect.anything()
      );
    });
  });

  describe('snippet generation', () => {
    it('generates snippet around match location', async () => {
      const longContent = 'A'.repeat(100) + 'JavaScript' + 'B'.repeat(100);
      const note = createMockNoteWithContent('note-1', 'Test', longContent);
      const searchResults = [{ id: 'note-1', score: 0.9 }];

      mockSearchEngine.search.mockReturnValue(searchResults);
      mockVault.read.mockReturnValue(note);
      vi.mocked(extractPlainText).mockReturnValue(longContent);

      await program.parseAsync(['node', 'test', 'search', 'JavaScript']);

      const call = vi.mocked(output).mock.calls[0][0] as { results: Array<{ snippet: string }> };
      const snippet = call.results[0].snippet;

      // Snippet should contain the match
      expect(snippet.toLowerCase()).toContain('javascript');
      // Snippet should be truncated (not the full 210+ chars)
      expect(snippet.length).toBeLessThan(longContent.length);
    });

    it('adds ellipsis for truncated snippets', async () => {
      const longContent = 'A'.repeat(100) + 'JavaScript' + 'B'.repeat(100);
      const note = createMockNoteWithContent('note-1', 'Test', longContent);
      const searchResults = [{ id: 'note-1', score: 0.9 }];

      mockSearchEngine.search.mockReturnValue(searchResults);
      mockVault.read.mockReturnValue(note);
      vi.mocked(extractPlainText).mockReturnValue(longContent);

      await program.parseAsync(['node', 'test', 'search', 'JavaScript']);

      const call = vi.mocked(output).mock.calls[0][0] as { results: Array<{ snippet: string }> };
      const snippet = call.results[0].snippet;

      // Should have ellipsis at start and/or end
      expect(snippet).toMatch(/\.\.\./);
    });

    it('returns beginning of content when query not found in plain text', async () => {
      const content = 'This is the beginning of the note content that is very long';
      const note = createMockNoteWithContent('note-1', 'Test', content);
      const searchResults = [{ id: 'note-1', score: 0.5 }];

      mockSearchEngine.search.mockReturnValue(searchResults);
      mockVault.read.mockReturnValue(note);
      // Simulate query matching in title but not content
      vi.mocked(extractPlainText).mockReturnValue(content);

      await program.parseAsync(['node', 'test', 'search', 'NotInContent']);

      const call = vi.mocked(output).mock.calls[0][0] as { results: Array<{ snippet: string }> };
      const snippet = call.results[0].snippet;

      // Should start with the beginning of the content
      expect(snippet).toMatch(/^This is the beginning/);
    });
  });

  describe('special character handling', () => {
    it('handles regex special characters in query', async () => {
      const content = 'Using regex patterns like (foo|bar) and [a-z]+';
      const note = createMockNoteWithContent('note-1', 'Regex Tutorial', content);
      const searchResults = [{ id: 'note-1', score: 0.9 }];

      mockSearchEngine.search.mockReturnValue(searchResults);
      mockVault.read.mockReturnValue(note);
      vi.mocked(extractPlainText).mockReturnValue(content);

      // Should not throw when query contains regex special chars
      await expect(
        program.parseAsync(['node', 'test', 'search', '(foo|bar)'])
      ).resolves.not.toThrow();
    });

    it('correctly counts matches with special characters', async () => {
      const content = 'Using C++ and C++ for development';
      const note = createMockNoteWithContent('note-1', 'C++ Guide', content);
      const searchResults = [{ id: 'note-1', score: 0.9 }];

      mockSearchEngine.search.mockReturnValue(searchResults);
      mockVault.read.mockReturnValue(note);
      vi.mocked(extractPlainText).mockReturnValue(content);

      await program.parseAsync(['node', 'test', 'search', 'C++']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({
              matches: expect.arrayContaining([
                expect.objectContaining({
                  count: 2,
                }),
              ]),
            }),
          ]),
        }),
        expect.anything()
      );
    });
  });
});
