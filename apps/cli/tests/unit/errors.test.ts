/**
 * Unit tests for errors.ts
 *
 * Tests CLI error handling, error codes, exit codes, and error formatting.
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  EXIT_CODES,
  getExitCode,
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
    it('should define CLI-specific error codes', () => {
      expect(ErrorCode.CLI_INTERNAL_ERROR).toBe('CLI_INTERNAL_ERROR');
      expect(ErrorCode.CLI_MISSING_VAULT).toBe('CLI_MISSING_VAULT');
      expect(ErrorCode.CLI_INVALID_ARGUMENT).toBe('CLI_INVALID_ARGUMENT');
      expect(ErrorCode.CLI_WRITE_FAILED).toBe('CLI_WRITE_FAILED');
      expect(ErrorCode.CLI_HAS_BACKLINKS).toBe('CLI_HAS_BACKLINKS');
    });

    it('should also include shared error codes used by CLI', () => {
      expect(ErrorCode.NOTE_NOT_FOUND).toBe('NOTE_NOT_FOUND');
      expect(ErrorCode.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    });
  });

  describe('EXIT_CODES', () => {
    it('should have exit codes for CLI-specific error codes', () => {
      expect(EXIT_CODES[ErrorCode.CLI_INTERNAL_ERROR]).toBeDefined();
      expect(EXIT_CODES[ErrorCode.CLI_MISSING_VAULT]).toBeDefined();
      expect(EXIT_CODES[ErrorCode.CLI_INVALID_ARGUMENT]).toBeDefined();
      expect(EXIT_CODES[ErrorCode.CLI_WRITE_FAILED]).toBeDefined();
      expect(EXIT_CODES[ErrorCode.CLI_HAS_BACKLINKS]).toBeDefined();
    });

    it('should have exit codes for commonly used shared codes', () => {
      expect(EXIT_CODES[ErrorCode.NOTE_NOT_FOUND]).toBeDefined();
      expect(EXIT_CODES[ErrorCode.PERMISSION_DENIED]).toBeDefined();
    });

    it('should use non-zero exit codes', () => {
      for (const code of Object.keys(EXIT_CODES)) {
        expect(EXIT_CODES[code as ErrorCode]).toBeGreaterThan(0);
      }
    });

    it('should have unique exit codes for distinct error types', () => {
      // All primary error types should have unique codes
      const uniqueCodes = new Set([
        EXIT_CODES[ErrorCode.CLI_INTERNAL_ERROR],
        EXIT_CODES[ErrorCode.CLI_MISSING_VAULT],
        EXIT_CODES[ErrorCode.NOTE_NOT_FOUND],
        EXIT_CODES[ErrorCode.CLI_INVALID_ARGUMENT],
        EXIT_CODES[ErrorCode.CLI_WRITE_FAILED],
        EXIT_CODES[ErrorCode.PERMISSION_DENIED],
      ]);

      // Should have at least 5 unique codes for the main error types
      // (NOTE_NOT_FOUND and CLI_HAS_BACKLINKS share exit code 3)
      expect(uniqueCodes.size).toBeGreaterThanOrEqual(5);
    });

    it('should have expected exit code values', () => {
      expect(EXIT_CODES[ErrorCode.CLI_INTERNAL_ERROR]).toBe(1);
      expect(EXIT_CODES[ErrorCode.CLI_MISSING_VAULT]).toBe(2);
      expect(EXIT_CODES[ErrorCode.NOTE_NOT_FOUND]).toBe(3);
      expect(EXIT_CODES[ErrorCode.CLI_INVALID_ARGUMENT]).toBe(4);
      expect(EXIT_CODES[ErrorCode.CLI_WRITE_FAILED]).toBe(5);
      expect(EXIT_CODES[ErrorCode.PERMISSION_DENIED]).toBe(6);
    });
  });

  describe('getExitCode', () => {
    it('should return mapped exit code for known codes', () => {
      expect(getExitCode(ErrorCode.CLI_INTERNAL_ERROR)).toBe(1);
      expect(getExitCode(ErrorCode.NOTE_NOT_FOUND)).toBe(3);
    });

    it('should return 1 for unknown codes', () => {
      expect(getExitCode(ErrorCode.UNKNOWN_ERROR)).toBe(1);
    });
  });

  describe('CLIError class', () => {
    it('should create error with message and code', () => {
      const error = new CLIError('Something went wrong', ErrorCode.CLI_INTERNAL_ERROR);

      expect(error.message).toBe('Something went wrong');
      expect(error.code).toBe(ErrorCode.CLI_INTERNAL_ERROR);
      expect(error.name).toBe('CLIError');
    });

    it('should store optional details', () => {
      const details = { path: '/some/path', count: 5 };
      const error = new CLIError('Error', ErrorCode.CLI_INTERNAL_ERROR, details);

      expect(error.details).toEqual(details);
    });

    it('should store optional hint', () => {
      const error = new CLIError(
        'Error',
        ErrorCode.CLI_INTERNAL_ERROR,
        undefined,
        'Try running with --verbose'
      );

      expect(error.hint).toBe('Try running with --verbose');
    });

    it('should be instanceof Error', () => {
      const error = new CLIError('Error', ErrorCode.CLI_INTERNAL_ERROR);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('formatError', () => {
    it('should format basic error', () => {
      const error = new CLIError('Something failed', ErrorCode.CLI_INTERNAL_ERROR);
      const formatted = formatError(error);

      expect(formatted.error).toBe('Something failed');
      expect(formatted.code).toBe(ErrorCode.CLI_INTERNAL_ERROR);
    });

    it('should include details when present', () => {
      const error = new CLIError('Note not found', ErrorCode.NOTE_NOT_FOUND, {
        id: 'abc-123',
      });
      const formatted = formatError(error);

      expect(formatted.details).toEqual({ id: 'abc-123' });
    });

    it('should omit details when not present', () => {
      const error = new CLIError('Error', ErrorCode.CLI_INTERNAL_ERROR);
      const formatted = formatError(error);

      expect(formatted.details).toBeUndefined();
    });

    it('should include hint when present', () => {
      const error = new CLIError(
        'Invalid input',
        ErrorCode.CLI_INVALID_ARGUMENT,
        undefined,
        'Check the --help output'
      );
      const formatted = formatError(error);

      expect(formatted.hint).toBe('Check the --help output');
    });

    it('should omit hint when not present', () => {
      const error = new CLIError('Error', ErrorCode.CLI_INTERNAL_ERROR);
      const formatted = formatError(error);

      expect(formatted.hint).toBeUndefined();
    });

    it('should produce valid JSON structure', () => {
      const error = new CLIError(
        'Full error',
        ErrorCode.CLI_MISSING_VAULT,
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
      expect(parsed.code).toBe(ErrorCode.CLI_MISSING_VAULT);
      expect(parsed.details.path).toBe('/test');
      expect(parsed.hint).toBe('Check path');
    });
  });

  describe('convenience constructors', () => {
    describe('vaultNotFound', () => {
      it('should create CLI_MISSING_VAULT error with path', () => {
        const error = vaultNotFound('/path/to/vault');

        expect(error.code).toBe(ErrorCode.CLI_MISSING_VAULT);
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
      it('should create CLI_INVALID_ARGUMENT error with message', () => {
        const error = invalidInput('Invalid date format');

        expect(error.code).toBe(ErrorCode.CLI_INVALID_ARGUMENT);
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
      it('should create CLI_HAS_BACKLINKS error with backlink info', () => {
        const backlinks = [
          { id: 'note-1', title: 'Note 1' },
          { id: 'note-2', title: 'Note 2' },
        ];
        const error = hasBacklinks('target-note', backlinks);

        expect(error.code).toBe(ErrorCode.CLI_HAS_BACKLINKS);
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
      it('should create CLI_WRITE_FAILED error with reason', () => {
        const error = writeFailed('Permission denied');

        expect(error.code).toBe(ErrorCode.CLI_WRITE_FAILED);
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
