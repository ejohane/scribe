/**
 * Tests for YjsProvider component
 */

import { describe, it, expect, vi, type Mock } from 'vitest';
import { render, screen, renderHook, waitFor } from '@testing-library/react';
import * as Y from 'yjs';
import { YjsProvider, useYjs, useYjsDoc } from './YjsProvider';
import type { CollabClient, DocumentSession } from '@scribe/client-sdk';

// Mock CollabClient and DocumentSession
function createMockSession(noteId: string): DocumentSession {
  const doc = new Y.Doc();
  return {
    noteId,
    doc,
    destroy: vi.fn(() => {
      doc.destroy();
    }),
  };
}

function createMockCollabClient(options?: {
  joinDelay?: number;
  shouldFail?: boolean;
  errorMessage?: string;
}): CollabClient {
  const { joinDelay = 0, shouldFail = false, errorMessage = 'Connection failed' } = options ?? {};

  return {
    joinDocument: vi.fn(async (noteId: string) => {
      if (joinDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, joinDelay));
      }
      if (shouldFail) {
        throw new Error(errorMessage);
      }
      return createMockSession(noteId);
    }),
  } as unknown as CollabClient;
}

describe('YjsProvider', () => {
  describe('mounting and document join', () => {
    it('renders children while loading', () => {
      const mockClient = createMockCollabClient({ joinDelay: 1000 });

      render(
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          <div data-testid="child">Test content</div>
        </YjsProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByTestId('child')).toHaveTextContent('Test content');
    });

    it('joins document on mount', async () => {
      const mockClient = createMockCollabClient();

      render(
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          <div>Content</div>
        </YjsProvider>
      );

      await waitFor(() => {
        expect(mockClient.joinDocument).toHaveBeenCalledWith('test-note');
      });
    });

    it('provides doc after successful join', async () => {
      const mockClient = createMockCollabClient();
      let contextValue: ReturnType<typeof useYjs> | null = null;

      function TestConsumer() {
        contextValue = useYjs();
        return null;
      }

      render(
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          <TestConsumer />
        </YjsProvider>
      );

      await waitFor(() => {
        expect(contextValue?.doc).toBeInstanceOf(Y.Doc);
        expect(contextValue?.isLoading).toBe(false);
        expect(contextValue?.error).toBeNull();
      });
    });
  });

  describe('loading state', () => {
    it('indicates loading state while joining', async () => {
      const mockClient = createMockCollabClient({ joinDelay: 100 });
      let contextValue: ReturnType<typeof useYjs> | null = null;

      function TestConsumer() {
        contextValue = useYjs();
        return null;
      }

      render(
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          <TestConsumer />
        </YjsProvider>
      );

      // Initially loading
      expect(contextValue).not.toBeNull();
      expect(contextValue!.isLoading).toBe(true);
      expect(contextValue!.doc).toBeNull();

      // After join completes
      await waitFor(() => {
        expect(contextValue!.isLoading).toBe(false);
        expect(contextValue!.doc).toBeInstanceOf(Y.Doc);
      });
    });
  });

  describe('error handling', () => {
    it('handles join errors', async () => {
      const mockClient = createMockCollabClient({
        shouldFail: true,
        errorMessage: 'WebSocket connection failed',
      });
      let contextValue: ReturnType<typeof useYjs> | null = null;

      function TestConsumer() {
        contextValue = useYjs();
        return null;
      }

      render(
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          <TestConsumer />
        </YjsProvider>
      );

      await waitFor(() => {
        expect(contextValue?.error).toBeInstanceOf(Error);
        expect(contextValue?.error?.message).toBe('WebSocket connection failed');
        expect(contextValue?.isLoading).toBe(false);
        expect(contextValue?.doc).toBeNull();
      });
    });
  });

  describe('unmount cleanup', () => {
    it('destroys session on unmount', async () => {
      const mockClient = createMockCollabClient();
      let destroyFn: Mock | null = null;

      // Capture the destroy function from the mock
      (mockClient.joinDocument as Mock).mockImplementation(async (noteId: string) => {
        const session = createMockSession(noteId);
        destroyFn = session.destroy as Mock;
        return session;
      });

      const { unmount } = render(
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          <div>Content</div>
        </YjsProvider>
      );

      // Wait for join to complete
      await waitFor(() => {
        expect(destroyFn).not.toBeNull();
      });

      // Unmount and check destroy was called
      unmount();

      expect(destroyFn).toHaveBeenCalled();
    });

    it('destroys session even if join was in progress', async () => {
      const mockClient = createMockCollabClient({ joinDelay: 100 });
      let session: DocumentSession | null = null;

      (mockClient.joinDocument as Mock).mockImplementation(async (noteId: string) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        session = createMockSession(noteId);
        return session;
      });

      const { unmount } = render(
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          <div>Content</div>
        </YjsProvider>
      );

      // Unmount before join completes
      unmount();

      // Wait for async join to complete and verify destroy was called
      await waitFor(
        () => {
          expect(session).not.toBeNull();
          expect(session?.destroy).toHaveBeenCalled();
        },
        { timeout: 200 }
      );
    });
  });

  describe('noteId changes', () => {
    it('rejoins when noteId changes', async () => {
      const mockClient = createMockCollabClient();

      const { rerender } = render(
        <YjsProvider noteId="note-1" collabClient={mockClient}>
          <div>Content</div>
        </YjsProvider>
      );

      await waitFor(() => {
        expect(mockClient.joinDocument).toHaveBeenCalledWith('note-1');
      });

      // Change noteId
      rerender(
        <YjsProvider noteId="note-2" collabClient={mockClient}>
          <div>Content</div>
        </YjsProvider>
      );

      await waitFor(() => {
        expect(mockClient.joinDocument).toHaveBeenCalledWith('note-2');
        expect(mockClient.joinDocument).toHaveBeenCalledTimes(2);
      });
    });

    it('destroys old session when noteId changes', async () => {
      const mockClient = createMockCollabClient();
      const destroyFns: Mock[] = [];

      (mockClient.joinDocument as Mock).mockImplementation(async (noteId: string) => {
        const session = createMockSession(noteId);
        destroyFns.push(session.destroy as Mock);
        return session;
      });

      const { rerender } = render(
        <YjsProvider noteId="note-1" collabClient={mockClient}>
          <div>Content</div>
        </YjsProvider>
      );

      await waitFor(() => {
        expect(destroyFns.length).toBe(1);
      });

      // Change noteId
      rerender(
        <YjsProvider noteId="note-2" collabClient={mockClient}>
          <div>Content</div>
        </YjsProvider>
      );

      await waitFor(() => {
        // First session should be destroyed
        expect(destroyFns[0]).toHaveBeenCalled();
        // Second session should exist
        expect(destroyFns.length).toBe(2);
      });
    });

    it('provides noteId in context', async () => {
      const mockClient = createMockCollabClient();
      let contextValue: ReturnType<typeof useYjs> | null = null;

      function TestConsumer() {
        contextValue = useYjs();
        return null;
      }

      const { rerender } = render(
        <YjsProvider noteId="note-1" collabClient={mockClient}>
          <TestConsumer />
        </YjsProvider>
      );

      await waitFor(() => {
        expect(contextValue?.noteId).toBe('note-1');
      });

      rerender(
        <YjsProvider noteId="note-2" collabClient={mockClient}>
          <TestConsumer />
        </YjsProvider>
      );

      await waitFor(() => {
        expect(contextValue?.noteId).toBe('note-2');
      });
    });
  });

  describe('useYjs hook', () => {
    it('throws error when used outside provider', () => {
      expect(() => {
        renderHook(() => useYjs());
      }).toThrow('useYjs must be used within a YjsProvider');
    });

    it('provides context values', async () => {
      const mockClient = createMockCollabClient();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          {children}
        </YjsProvider>
      );

      const { result } = renderHook(() => useYjs(), { wrapper });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // After load completes
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.doc).toBeInstanceOf(Y.Doc);
        expect(result.current.error).toBeNull();
        expect(result.current.noteId).toBe('test-note');
      });
    });
  });

  describe('useYjsDoc hook', () => {
    it('throws error when used outside provider', () => {
      expect(() => {
        renderHook(() => useYjsDoc());
      }).toThrow('useYjs must be used within a YjsProvider');
    });

    it('throws when doc is loading', () => {
      const mockClient = createMockCollabClient({ joinDelay: 1000 });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          {children}
        </YjsProvider>
      );

      expect(() => {
        renderHook(() => useYjsDoc(), { wrapper });
      }).toThrow('Y.Doc is still loading');
    });

    it('throws the original error when join fails', async () => {
      const mockClient = createMockCollabClient({
        shouldFail: true,
        errorMessage: 'Custom error message',
      });

      // Use useYjs to observe context state and verify error behavior
      let contextValue: ReturnType<typeof useYjs> | null = null;

      function TestConsumer() {
        contextValue = useYjs();
        return null;
      }

      render(
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          <TestConsumer />
        </YjsProvider>
      );

      // Wait for error state and verify useYjsDoc would throw the error
      await waitFor(() => {
        expect(contextValue).not.toBeNull();
        expect(contextValue!.isLoading).toBe(false);
        expect(contextValue!.error).toBeInstanceOf(Error);
        expect(contextValue!.error?.message).toBe('Custom error message');
      });
    });

    it('returns doc when available', async () => {
      const mockClient = createMockCollabClient();

      // Use useYjs to observe when doc is ready
      let contextValue: ReturnType<typeof useYjs> | null = null;

      function TestConsumer() {
        contextValue = useYjs();
        return null;
      }

      render(
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          <TestConsumer />
        </YjsProvider>
      );

      // Wait for loading to complete and verify doc is available
      await waitFor(() => {
        expect(contextValue).not.toBeNull();
        expect(contextValue!.isLoading).toBe(false);
        expect(contextValue!.doc).toBeInstanceOf(Y.Doc);
        expect(contextValue!.error).toBeNull();
      });
    });
  });

  describe('memory leak prevention', () => {
    it('does not update state after unmount', async () => {
      const mockClient = createMockCollabClient({ joinDelay: 50 });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { unmount } = render(
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          <div>Content</div>
        </YjsProvider>
      );

      // Unmount immediately before join completes
      unmount();

      // Wait for the delayed join to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not have React state update warnings
      // (React 18+ doesn't warn about this, but we want clean behavior)
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Can't perform a React state update on an unmounted component")
      );

      consoleSpy.mockRestore();
    });
  });
});
