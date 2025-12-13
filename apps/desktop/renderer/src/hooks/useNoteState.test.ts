import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNoteState } from './useNoteState';
import { createNoteId, type Note, type LexicalState } from '@scribe/shared';

/**
 * Helper to create a mock Note object
 */
function createMockNote(overrides: Partial<Note> = {}): Note {
  const id = overrides.id ?? createNoteId('test-note-1');
  return {
    id,
    title: 'Test Note',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    content: {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'Test content' }],
          },
        ],
      },
    },
    metadata: {
      title: null,
      tags: [],
      links: [],
      mentions: [],
    },
    ...overrides,
  } as Note;
}

/**
 * Helper to create mock LexicalState content
 */
function createMockContent(text: string = 'Updated content'): LexicalState {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text }],
        },
      ],
    },
  };
}

describe('useNoteState', () => {
  let mockRead: ReturnType<typeof vi.fn>;
  let mockSave: ReturnType<typeof vi.fn>;
  let mockCreate: ReturnType<typeof vi.fn>;
  let mockDelete: ReturnType<typeof vi.fn>;
  let mockGetLastOpenedNote: ReturnType<typeof vi.fn>;
  let mockSetLastOpenedNote: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create mock functions
    mockRead = vi.fn();
    mockSave = vi.fn();
    mockCreate = vi.fn();
    mockDelete = vi.fn();
    mockGetLastOpenedNote = vi.fn();
    mockSetLastOpenedNote = vi.fn();

    // Suppress console.error during tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock window.scribe API
    window.scribe = {
      notes: {
        read: mockRead,
        save: mockSave,
        create: mockCreate,
        delete: mockDelete,
      },
      app: {
        getLastOpenedNote: mockGetLastOpenedNote,
        setLastOpenedNote: mockSetLastOpenedNote,
      },
    } as unknown as typeof window.scribe;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts with null currentNote and currentNoteId', () => {
      // Prevent auto-initialization
      mockGetLastOpenedNote.mockResolvedValue(null);
      mockCreate.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useNoteState());

      expect(result.current.currentNote).toBeNull();
      expect(result.current.currentNoteId).toBeNull();
      expect(result.current.isSystemNote).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('initializes by loading last opened note if available', async () => {
      const mockNote = createMockNote();
      mockGetLastOpenedNote.mockResolvedValue(mockNote.id);
      mockRead.mockResolvedValue(mockNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote).toEqual(mockNote);
      });

      expect(result.current.currentNoteId).toBe(mockNote.id);
      expect(mockRead).toHaveBeenCalledWith(mockNote.id);
      expect(mockSetLastOpenedNote).toHaveBeenCalledWith(mockNote.id);
    });

    it('creates a new note if no last opened note exists', async () => {
      const newNote = createMockNote({ id: createNoteId('new-note') });
      mockGetLastOpenedNote.mockResolvedValue(null);
      mockCreate.mockResolvedValue(newNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote).toEqual(newNote);
      });

      expect(result.current.currentNoteId).toBe(newNote.id);
      expect(mockCreate).toHaveBeenCalled();
      expect(mockSetLastOpenedNote).toHaveBeenCalledWith(newNote.id);
    });

    it('creates a new note if loading last opened note fails', async () => {
      const newNote = createMockNote({ id: createNoteId('new-note') });
      mockGetLastOpenedNote.mockResolvedValue(createNoteId('missing-note'));
      mockRead.mockRejectedValue(new Error('Note not found'));
      mockCreate.mockResolvedValue(newNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote).toEqual(newNote);
      });

      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe('loadNote', () => {
    it('loads an existing note successfully', async () => {
      const mockNote = createMockNote();
      mockGetLastOpenedNote.mockResolvedValue(null);
      mockCreate.mockImplementation(() => new Promise(() => {})); // Prevent auto-init
      mockRead.mockResolvedValue(mockNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNoteState());

      await act(async () => {
        await result.current.loadNote(mockNote.id);
      });

      expect(result.current.currentNote).toEqual(mockNote);
      expect(result.current.currentNoteId).toBe(mockNote.id);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(mockSetLastOpenedNote).toHaveBeenCalledWith(mockNote.id);
    });

    it('handles loading a system note (system:tasks)', async () => {
      mockGetLastOpenedNote.mockResolvedValue(null);
      mockCreate.mockImplementation(() => new Promise(() => {})); // Prevent auto-init

      const { result } = renderHook(() => useNoteState());

      const systemNoteId = createNoteId('system:tasks');

      await act(async () => {
        await result.current.loadNote(systemNoteId);
      });

      // System notes don't have content - just set the ID
      expect(result.current.currentNote).toBeNull();
      expect(result.current.currentNoteId).toBe(systemNoteId);
      expect(result.current.isSystemNote).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      // Should NOT call read for system notes
      expect(mockRead).not.toHaveBeenCalled();
    });

    it('sets error when loading a note fails', async () => {
      mockGetLastOpenedNote.mockResolvedValue(null);
      mockCreate.mockImplementation(() => new Promise(() => {})); // Prevent auto-init
      mockRead.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useNoteState());

      await act(async () => {
        await result.current.loadNote(createNoteId('missing-note'));
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('sets isLoading during load operation', async () => {
      mockGetLastOpenedNote.mockResolvedValue(null);
      mockCreate.mockImplementation(() => new Promise(() => {})); // Prevent auto-init

      let resolveRead: (note: Note) => void;
      mockRead.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRead = resolve;
          })
      );
      mockSetLastOpenedNote.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNoteState());

      // Start loading
      let loadPromise: Promise<void>;
      act(() => {
        loadPromise = result.current.loadNote(createNoteId('test-note'));
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);

      // Complete the load
      const mockNote = createMockNote();
      await act(async () => {
        resolveRead!(mockNote);
        await loadPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('saveNote', () => {
    it('saves note content successfully', async () => {
      const mockNote = createMockNote();
      mockGetLastOpenedNote.mockResolvedValue(mockNote.id);
      mockRead.mockResolvedValue(mockNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);
      mockSave.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useNoteState());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.currentNote).toEqual(mockNote);
      });

      const newContent = createMockContent('New content');

      await act(async () => {
        await result.current.saveNote(newContent);
      });

      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockNote,
          content: newContent,
        })
      );
      expect(result.current.currentNote?.content).toEqual(newContent);
      expect(result.current.error).toBeNull();
    });

    it('sets error when no note is loaded', async () => {
      mockGetLastOpenedNote.mockResolvedValue(null);
      mockCreate.mockImplementation(() => new Promise(() => {})); // Prevent auto-init

      const { result } = renderHook(() => useNoteState());

      await act(async () => {
        await result.current.saveNote(createMockContent());
      });

      expect(result.current.error).toBe('No note loaded to save');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('sets error when save fails with success: false', async () => {
      const mockNote = createMockNote();
      mockGetLastOpenedNote.mockResolvedValue(mockNote.id);
      mockRead.mockResolvedValue(mockNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);
      mockSave.mockResolvedValue({ success: false });

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote).toEqual(mockNote);
      });

      await act(async () => {
        await result.current.saveNote(createMockContent());
      });

      expect(result.current.error).toBe('Failed to save note');
    });

    it('sets error when save throws an exception', async () => {
      const mockNote = createMockNote();
      mockGetLastOpenedNote.mockResolvedValue(mockNote.id);
      mockRead.mockResolvedValue(mockNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);
      mockSave.mockRejectedValue(new Error('Disk full'));

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote).toEqual(mockNote);
      });

      await act(async () => {
        await result.current.saveNote(createMockContent());
      });

      expect(result.current.error).toBe('Disk full');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('updateMetadata', () => {
    it('updates title optimistically', async () => {
      const mockNote = createMockNote({ title: 'Original Title' });
      mockGetLastOpenedNote.mockResolvedValue(mockNote.id);
      mockRead.mockResolvedValue(mockNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);
      mockSave.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote).toEqual(mockNote);
      });

      await act(async () => {
        await result.current.updateMetadata({ title: 'New Title' });
      });

      expect(result.current.currentNote?.title).toBe('New Title');
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Title',
        })
      );
    });

    it('updates type optimistically', async () => {
      const mockNote = createMockNote();
      mockGetLastOpenedNote.mockResolvedValue(mockNote.id);
      mockRead.mockResolvedValue(mockNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);
      mockSave.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote).toEqual(mockNote);
      });

      await act(async () => {
        await result.current.updateMetadata({ type: 'person' });
      });

      expect(result.current.currentNote?.type).toBe('person');
    });

    it('updates tags optimistically', async () => {
      const mockNote = createMockNote({ tags: ['old-tag'] });
      mockGetLastOpenedNote.mockResolvedValue(mockNote.id);
      mockRead.mockResolvedValue(mockNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);
      mockSave.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote).toEqual(mockNote);
      });

      await act(async () => {
        await result.current.updateMetadata({ tags: ['new-tag', 'another-tag'] });
      });

      expect(result.current.currentNote?.tags).toEqual(['new-tag', 'another-tag']);
    });

    it('rolls back on save failure (success: false)', async () => {
      const originalNote = createMockNote({ title: 'Original Title' });
      mockGetLastOpenedNote.mockResolvedValue(originalNote.id);
      mockRead.mockResolvedValue(originalNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);
      mockSave.mockResolvedValue({ success: false });

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote?.title).toBe('Original Title');
      });

      await act(async () => {
        await result.current.updateMetadata({ title: 'New Title' });
      });

      // Should rollback to original
      expect(result.current.currentNote?.title).toBe('Original Title');
      expect(result.current.error).toBe('Failed to update note metadata');
    });

    it('rolls back on save exception', async () => {
      const originalNote = createMockNote({ title: 'Original Title' });
      mockGetLastOpenedNote.mockResolvedValue(originalNote.id);
      mockRead.mockResolvedValue(originalNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);
      mockSave.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote?.title).toBe('Original Title');
      });

      await act(async () => {
        await result.current.updateMetadata({ title: 'New Title' });
      });

      // Should rollback to original
      expect(result.current.currentNote?.title).toBe('Original Title');
      expect(result.current.error).toBe('Save failed');
    });

    it('sets error when no note is loaded', async () => {
      mockGetLastOpenedNote.mockResolvedValue(null);
      mockCreate.mockImplementation(() => new Promise(() => {})); // Prevent auto-init

      const { result } = renderHook(() => useNoteState());

      await act(async () => {
        await result.current.updateMetadata({ title: 'New Title' });
      });

      expect(result.current.error).toBe('No note loaded to update');
      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  describe('createNote', () => {
    it('creates a new note successfully', async () => {
      const newNote = createMockNote({ id: createNoteId('new-note'), title: 'Untitled' });
      mockGetLastOpenedNote.mockResolvedValue(null);

      // First call prevents auto-init, second call is manual createNote
      let createCallCount = 0;
      mockCreate.mockImplementation(() => {
        createCallCount++;
        if (createCallCount === 1) {
          return new Promise(() => {}); // Never resolve for auto-init
        }
        return Promise.resolve(newNote);
      });
      mockSetLastOpenedNote.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNoteState());

      await act(async () => {
        await result.current.createNote();
      });

      expect(result.current.currentNote).toEqual(newNote);
      expect(result.current.currentNoteId).toBe(newNote.id);
      expect(mockSetLastOpenedNote).toHaveBeenCalledWith(newNote.id);
    });

    it('sets isLoading during create operation', async () => {
      mockGetLastOpenedNote.mockResolvedValue(null);

      let resolveCreate: (note: Note) => void;
      let createCallCount = 0;
      mockCreate.mockImplementation(() => {
        createCallCount++;
        if (createCallCount === 1) {
          return new Promise(() => {}); // Never resolve for auto-init
        }
        return new Promise((resolve) => {
          resolveCreate = resolve;
        });
      });
      mockSetLastOpenedNote.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNoteState());

      // Start creating
      let createPromise: Promise<void>;
      act(() => {
        createPromise = result.current.createNote();
      });

      expect(result.current.isLoading).toBe(true);

      // Complete the create
      const newNote = createMockNote();
      await act(async () => {
        resolveCreate!(newNote);
        await createPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('sets error when create fails', async () => {
      mockGetLastOpenedNote.mockResolvedValue(null);

      let createCallCount = 0;
      mockCreate.mockImplementation(() => {
        createCallCount++;
        if (createCallCount === 1) {
          return new Promise(() => {}); // Never resolve for auto-init
        }
        return Promise.reject(new Error('Create failed'));
      });

      const { result } = renderHook(() => useNoteState());

      await act(async () => {
        await result.current.createNote();
      });

      expect(result.current.error).toBe('Create failed');
      expect(result.current.isLoading).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('deleteNote', () => {
    it('deletes a note successfully', async () => {
      const mockNote = createMockNote();
      mockGetLastOpenedNote.mockResolvedValue(mockNote.id);
      mockRead.mockResolvedValue(mockNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);
      mockDelete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote).toEqual(mockNote);
      });

      await act(async () => {
        await result.current.deleteNote(mockNote.id);
      });

      expect(mockDelete).toHaveBeenCalledWith(mockNote.id);
      // Current note should be cleared since we deleted it
      expect(result.current.currentNote).toBeNull();
      expect(result.current.currentNoteId).toBeNull();
    });

    it('clears current note only when deleting the current note', async () => {
      const currentNote = createMockNote({ id: createNoteId('current-note') });
      const otherNoteId = createNoteId('other-note');
      mockGetLastOpenedNote.mockResolvedValue(currentNote.id);
      mockRead.mockResolvedValue(currentNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);
      mockDelete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote).toEqual(currentNote);
      });

      // Delete a different note
      await act(async () => {
        await result.current.deleteNote(otherNoteId);
      });

      expect(mockDelete).toHaveBeenCalledWith(otherNoteId);
      // Current note should NOT be cleared
      expect(result.current.currentNote).toEqual(currentNote);
      expect(result.current.currentNoteId).toBe(currentNote.id);
    });

    it('throws error and prevents deletion of system notes', async () => {
      mockGetLastOpenedNote.mockResolvedValue(null);
      mockCreate.mockImplementation(() => new Promise(() => {})); // Prevent auto-init

      const { result } = renderHook(() => useNoteState());

      const systemNoteId = createNoteId('system:tasks');

      await expect(
        act(async () => {
          await result.current.deleteNote(systemNoteId);
        })
      ).rejects.toThrow('System notes cannot be deleted');

      expect(result.current.error).toBe('System notes cannot be deleted');
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('sets error and re-throws when delete fails', async () => {
      const mockNote = createMockNote();
      mockGetLastOpenedNote.mockResolvedValue(mockNote.id);
      mockRead.mockResolvedValue(mockNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);
      mockDelete.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote).toEqual(mockNote);
      });

      await expect(
        act(async () => {
          await result.current.deleteNote(mockNote.id);
        })
      ).rejects.toThrow('Delete failed');

      expect(result.current.error).toBe('Delete failed');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('isSystemNote computed property', () => {
    it('returns false for regular notes', async () => {
      const mockNote = createMockNote();
      mockGetLastOpenedNote.mockResolvedValue(mockNote.id);
      mockRead.mockResolvedValue(mockNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote).toEqual(mockNote);
      });

      expect(result.current.isSystemNote).toBe(false);
    });

    it('returns true for system notes', async () => {
      mockGetLastOpenedNote.mockResolvedValue(null);
      mockCreate.mockImplementation(() => new Promise(() => {})); // Prevent auto-init

      const { result } = renderHook(() => useNoteState());

      await act(async () => {
        await result.current.loadNote(createNoteId('system:tasks'));
      });

      expect(result.current.isSystemNote).toBe(true);
    });

    it('returns false when currentNoteId is null', () => {
      mockGetLastOpenedNote.mockResolvedValue(null);
      mockCreate.mockImplementation(() => new Promise(() => {})); // Prevent auto-init

      const { result } = renderHook(() => useNoteState());

      expect(result.current.isSystemNote).toBe(false);
    });
  });

  describe('return value stability', () => {
    it('returns memoized object when dependencies do not change', async () => {
      const mockNote = createMockNote();
      mockGetLastOpenedNote.mockResolvedValue(mockNote.id);
      mockRead.mockResolvedValue(mockNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);

      const { result, rerender } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote).toEqual(mockNote);
      });

      const firstReturn = result.current;

      // Rerender without changes
      rerender();

      // The object reference should be stable due to useMemo
      expect(result.current).toBe(firstReturn);
    });
  });

  describe('error state management', () => {
    it('clears error when loading a new note', async () => {
      const mockNote = createMockNote();
      mockGetLastOpenedNote.mockResolvedValue(null);
      mockCreate.mockImplementation(() => new Promise(() => {})); // Prevent auto-init
      mockRead.mockResolvedValueOnce(Promise.reject(new Error('First error')));
      mockRead.mockResolvedValueOnce(mockNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNoteState());

      // First load fails
      await act(async () => {
        await result.current.loadNote(createNoteId('note-1'));
      });

      expect(result.current.error).toBe('First error');

      // Second load succeeds
      await act(async () => {
        await result.current.loadNote(mockNote.id);
      });

      expect(result.current.error).toBeNull();
    });

    it('clears error when creating a new note', async () => {
      const mockNote = createMockNote();
      mockGetLastOpenedNote.mockResolvedValue(null);

      let createCallCount = 0;
      mockCreate.mockImplementation(() => {
        createCallCount++;
        if (createCallCount === 1) {
          return new Promise(() => {}); // Never resolve for auto-init
        }
        return Promise.resolve(mockNote);
      });
      mockSetLastOpenedNote.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNoteState());

      // Set an error first via saveNote with no note loaded
      await act(async () => {
        await result.current.saveNote(createMockContent());
      });

      expect(result.current.error).toBe('No note loaded to save');

      // Create a new note clears the error
      await act(async () => {
        await result.current.createNote();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('concurrent operations', () => {
    it('handles rapid metadata updates correctly', async () => {
      const mockNote = createMockNote({ title: 'Original' });
      mockGetLastOpenedNote.mockResolvedValue(mockNote.id);
      mockRead.mockResolvedValue(mockNote);
      mockSetLastOpenedNote.mockResolvedValue(undefined);
      mockSave.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useNoteState());

      await waitFor(() => {
        expect(result.current.currentNote?.title).toBe('Original');
      });

      // Fire off multiple rapid updates
      await act(async () => {
        result.current.updateMetadata({ title: 'Update 1' });
        result.current.updateMetadata({ title: 'Update 2' });
        await result.current.updateMetadata({ title: 'Update 3' });
      });

      // Final title should be Update 3
      expect(result.current.currentNote?.title).toBe('Update 3');
    });
  });

  describe('initialization guard', () => {
    it('prevents infinite loop when both load and create fail', async () => {
      mockGetLastOpenedNote.mockResolvedValue(createNoteId('missing-note'));
      mockRead.mockRejectedValue(new Error('Load failed'));
      mockCreate.mockRejectedValue(new Error('Create failed'));

      const { result } = renderHook(() => useNoteState());

      // Wait for initialization attempts to complete
      await waitFor(
        () => {
          expect(result.current.error).toBe('Create failed');
        },
        { timeout: 1000 }
      );

      // Verify initialization only happened once
      // (mockCreate should be called once for initialization, not in an infinite loop)
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });
});
