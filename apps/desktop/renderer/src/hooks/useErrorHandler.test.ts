import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useErrorHandler, getUserFriendlyMessage } from './useErrorHandler';
import { ScribeError, ErrorCode } from '@scribe/shared';

describe('useErrorHandler', () => {
  let mockShowToast: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockShowToast = vi.fn();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleError', () => {
    it('shows toast with error message', () => {
      const { result } = renderHook(() => useErrorHandler({ showToast: mockShowToast }));

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      expect(mockShowToast).toHaveBeenCalledTimes(1);
      expect(mockShowToast).toHaveBeenCalledWith('An unexpected error occurred', 'error');
    });

    it('logs error to console without context', () => {
      const { result } = renderHook(() => useErrorHandler({ showToast: mockShowToast }));
      const testError = new Error('Test error');

      act(() => {
        result.current.handleError(testError);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', testError);
    });

    it('logs error to console with context', () => {
      const { result } = renderHook(() => useErrorHandler({ showToast: mockShowToast }));
      const testError = new Error('Test error');

      act(() => {
        result.current.handleError(testError, 'Failed to save note');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save note:', testError);
    });

    it('handles ScribeError with user-friendly message', () => {
      const { result } = renderHook(() => useErrorHandler({ showToast: mockShowToast }));
      const scribeError = new ScribeError(ErrorCode.FILE_NOT_FOUND, 'File not found');

      act(() => {
        result.current.handleError(scribeError, 'Failed to open file');
      });

      expect(mockShowToast).toHaveBeenCalledWith('The requested file could not be found.', 'error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to open file:', scribeError);
    });

    it('handles ScribeError with FILE_WRITE_ERROR code', () => {
      const { result } = renderHook(() => useErrorHandler({ showToast: mockShowToast }));
      const scribeError = new ScribeError(ErrorCode.FILE_WRITE_ERROR, 'Write failed');

      act(() => {
        result.current.handleError(scribeError);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Failed to save the file. Please check disk space and permissions.',
        'error'
      );
    });

    it('handles ScribeError with PERMISSION_DENIED code', () => {
      const { result } = renderHook(() => useErrorHandler({ showToast: mockShowToast }));
      const scribeError = new ScribeError(ErrorCode.PERMISSION_DENIED, 'Permission denied');

      act(() => {
        result.current.handleError(scribeError);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Permission denied. Please check file permissions.',
        'error'
      );
    });

    it('handles ScribeError with NOTE_NOT_FOUND code', () => {
      const { result } = renderHook(() => useErrorHandler({ showToast: mockShowToast }));
      const scribeError = new ScribeError(ErrorCode.NOTE_NOT_FOUND, 'Note not found');

      act(() => {
        result.current.handleError(scribeError);
      });

      expect(mockShowToast).toHaveBeenCalledWith('The requested note could not be found.', 'error');
    });

    it('handles string errors', () => {
      const { result } = renderHook(() => useErrorHandler({ showToast: mockShowToast }));

      act(() => {
        result.current.handleError('Something went wrong');
      });

      expect(mockShowToast).toHaveBeenCalledWith('Something went wrong', 'error');
    });

    it('handles null errors with default message', () => {
      const { result } = renderHook(() => useErrorHandler({ showToast: mockShowToast }));

      act(() => {
        result.current.handleError(null);
      });

      expect(mockShowToast).toHaveBeenCalledWith('An unexpected error occurred', 'error');
    });

    it('handles undefined errors with default message', () => {
      const { result } = renderHook(() => useErrorHandler({ showToast: mockShowToast }));

      act(() => {
        result.current.handleError(undefined);
      });

      expect(mockShowToast).toHaveBeenCalledWith('An unexpected error occurred', 'error');
    });

    it('handles object errors with default message', () => {
      const { result } = renderHook(() => useErrorHandler({ showToast: mockShowToast }));

      act(() => {
        result.current.handleError({ code: 500, message: 'Internal error' });
      });

      expect(mockShowToast).toHaveBeenCalledWith('An unexpected error occurred', 'error');
    });

    it('preserves callback identity across re-renders', () => {
      const { result, rerender } = renderHook(() => useErrorHandler({ showToast: mockShowToast }));

      const firstHandleError = result.current.handleError;
      rerender();
      const secondHandleError = result.current.handleError;

      // With the same showToast, handleError should be the same reference
      expect(firstHandleError).toBe(secondHandleError);
    });

    it('updates callback when showToast changes', () => {
      const mockShowToast2 = vi.fn();
      const { result, rerender } = renderHook(({ showToast }) => useErrorHandler({ showToast }), {
        initialProps: { showToast: mockShowToast },
      });

      const firstHandleError = result.current.handleError;

      // Change showToast prop
      rerender({ showToast: mockShowToast2 });
      const secondHandleError = result.current.handleError;

      // With different showToast, handleError should be a new reference
      expect(firstHandleError).not.toBe(secondHandleError);
    });
  });
});

describe('getUserFriendlyMessage', () => {
  it('returns ScribeError getUserMessage() for ScribeError instances', () => {
    const error = new ScribeError(ErrorCode.FILE_NOT_FOUND, 'File not found');
    expect(getUserFriendlyMessage(error)).toBe('The requested file could not be found.');
  });

  it('returns default message for standard Error instances', () => {
    const error = new Error('Technical error message');
    expect(getUserFriendlyMessage(error)).toBe('An unexpected error occurred');
  });

  it('returns string directly for string errors', () => {
    expect(getUserFriendlyMessage('Custom error message')).toBe('Custom error message');
  });

  it('returns default message for null', () => {
    expect(getUserFriendlyMessage(null)).toBe('An unexpected error occurred');
  });

  it('returns default message for undefined', () => {
    expect(getUserFriendlyMessage(undefined)).toBe('An unexpected error occurred');
  });

  it('returns default message for numbers', () => {
    expect(getUserFriendlyMessage(404)).toBe('An unexpected error occurred');
  });

  it('returns default message for objects', () => {
    expect(getUserFriendlyMessage({ error: true })).toBe('An unexpected error occurred');
  });

  it('returns default message for arrays', () => {
    expect(getUserFriendlyMessage(['error1', 'error2'])).toBe('An unexpected error occurred');
  });

  it('handles all ScribeError codes correctly', () => {
    const testCases: Array<{ code: ErrorCode; expected: string }> = [
      { code: ErrorCode.FILE_NOT_FOUND, expected: 'The requested file could not be found.' },
      {
        code: ErrorCode.FILE_READ_ERROR,
        expected: 'Failed to read the file. Please check file permissions.',
      },
      {
        code: ErrorCode.FILE_WRITE_ERROR,
        expected: 'Failed to save the file. Please check disk space and permissions.',
      },
      { code: ErrorCode.FILE_DELETE_ERROR, expected: 'Failed to delete the file.' },
      {
        code: ErrorCode.DISK_FULL,
        expected: 'Disk is full. Please free up some space and try again.',
      },
      {
        code: ErrorCode.PERMISSION_DENIED,
        expected: 'Permission denied. Please check file permissions.',
      },
      { code: ErrorCode.NOTE_NOT_FOUND, expected: 'The requested note could not be found.' },
      {
        code: ErrorCode.INVALID_NOTE_FORMAT,
        expected: 'The note has an invalid format and cannot be loaded.',
      },
      {
        code: ErrorCode.NOTE_CORRUPT,
        expected: 'The note file is corrupted and cannot be loaded.',
      },
      {
        code: ErrorCode.VAULT_NOT_INITIALIZED,
        expected: 'The vault has not been initialized. Please restart the application.',
      },
      {
        code: ErrorCode.VAULT_CORRUPTED,
        expected: 'The vault is corrupted. Please contact support.',
      },
      {
        code: ErrorCode.GRAPH_NOT_INITIALIZED,
        expected: 'The graph engine has not been initialized. Please restart the application.',
      },
      {
        code: ErrorCode.SEARCH_NOT_INITIALIZED,
        expected: 'The search engine has not been initialized. Please restart the application.',
      },
      {
        code: ErrorCode.UNKNOWN_ERROR,
        expected: 'An unexpected error occurred. Please try again.',
      },
    ];

    for (const { code, expected } of testCases) {
      const error = new ScribeError(code, 'Internal message');
      expect(getUserFriendlyMessage(error)).toBe(expected);
    }
  });

  it('handles VALIDATION_ERROR with custom message', () => {
    const error = new ScribeError(ErrorCode.VALIDATION_ERROR, 'Name cannot be empty');
    expect(getUserFriendlyMessage(error)).toBe('Name cannot be empty');
  });

  it('handles VALIDATION_ERROR with empty message', () => {
    const error = new ScribeError(ErrorCode.VALIDATION_ERROR, '');
    expect(getUserFriendlyMessage(error)).toBe('Invalid input provided.');
  });
});
