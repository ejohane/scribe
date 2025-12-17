/**
 * Unit tests for errors.ts
 *
 * Tests CLI error handling, error codes, exit codes, and error formatting.
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  EXIT_CODES,
  CLIError,
  formatError,
  vaultNotFound,
  noteNotFound,
  invalidInput,
  hasBacklinks,
  writeFailed,
} from '../../src/errors';

describe('errors', () => {
  describe('ErrorCode enum', () => {
    it('should define all expected error codes', () => {
      expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ErrorCode.VAULT_NOT_FOUND).toBe('VAULT_NOT_FOUND');
      expect(ErrorCode.NOTE_NOT_FOUND).toBe('NOTE_NOT_FOUND');
      expect(ErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
      expect(ErrorCode.WRITE_FAILED).toBe('WRITE_FAILED');
      expect(ErrorCode.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
      expect(ErrorCode.HAS_BACKLINKS).toBe('HAS_BACKLINKS');
    });
  });

  describe('EXIT_CODES', () => {
    it('should have exit codes for all error codes', () => {
      for (const code of Object.values(ErrorCode)) {
        expect(EXIT_CODES[code]).toBeDefined();
        expect(typeof EXIT_CODES[code]).toBe('number');
      }
    });

    it('should use non-zero exit codes', () => {
      for (const code of Object.values(ErrorCode)) {
        expect(EXIT_CODES[code]).toBeGreaterThan(0);
      }
    });

    it('should have unique exit codes for distinct error types', () => {
      // All primary error types should have unique codes
      const uniqueCodes = new Set([
        EXIT_CODES.INTERNAL_ERROR,
        EXIT_CODES.VAULT_NOT_FOUND,
        EXIT_CODES.NOTE_NOT_FOUND,
        EXIT_CODES.INVALID_INPUT,
        EXIT_CODES.WRITE_FAILED,
        EXIT_CODES.PERMISSION_DENIED,
      ]);

      // Should have at least 6 unique codes for the main error types
      expect(uniqueCodes.size).toBeGreaterThanOrEqual(6);
    });

    it('should have expected exit code values', () => {
      expect(EXIT_CODES.INTERNAL_ERROR).toBe(1);
      expect(EXIT_CODES.VAULT_NOT_FOUND).toBe(2);
      expect(EXIT_CODES.NOTE_NOT_FOUND).toBe(3);
      expect(EXIT_CODES.INVALID_INPUT).toBe(4);
      expect(EXIT_CODES.WRITE_FAILED).toBe(5);
      expect(EXIT_CODES.PERMISSION_DENIED).toBe(6);
    });
  });

  describe('CLIError class', () => {
    it('should create error with message and code', () => {
      const error = new CLIError('Something went wrong', ErrorCode.INTERNAL_ERROR);

      expect(error.message).toBe('Something went wrong');
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.name).toBe('CLIError');
    });

    it('should store optional details', () => {
      const details = { path: '/some/path', count: 5 };
      const error = new CLIError('Error', ErrorCode.INTERNAL_ERROR, details);

      expect(error.details).toEqual(details);
    });

    it('should store optional hint', () => {
      const error = new CLIError(
        'Error',
        ErrorCode.INTERNAL_ERROR,
        undefined,
        'Try running with --verbose'
      );

      expect(error.hint).toBe('Try running with --verbose');
    });

    it('should be instanceof Error', () => {
      const error = new CLIError('Error', ErrorCode.INTERNAL_ERROR);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('formatError', () => {
    it('should format basic error', () => {
      const error = new CLIError('Something failed', ErrorCode.INTERNAL_ERROR);
      const formatted = formatError(error);

      expect(formatted.error).toBe('Something failed');
      expect(formatted.code).toBe(ErrorCode.INTERNAL_ERROR);
    });

    it('should include details when present', () => {
      const error = new CLIError('Note not found', ErrorCode.NOTE_NOT_FOUND, {
        id: 'abc-123',
      });
      const formatted = formatError(error);

      expect(formatted.details).toEqual({ id: 'abc-123' });
    });

    it('should omit details when not present', () => {
      const error = new CLIError('Error', ErrorCode.INTERNAL_ERROR);
      const formatted = formatError(error);

      expect(formatted.details).toBeUndefined();
    });

    it('should include hint when present', () => {
      const error = new CLIError(
        'Invalid input',
        ErrorCode.INVALID_INPUT,
        undefined,
        'Check the --help output'
      );
      const formatted = formatError(error);

      expect(formatted.hint).toBe('Check the --help output');
    });

    it('should omit hint when not present', () => {
      const error = new CLIError('Error', ErrorCode.INTERNAL_ERROR);
      const formatted = formatError(error);

      expect(formatted.hint).toBeUndefined();
    });

    it('should produce valid JSON structure', () => {
      const error = new CLIError(
        'Full error',
        ErrorCode.VAULT_NOT_FOUND,
        {
          path: '/test',
        },
        'Check path'
      );
      const formatted = formatError(error);

      // Should be serializable to JSON
      const json = JSON.stringify(formatted);
      expect(json).toBeTruthy();

      const parsed = JSON.parse(json);
      expect(parsed.error).toBe('Full error');
      expect(parsed.code).toBe(ErrorCode.VAULT_NOT_FOUND);
      expect(parsed.details.path).toBe('/test');
      expect(parsed.hint).toBe('Check path');
    });
  });

  describe('convenience constructors', () => {
    describe('vaultNotFound', () => {
      it('should create VAULT_NOT_FOUND error with path', () => {
        const error = vaultNotFound('/path/to/vault');

        expect(error.code).toBe(ErrorCode.VAULT_NOT_FOUND);
        expect(error.message).toContain('/path/to/vault');
        expect(error.details?.path).toBe('/path/to/vault');
      });

      it('should include hint about specifying vault path', () => {
        const error = vaultNotFound('/path');

        expect(error.hint).toBeTruthy();
        expect(error.hint).toContain('vault');
      });
    });

    describe('noteNotFound', () => {
      it('should create NOTE_NOT_FOUND error with id', () => {
        const error = noteNotFound('abc-123');

        expect(error.code).toBe(ErrorCode.NOTE_NOT_FOUND);
        expect(error.details?.id).toBe('abc-123');
      });

      it('should have descriptive message', () => {
        const error = noteNotFound('xyz');

        expect(error.message).toBeTruthy();
        expect(error.message.toLowerCase()).toContain('not found');
      });
    });

    describe('invalidInput', () => {
      it('should create INVALID_INPUT error with message', () => {
        const error = invalidInput('Invalid date format');

        expect(error.code).toBe(ErrorCode.INVALID_INPUT);
        expect(error.message).toBe('Invalid date format');
      });

      it('should include field when provided', () => {
        const error = invalidInput('Must be a number', 'limit');

        expect(error.details?.field).toBe('limit');
      });

      it('should include value when provided', () => {
        const error = invalidInput('Invalid value', 'count', 'abc');

        expect(error.details?.field).toBe('count');
        expect(error.details?.value).toBe('abc');
      });

      it('should handle value of 0', () => {
        const error = invalidInput('Cannot be zero', 'count', 0);

        expect(error.details?.value).toBe(0);
      });
    });

    describe('hasBacklinks', () => {
      it('should create HAS_BACKLINKS error with backlink info', () => {
        const backlinks = [
          { id: 'note-1', title: 'Note 1' },
          { id: 'note-2', title: 'Note 2' },
        ];
        const error = hasBacklinks('target-note', backlinks);

        expect(error.code).toBe(ErrorCode.HAS_BACKLINKS);
        expect(error.details?.noteId).toBe('target-note');
        expect(error.details?.backlinkCount).toBe(2);
        expect(error.details?.backlinks).toEqual(backlinks);
      });

      it('should include hint about --force flag', () => {
        const error = hasBacklinks('note', [{ id: '1', title: 'T' }]);

        expect(error.hint).toContain('--force');
      });
    });

    describe('writeFailed', () => {
      it('should create WRITE_FAILED error with reason', () => {
        const error = writeFailed('Permission denied');

        expect(error.code).toBe(ErrorCode.WRITE_FAILED);
        expect(error.details?.reason).toBe('Permission denied');
      });

      it('should include path when provided', () => {
        const error = writeFailed('Disk full', '/path/to/file');

        expect(error.details?.reason).toBe('Disk full');
        expect(error.details?.path).toBe('/path/to/file');
      });

      it('should omit path when not provided', () => {
        const error = writeFailed('Unknown error');

        expect(error.details?.path).toBeUndefined();
      });
    });
  });
});
