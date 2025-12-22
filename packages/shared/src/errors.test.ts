/**
 * Tests for error classes and type guards
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  ScribeError,
  FileSystemError,
  NoteError,
  VaultError,
  EngineError,
  ValidationError,
  isScribeError,
  isFileSystemError,
  isNoteError,
  isVaultError,
  isEngineError,
  isValidationError,
} from './errors.js';
import { createNoteId, createVaultPath } from './types.js';

describe('ScribeError', () => {
  it('should create a ScribeError with code and message', () => {
    const error = new ScribeError(ErrorCode.UNKNOWN_ERROR, 'Test error');
    expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('ScribeError');
  });

  it('should create a ScribeError with cause', () => {
    const cause = new Error('Original error');
    const error = new ScribeError(ErrorCode.FILE_READ_ERROR, 'Failed to read', cause);
    expect(error.cause).toBe(cause);
  });

  it('should provide user-friendly messages for all error codes', () => {
    const errorCodes = Object.values(ErrorCode);
    for (const code of errorCodes) {
      const error = new ScribeError(code, 'Test');
      const message = error.getUserMessage();
      expect(message.length).toBeGreaterThan(0);
    }
  });

  describe('fromSystemError', () => {
    it('should map ENOENT to FILE_NOT_FOUND', () => {
      const systemError = Object.assign(new Error('File not found'), { code: 'ENOENT' });
      const code = ScribeError.fromSystemError(systemError, ErrorCode.UNKNOWN_ERROR);
      expect(code).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it('should map EACCES to PERMISSION_DENIED', () => {
      const systemError = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
      const code = ScribeError.fromSystemError(systemError, ErrorCode.UNKNOWN_ERROR);
      expect(code).toBe(ErrorCode.PERMISSION_DENIED);
    });

    it('should map EPERM to PERMISSION_DENIED', () => {
      const systemError = Object.assign(new Error('Operation not permitted'), { code: 'EPERM' });
      const code = ScribeError.fromSystemError(systemError, ErrorCode.UNKNOWN_ERROR);
      expect(code).toBe(ErrorCode.PERMISSION_DENIED);
    });

    it('should map ENOSPC to DISK_FULL', () => {
      const systemError = Object.assign(new Error('No space left'), { code: 'ENOSPC' });
      const code = ScribeError.fromSystemError(systemError, ErrorCode.UNKNOWN_ERROR);
      expect(code).toBe(ErrorCode.DISK_FULL);
    });

    it('should map EEXIST to FILE_EXISTS', () => {
      const systemError = Object.assign(new Error('File exists'), { code: 'EEXIST' });
      const code = ScribeError.fromSystemError(systemError, ErrorCode.UNKNOWN_ERROR);
      expect(code).toBe(ErrorCode.FILE_EXISTS);
    });

    it('should map EISDIR to IS_DIRECTORY', () => {
      const systemError = Object.assign(new Error('Is a directory'), { code: 'EISDIR' });
      const code = ScribeError.fromSystemError(systemError, ErrorCode.UNKNOWN_ERROR);
      expect(code).toBe(ErrorCode.IS_DIRECTORY);
    });

    it('should map ENOTDIR to NOT_DIRECTORY', () => {
      const systemError = Object.assign(new Error('Not a directory'), { code: 'ENOTDIR' });
      const code = ScribeError.fromSystemError(systemError, ErrorCode.UNKNOWN_ERROR);
      expect(code).toBe(ErrorCode.NOT_DIRECTORY);
    });

    it('should map EMFILE to TOO_MANY_OPEN_FILES', () => {
      const systemError = Object.assign(new Error('Too many open files'), { code: 'EMFILE' });
      const code = ScribeError.fromSystemError(systemError, ErrorCode.UNKNOWN_ERROR);
      expect(code).toBe(ErrorCode.TOO_MANY_OPEN_FILES);
    });

    it('should map ENFILE to TOO_MANY_OPEN_FILES', () => {
      const systemError = Object.assign(new Error('File table overflow'), { code: 'ENFILE' });
      const code = ScribeError.fromSystemError(systemError, ErrorCode.UNKNOWN_ERROR);
      expect(code).toBe(ErrorCode.TOO_MANY_OPEN_FILES);
    });

    it('should map ENOTEMPTY to DIRECTORY_NOT_EMPTY', () => {
      const systemError = Object.assign(new Error('Directory not empty'), { code: 'ENOTEMPTY' });
      const code = ScribeError.fromSystemError(systemError, ErrorCode.UNKNOWN_ERROR);
      expect(code).toBe(ErrorCode.DIRECTORY_NOT_EMPTY);
    });

    it('should return defaultCode for unknown system error codes', () => {
      const systemError = Object.assign(new Error('Unknown'), { code: 'EUNKNOWN' });
      const code = ScribeError.fromSystemError(systemError, ErrorCode.FILE_READ_ERROR);
      expect(code).toBe(ErrorCode.FILE_READ_ERROR);
    });

    it('should return defaultCode when no code property', () => {
      const systemError = new Error('No code');
      const code = ScribeError.fromSystemError(systemError, ErrorCode.UNKNOWN_ERROR);
      expect(code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });
});

describe('FileSystemError', () => {
  it('should create a FileSystemError with path', () => {
    const error = new FileSystemError(
      ErrorCode.FILE_NOT_FOUND,
      'File not found',
      '/path/to/file.json'
    );
    expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(error.message).toBe('File not found');
    expect(error.path).toBe('/path/to/file.json');
    expect(error.name).toBe('FileSystemError');
  });

  it('should be instanceof ScribeError', () => {
    const error = new FileSystemError(
      ErrorCode.FILE_NOT_FOUND,
      'File not found',
      '/path/to/file.json'
    );
    expect(error).toBeInstanceOf(ScribeError);
    expect(error).toBeInstanceOf(FileSystemError);
  });

  it('should create from system error using create()', () => {
    const systemError = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
    const error = FileSystemError.create(systemError, '/path/to/file.json');
    expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(error.path).toBe('/path/to/file.json');
    expect(error.cause).toBe(systemError);
  });
});

describe('NoteError', () => {
  it('should create a NoteError with noteId', () => {
    const noteId = createNoteId('abc-123');
    const error = new NoteError(ErrorCode.NOTE_NOT_FOUND, 'Note not found', noteId);
    expect(error.code).toBe(ErrorCode.NOTE_NOT_FOUND);
    expect(error.message).toBe('Note not found');
    expect(error.noteId).toBe(noteId);
    expect(error.name).toBe('NoteError');
  });

  it('should be instanceof ScribeError', () => {
    const noteId = createNoteId('abc-123');
    const error = new NoteError(ErrorCode.NOTE_NOT_FOUND, 'Note not found', noteId);
    expect(error).toBeInstanceOf(ScribeError);
    expect(error).toBeInstanceOf(NoteError);
  });
});

describe('VaultError', () => {
  it('should create a VaultError with vaultPath', () => {
    const vaultPath = createVaultPath('/path/to/vault');
    const error = new VaultError(
      ErrorCode.VAULT_NOT_INITIALIZED,
      'Vault not initialized',
      vaultPath
    );
    expect(error.code).toBe(ErrorCode.VAULT_NOT_INITIALIZED);
    expect(error.message).toBe('Vault not initialized');
    expect(error.vaultPath).toBe(vaultPath);
    expect(error.name).toBe('VaultError');
  });

  it('should be instanceof ScribeError', () => {
    const vaultPath = createVaultPath('/path/to/vault');
    const error = new VaultError(
      ErrorCode.VAULT_NOT_INITIALIZED,
      'Vault not initialized',
      vaultPath
    );
    expect(error).toBeInstanceOf(ScribeError);
    expect(error).toBeInstanceOf(VaultError);
  });
});

describe('EngineError', () => {
  it('should create an EngineError with engine name', () => {
    const error = new EngineError(
      ErrorCode.GRAPH_NOT_INITIALIZED,
      'Graph not initialized',
      'graph'
    );
    expect(error.code).toBe(ErrorCode.GRAPH_NOT_INITIALIZED);
    expect(error.message).toBe('Graph not initialized');
    expect(error.engine).toBe('graph');
    expect(error.name).toBe('EngineError');
  });

  it('should be instanceof ScribeError', () => {
    const error = new EngineError(
      ErrorCode.SEARCH_NOT_INITIALIZED,
      'Search not initialized',
      'search'
    );
    expect(error).toBeInstanceOf(ScribeError);
    expect(error).toBeInstanceOf(EngineError);
  });
});

describe('ValidationError', () => {
  it('should create a ValidationError with field', () => {
    const error = new ValidationError('Title cannot be empty', 'title');
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toBe('Title cannot be empty');
    expect(error.field).toBe('title');
    expect(error.name).toBe('ValidationError');
  });

  it('should create a ValidationError without field', () => {
    const error = new ValidationError('Invalid input');
    expect(error.field).toBeUndefined();
  });

  it('should be instanceof ScribeError', () => {
    const error = new ValidationError('Invalid input');
    expect(error).toBeInstanceOf(ScribeError);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('should return message from getUserMessage', () => {
    const error = new ValidationError('Title is required');
    expect(error.getUserMessage()).toBe('Title is required');
  });
});

describe('Type Guards', () => {
  const scribeError = new ScribeError(ErrorCode.UNKNOWN_ERROR, 'Test');
  const fileSystemError = new FileSystemError(ErrorCode.FILE_NOT_FOUND, 'Test', '/path');
  const noteError = new NoteError(ErrorCode.NOTE_NOT_FOUND, 'Test', createNoteId('abc'));
  const vaultError = new VaultError(
    ErrorCode.VAULT_NOT_INITIALIZED,
    'Test',
    createVaultPath('/vault')
  );
  const engineError = new EngineError(ErrorCode.GRAPH_NOT_INITIALIZED, 'Test', 'graph');
  const validationError = new ValidationError('Test');
  const regularError = new Error('Regular error');

  describe('isScribeError', () => {
    it('should return true for ScribeError and subclasses', () => {
      expect(isScribeError(scribeError)).toBe(true);
      expect(isScribeError(fileSystemError)).toBe(true);
      expect(isScribeError(noteError)).toBe(true);
      expect(isScribeError(vaultError)).toBe(true);
      expect(isScribeError(engineError)).toBe(true);
      expect(isScribeError(validationError)).toBe(true);
    });

    it('should return false for regular errors', () => {
      expect(isScribeError(regularError)).toBe(false);
      expect(isScribeError(null)).toBe(false);
      expect(isScribeError(undefined)).toBe(false);
      expect(isScribeError('string')).toBe(false);
    });
  });

  describe('isFileSystemError', () => {
    it('should return true only for FileSystemError', () => {
      expect(isFileSystemError(fileSystemError)).toBe(true);
      expect(isFileSystemError(scribeError)).toBe(false);
      expect(isFileSystemError(noteError)).toBe(false);
      expect(isFileSystemError(regularError)).toBe(false);
    });
  });

  describe('isNoteError', () => {
    it('should return true only for NoteError', () => {
      expect(isNoteError(noteError)).toBe(true);
      expect(isNoteError(scribeError)).toBe(false);
      expect(isNoteError(fileSystemError)).toBe(false);
      expect(isNoteError(regularError)).toBe(false);
    });
  });

  describe('isVaultError', () => {
    it('should return true only for VaultError', () => {
      expect(isVaultError(vaultError)).toBe(true);
      expect(isVaultError(scribeError)).toBe(false);
      expect(isVaultError(fileSystemError)).toBe(false);
      expect(isVaultError(regularError)).toBe(false);
    });
  });

  describe('isEngineError', () => {
    it('should return true only for EngineError', () => {
      expect(isEngineError(engineError)).toBe(true);
      expect(isEngineError(scribeError)).toBe(false);
      expect(isEngineError(fileSystemError)).toBe(false);
      expect(isEngineError(regularError)).toBe(false);
    });
  });

  describe('isValidationError', () => {
    it('should return true only for ValidationError', () => {
      expect(isValidationError(validationError)).toBe(true);
      expect(isValidationError(scribeError)).toBe(false);
      expect(isValidationError(fileSystemError)).toBe(false);
      expect(isValidationError(regularError)).toBe(false);
    });
  });
});

describe('instanceof pattern matching', () => {
  it('should enable type-safe error handling with instanceof', () => {
    const errors = [
      new FileSystemError(ErrorCode.FILE_NOT_FOUND, 'Test', '/path'),
      new NoteError(ErrorCode.NOTE_NOT_FOUND, 'Test', createNoteId('abc')),
      new VaultError(ErrorCode.VAULT_NOT_INITIALIZED, 'Test', createVaultPath('/vault')),
      new EngineError(ErrorCode.GRAPH_NOT_INITIALIZED, 'Test', 'graph'),
      new ValidationError('Test', 'field'),
    ];

    for (const error of errors) {
      if (error instanceof FileSystemError) {
        // TypeScript knows error.path exists
        expect(typeof error.path).toBe('string');
      } else if (error instanceof NoteError) {
        // TypeScript knows error.noteId exists
        expect(typeof error.noteId).toBe('string');
      } else if (error instanceof VaultError) {
        // TypeScript knows error.vaultPath exists
        expect(typeof error.vaultPath).toBe('string');
      } else if (error instanceof EngineError) {
        // TypeScript knows error.engine exists
        expect(['graph', 'search', 'storage', 'metadata']).toContain(error.engine);
      } else if (error instanceof ValidationError) {
        // TypeScript knows error.field exists (optional)
        expect(error.field === undefined || typeof error.field === 'string').toBe(true);
      }
    }
  });
});

// Import the new error extraction utilities for testing
import { getErrorMessage, getErrorMessageWithContext } from './errors.js';

describe('getErrorMessage', () => {
  it('should extract message from Error instances', () => {
    const error = new Error('Something went wrong');
    expect(getErrorMessage(error)).toBe('Something went wrong');
  });

  it('should extract message from ScribeError instances', () => {
    const error = new ScribeError(ErrorCode.FILE_NOT_FOUND, 'File not found');
    expect(getErrorMessage(error)).toBe('File not found');
  });

  it('should return string errors directly', () => {
    const error = 'Something went wrong';
    expect(getErrorMessage(error)).toBe('Something went wrong');
  });

  it('should return fallback for null', () => {
    expect(getErrorMessage(null)).toBe('An error occurred');
  });

  it('should return fallback for undefined', () => {
    expect(getErrorMessage(undefined)).toBe('An error occurred');
  });

  it('should return fallback for objects without message', () => {
    expect(getErrorMessage({ foo: 'bar' })).toBe('An error occurred');
  });

  it('should return fallback for numbers', () => {
    expect(getErrorMessage(42)).toBe('An error occurred');
  });

  it('should return fallback for booleans', () => {
    expect(getErrorMessage(true)).toBe('An error occurred');
  });

  it('should use custom fallback when provided', () => {
    expect(getErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
  });

  it('should use custom fallback for non-Error objects', () => {
    expect(getErrorMessage({}, 'Failed to load')).toBe('Failed to load');
  });
});

describe('getErrorMessageWithContext', () => {
  it('should combine context with Error message', () => {
    const error = new Error('Network timeout');
    expect(getErrorMessageWithContext(error, 'Failed to save note')).toBe(
      'Failed to save note: Network timeout'
    );
  });

  it('should combine context with string error', () => {
    expect(getErrorMessageWithContext('Connection refused', 'Failed to connect')).toBe(
      'Failed to connect: Connection refused'
    );
  });

  it('should return only context for null', () => {
    expect(getErrorMessageWithContext(null, 'Failed to save note')).toBe('Failed to save note');
  });

  it('should return only context for undefined', () => {
    expect(getErrorMessageWithContext(undefined, 'Failed to save note')).toBe(
      'Failed to save note'
    );
  });

  it('should return only context for objects without message', () => {
    expect(getErrorMessageWithContext({ code: 500 }, 'Server error')).toBe('Server error');
  });

  it('should work with ScribeError instances', () => {
    const error = new FileSystemError(ErrorCode.FILE_NOT_FOUND, 'File not found', '/path/to/file');
    expect(getErrorMessageWithContext(error, 'Failed to load')).toBe(
      'Failed to load: File not found'
    );
  });

  it('should preserve empty string message', () => {
    const error = new Error('');
    // Empty string is falsy, so it should return just the context
    expect(getErrorMessageWithContext(error, 'Operation failed')).toBe('Operation failed');
  });
});
