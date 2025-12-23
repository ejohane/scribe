/**
 * Unit tests for input.ts
 *
 * Tests CLI input handling: resolving content from inline text, files, and stdin.
 * Covers escape sequence processing, error handling, and size limits.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { Readable } from 'stream';

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

import { readFileSync, existsSync } from 'fs';
import { resolveContentInput, type ContentInput } from '../../src/input';
import { CLIError, ErrorCode } from '../../src/errors';

// Type-safe mock accessors
const mockExistsSync = existsSync as Mock;
const mockReadFileSync = readFileSync as Mock;

describe('input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveContentInput', () => {
    describe('inline text', () => {
      it('should return inline text with source "inline"', async () => {
        const result = await resolveContentInput('Hello World');

        expect(result.text).toBe('Hello World');
        expect(result.source).toBe('inline');
      });

      it('should handle empty inline text', async () => {
        const result = await resolveContentInput('');

        expect(result.text).toBe('');
        expect(result.source).toBe('inline');
      });

      it('should handle multiline inline text', async () => {
        const result = await resolveContentInput('Line 1\nLine 2\nLine 3');

        expect(result.text).toBe('Line 1\nLine 2\nLine 3');
        expect(result.source).toBe('inline');
      });
    });

    describe('escape sequence processing', () => {
      it('should convert \\n to newline', async () => {
        const result = await resolveContentInput('Line 1\\nLine 2');

        expect(result.text).toBe('Line 1\nLine 2');
        expect(result.source).toBe('inline');
      });

      it('should convert \\t to tab', async () => {
        const result = await resolveContentInput('Col1\\tCol2');

        expect(result.text).toBe('Col1\tCol2');
        expect(result.source).toBe('inline');
      });

      it('should convert \\\\ to backslash', async () => {
        const result = await resolveContentInput('Path: C:\\\\Users\\\\Name');

        expect(result.text).toBe('Path: C:\\Users\\Name');
        expect(result.source).toBe('inline');
      });

      it('should handle multiple escape sequences', async () => {
        const result = await resolveContentInput('Tab:\\tNewline:\\nBackslash:\\\\');

        expect(result.text).toBe('Tab:\tNewline:\nBackslash:\\');
        expect(result.source).toBe('inline');
      });

      it('should handle escape sequences mixed with text', async () => {
        const result = await resolveContentInput('# Title\\n\\nParagraph with\\ttab');

        expect(result.text).toBe('# Title\n\nParagraph with\ttab');
      });

      it('should not process escape sequences when reading from file', async () => {
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue('Content with \\n literal');

        const result = await resolveContentInput('ignored', '/path/to/file.txt');

        expect(result.text).toBe('Content with \\n literal');
        expect(result.source).toBe('file');
      });
    });

    describe('file input', () => {
      it('should read from file when filePath is provided', async () => {
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue('File content here');

        const result = await resolveContentInput('inline text', '/path/to/file.txt');

        expect(result.text).toBe('File content here');
        expect(result.source).toBe('file');
        expect(readFileSync).toHaveBeenCalledWith('/path/to/file.txt', 'utf-8');
      });

      it('should throw CLIError when file does not exist', async () => {
        mockExistsSync.mockReturnValue(false);

        await expect(resolveContentInput('text', '/nonexistent/file.txt')).rejects.toThrow(
          CLIError
        );

        try {
          await resolveContentInput('text', '/nonexistent/file.txt');
        } catch (err) {
          expect(err).toBeInstanceOf(CLIError);
          const cliErr = err as CLIError;
          expect(cliErr.code).toBe(ErrorCode.CLI_INVALID_ARGUMENT);
          expect(cliErr.message).toContain('not found');
          expect(cliErr.details?.filePath).toBe('/nonexistent/file.txt');
        }
      });

      it('should throw CLIError when file read fails', async () => {
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockImplementation(() => {
          throw new Error('Permission denied');
        });

        await expect(resolveContentInput('text', '/path/to/protected.txt')).rejects.toThrow(
          CLIError
        );

        try {
          await resolveContentInput('text', '/path/to/protected.txt');
        } catch (err) {
          expect(err).toBeInstanceOf(CLIError);
          const cliErr = err as CLIError;
          expect(cliErr.code).toBe(ErrorCode.CLI_INVALID_ARGUMENT);
          expect(cliErr.message).toContain('Failed to read');
          expect(cliErr.details?.reason).toBe('Permission denied');
        }
      });

      it('should handle non-Error exceptions from readFileSync', async () => {
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockImplementation(() => {
          throw 'String error';
        });

        try {
          await resolveContentInput('text', '/path/to/file.txt');
        } catch (err) {
          expect(err).toBeInstanceOf(CLIError);
          const cliErr = err as CLIError;
          expect(cliErr.details?.reason).toBe('Unknown error');
        }
      });

      it('should prioritize file over inline text', async () => {
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue('File wins');

        const result = await resolveContentInput('Inline text', '/path/to/file.txt');

        expect(result.text).toBe('File wins');
        expect(result.source).toBe('file');
      });

      it('should read empty file', async () => {
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue('');

        const result = await resolveContentInput('text', '/path/to/empty.txt');

        expect(result.text).toBe('');
        expect(result.source).toBe('file');
      });

      it('should read file with unicode content', async () => {
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue('Hello 世界 🌍');

        const result = await resolveContentInput('text', '/path/to/unicode.txt');

        expect(result.text).toBe('Hello 世界 🌍');
        expect(result.source).toBe('file');
      });
    });

    describe('stdin input', () => {
      let originalStdin: typeof process.stdin;

      beforeEach(() => {
        originalStdin = process.stdin;
      });

      afterEach(() => {
        // Restore original stdin
        Object.defineProperty(process, 'stdin', {
          value: originalStdin,
          writable: true,
        });
      });

      /**
       * Helper to create a mock stdin readable stream
       */
      function createMockStdin(chunks: string[]): Readable {
        let index = 0;
        const readable = new Readable({
          read() {
            if (index < chunks.length) {
              this.push(chunks[index]);
              index++;
            } else {
              this.push(null); // Signal end
            }
          },
        });
        return readable;
      }

      it('should read from stdin when text is "-"', async () => {
        const mockStdin = createMockStdin(['Hello from stdin']);
        Object.defineProperty(process, 'stdin', {
          value: mockStdin,
          writable: true,
        });

        const result = await resolveContentInput('-');

        expect(result.text).toBe('Hello from stdin');
        expect(result.source).toBe('stdin');
      });

      it('should concatenate multiple stdin chunks', async () => {
        const mockStdin = createMockStdin(['Chunk 1', ' Chunk 2', ' Chunk 3']);
        Object.defineProperty(process, 'stdin', {
          value: mockStdin,
          writable: true,
        });

        const result = await resolveContentInput('-');

        expect(result.text).toBe('Chunk 1 Chunk 2 Chunk 3');
        expect(result.source).toBe('stdin');
      });

      it('should throw CLIError when stdin is empty', async () => {
        const mockStdin = createMockStdin([]);
        Object.defineProperty(process, 'stdin', {
          value: mockStdin,
          writable: true,
        });

        await expect(resolveContentInput('-')).rejects.toThrow(CLIError);

        try {
          const emptyStdin = createMockStdin([]);
          Object.defineProperty(process, 'stdin', {
            value: emptyStdin,
            writable: true,
          });
          await resolveContentInput('-');
        } catch (err) {
          expect(err).toBeInstanceOf(CLIError);
          const cliErr = err as CLIError;
          expect(cliErr.code).toBe(ErrorCode.CLI_INVALID_ARGUMENT);
          expect(cliErr.message).toContain('Empty input');
        }
      });

      it('should throw CLIError when stdin exceeds size limit', async () => {
        // Create data larger than 1MB
        const largeChunk = 'x'.repeat(600 * 1024); // 600KB per chunk
        const mockStdin = createMockStdin([largeChunk, largeChunk]); // 1.2MB total
        Object.defineProperty(process, 'stdin', {
          value: mockStdin,
          writable: true,
        });

        await expect(resolveContentInput('-')).rejects.toThrow(CLIError);

        try {
          const largeStdin = createMockStdin(['x'.repeat(600 * 1024), 'x'.repeat(600 * 1024)]);
          Object.defineProperty(process, 'stdin', {
            value: largeStdin,
            writable: true,
          });
          await resolveContentInput('-');
        } catch (err) {
          expect(err).toBeInstanceOf(CLIError);
          const cliErr = err as CLIError;
          expect(cliErr.code).toBe(ErrorCode.CLI_INVALID_ARGUMENT);
          expect(cliErr.message).toContain('exceeds maximum size');
          expect(cliErr.details?.maxSize).toBe(1024 * 1024);
        }
      });

      it('should handle stdin error events', async () => {
        const mockStdin = new Readable({
          read() {
            this.emit('error', new Error('Stdin pipe broken'));
          },
        });
        Object.defineProperty(process, 'stdin', {
          value: mockStdin,
          writable: true,
        });

        await expect(resolveContentInput('-')).rejects.toThrow(CLIError);

        try {
          const errorStdin = new Readable({
            read() {
              this.emit('error', new Error('Connection reset'));
            },
          });
          Object.defineProperty(process, 'stdin', {
            value: errorStdin,
            writable: true,
          });
          await resolveContentInput('-');
        } catch (err) {
          expect(err).toBeInstanceOf(CLIError);
          const cliErr = err as CLIError;
          expect(cliErr.code).toBe(ErrorCode.CLI_INVALID_ARGUMENT);
          expect(cliErr.message).toContain('Failed to read from stdin');
        }
      });

      it('should read multiline content from stdin', async () => {
        const mockStdin = createMockStdin(['Line 1\n', 'Line 2\n', 'Line 3']);
        Object.defineProperty(process, 'stdin', {
          value: mockStdin,
          writable: true,
        });

        const result = await resolveContentInput('-');

        expect(result.text).toBe('Line 1\nLine 2\nLine 3');
      });

      it('should read content with unicode from stdin', async () => {
        const mockStdin = createMockStdin(['Hello 世界 ', '🌍']);
        Object.defineProperty(process, 'stdin', {
          value: mockStdin,
          writable: true,
        });

        const result = await resolveContentInput('-');

        expect(result.text).toBe('Hello 世界 🌍');
      });

      it('should prioritize file over stdin indicator', async () => {
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue('File content');

        const result = await resolveContentInput('-', '/path/to/file.txt');

        expect(result.text).toBe('File content');
        expect(result.source).toBe('file');
      });
    });
  });

  describe('ContentInput type', () => {
    it('should have correct shape for inline source', async () => {
      const result: ContentInput = await resolveContentInput('test');

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('source');
      expect(typeof result.text).toBe('string');
      expect(['inline', 'stdin', 'file']).toContain(result.source);
    });
  });

  describe('edge cases', () => {
    it('should handle text that looks like escape but is not', async () => {
      // Single backslash followed by non-escape char
      const result = await resolveContentInput('\\x\\y\\z');

      // These should remain unchanged since \x, \y, \z are not recognized escapes
      expect(result.text).toBe('\\x\\y\\z');
    });

    it('should handle only escape sequences', async () => {
      const result = await resolveContentInput('\\n\\t\\\\');

      expect(result.text).toBe('\n\t\\');
    });

    it('should handle very long inline text', async () => {
      const longText = 'a'.repeat(100000);
      const result = await resolveContentInput(longText);

      expect(result.text).toBe(longText);
      expect(result.text.length).toBe(100000);
    });

    it('should handle special markdown characters', async () => {
      const markdown = '# Header\\n- List item\\n**bold** _italic_';
      const result = await resolveContentInput(markdown);

      expect(result.text).toBe('# Header\n- List item\n**bold** _italic_');
    });

    it('should handle JSON-like content', async () => {
      const json = '{"key": "value\\nwith newline"}';
      const result = await resolveContentInput(json);

      expect(result.text).toBe('{"key": "value\nwith newline"}');
    });
  });
});
