/**
 * ReferencesWidget Component Tests
 *
 * Tests for extracting and displaying wiki-links and URLs from note content.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReferencesWidget, extractReferences, truncateUrl } from './ReferencesWidget';
import type { Note, LexicalState } from '@scribe/shared';

// Helper to create mock note with specific content
function mockNote(contentChildren: unknown[]): Note {
  return {
    id: 'test-id',
    title: 'Test Note',
    type: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    content: {
      root: {
        type: 'root',
        children: contentChildren,
        format: '',
        indent: 0,
        version: 1,
      },
    } as LexicalState,
    metadata: { title: null, tags: [], links: [], mentions: [] },
  };
}

describe('ReferencesWidget', () => {
  describe('extractReferences', () => {
    it('extracts wiki-links from content', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'wiki-link',
              targetId: 'note-123',
              displayText: 'Project Alpha',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });

    it('uses noteTitle when displayText is not available', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'wiki-link',
              targetId: 'note-456',
              noteTitle: 'Fallback Title',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('Fallback Title')).toBeInTheDocument();
    });

    it('shows "Untitled" when neither displayText nor noteTitle is available', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'wiki-link',
              targetId: 'note-789',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });

    it('extracts URLs from content', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              url: 'https://example.com/doc',
              title: 'Example Doc',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('Example Doc')).toBeInTheDocument();
    });

    it('extracts both http and https URLs', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              url: 'http://example.com/http-doc',
              title: 'HTTP Doc',
            },
            {
              type: 'link',
              url: 'https://example.com/https-doc',
              title: 'HTTPS Doc',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('HTTP Doc')).toBeInTheDocument();
      expect(screen.getByText('HTTPS Doc')).toBeInTheDocument();
    });

    it('ignores non-http/https URLs', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              url: 'mailto:test@example.com',
              title: 'Email Link',
            },
            {
              type: 'link',
              url: 'ftp://files.example.com',
              title: 'FTP Link',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.queryByText('Email Link')).not.toBeInTheDocument();
      expect(screen.queryByText('FTP Link')).not.toBeInTheDocument();
      expect(screen.getByText('No references')).toBeInTheDocument();
    });

    it('shows empty state when no references', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Just plain text' }],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('No references')).toBeInTheDocument();
    });

    it('truncates long URLs when no title is provided', () => {
      const longUrl = 'https://example.com/very/long/path/to/document/with/many/segments';
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              url: longUrl,
              // No title, so URL should be truncated
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      // Should be truncated and contain ellipsis
      const button = screen.getByRole('button');
      expect(button.textContent).toContain('example.com/very/long');
      expect(button.textContent).toContain('...');
    });

    it('deduplicates repeated wiki-link references', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            { type: 'wiki-link', targetId: 'note-123', displayText: 'Project Alpha' },
            { type: 'text', text: ' some text ' },
            { type: 'wiki-link', targetId: 'note-123', displayText: 'Project Alpha' },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      // Should only appear once
      const items = screen.getAllByText('Project Alpha');
      expect(items).toHaveLength(1);
    });

    it('deduplicates repeated URL references', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            { type: 'link', url: 'https://example.com', title: 'Example' },
            { type: 'text', text: ' text ' },
            { type: 'link', url: 'https://example.com', title: 'Example Again' },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      // Should only appear once (first occurrence wins)
      const items = screen.getAllByText('Example');
      expect(items).toHaveLength(1);
      expect(screen.queryByText('Example Again')).not.toBeInTheDocument();
    });

    it('extracts references from nested content', () => {
      const note = mockNote([
        {
          type: 'list',
          listType: 'bullet',
          children: [
            {
              type: 'listitem',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    { type: 'wiki-link', targetId: 'note-nested', displayText: 'Nested Link' },
                  ],
                },
              ],
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('Nested Link')).toBeInTheDocument();
    });

    it('does NOT include person mentions in references', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'person-mention',
              personId: 'person-123',
              personName: 'John Smith',
            },
            { type: 'wiki-link', targetId: 'note-123', displayText: 'Project' },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      // Wiki-link should be present
      expect(screen.getByText('Project')).toBeInTheDocument();
      // Person mention should NOT be in references
      expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
    });

    it('ignores wiki-links without targetId', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'wiki-link',
              // No targetId
              displayText: 'Invalid Link',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.queryByText('Invalid Link')).not.toBeInTheDocument();
      expect(screen.getByText('No references')).toBeInTheDocument();
    });
  });

  describe('truncateUrl', () => {
    it('removes https protocol', () => {
      expect(truncateUrl('https://example.com')).toBe('example.com');
    });

    it('removes http protocol', () => {
      expect(truncateUrl('http://example.com')).toBe('example.com');
    });

    it('removes trailing slash', () => {
      expect(truncateUrl('https://example.com/')).toBe('example.com');
    });

    it('truncates long URLs with ellipsis', () => {
      const longUrl = 'https://example.com/very/long/path/to/document';
      const result = truncateUrl(longUrl, 30);
      expect(result.length).toBe(30);
      expect(result.endsWith('...')).toBe(true);
    });

    it('does not truncate short URLs', () => {
      expect(truncateUrl('https://example.com')).toBe('example.com');
    });

    it('respects custom maxLength parameter', () => {
      const url = 'https://example.com/path';
      expect(truncateUrl(url, 15)).toBe('example.com/...');
    });
  });

  describe('extractReferences function', () => {
    it('returns empty array for empty content', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [],
        },
      };
      expect(extractReferences(content)).toEqual([]);
    });

    it('returns references with correct structure', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'wiki-link', targetId: 'note-1', displayText: 'Note One' },
                { type: 'link', url: 'https://example.com', title: 'Example' },
              ],
            },
          ],
        },
      };

      const refs = extractReferences(content);
      expect(refs).toHaveLength(2);
      expect(refs[0]).toEqual({
        type: 'wiki-link',
        displayText: 'Note One',
        targetId: 'note-1',
      });
      expect(refs[1]).toEqual({
        type: 'url',
        displayText: 'Example',
        url: 'https://example.com',
      });
    });
  });

  describe('click behavior', () => {
    it('calls onNavigate when clicking wiki-link', () => {
      const onNavigate = vi.fn();
      const note = mockNote([
        {
          type: 'paragraph',
          children: [{ type: 'wiki-link', targetId: 'note-123', displayText: 'Project Alpha' }],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={onNavigate} />);
      fireEvent.click(screen.getByText('Project Alpha'));
      expect(onNavigate).toHaveBeenCalledWith('note-123');
    });

    it('opens URL in new tab when clicking URL reference', () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              url: 'https://example.com/doc',
              title: 'Example Doc',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      fireEvent.click(screen.getByText('Example Doc'));

      expect(windowOpen).toHaveBeenCalledWith(
        'https://example.com/doc',
        '_blank',
        'noopener,noreferrer'
      );

      windowOpen.mockRestore();
    });

    it('does not call onNavigate when clicking URL reference', () => {
      const onNavigate = vi.fn();
      vi.spyOn(window, 'open').mockImplementation(() => null);

      const note = mockNote([
        {
          type: 'paragraph',
          children: [{ type: 'link', url: 'https://example.com', title: 'Example' }],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={onNavigate} />);
      fireEvent.click(screen.getByText('Example'));
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('rendering', () => {
    it('renders the References header', () => {
      const note = mockNote([]);
      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('References')).toBeInTheDocument();
    });

    it('shows external link icon for URL references', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [{ type: 'link', url: 'https://example.com', title: 'Example' }],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      // Check for SVG icon presence (external link icon)
      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('does not show external link icon for wiki-link references', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [{ type: 'wiki-link', targetId: 'note-1', displayText: 'Note' }],
        },
      ]);

      const { container } = render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      // Wiki-links should not have the external link icon in the button
      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).not.toBeInTheDocument();
    });
  });
});
