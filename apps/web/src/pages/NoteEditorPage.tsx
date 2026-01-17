/**
 * NoteEditorPage
 *
 * Extremely minimal full-screen editor for a single note.
 * Just the page and a cursor to type.
 */

import { useEffect, useState, useCallback, useRef, type FC } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useScribe, useScribeClient } from '../providers/ScribeProvider';
import { ScribeEditor, type EditorContent } from '@scribe/editor';
import { YjsProvider, useYjs, LexicalYjsPlugin } from '@scribe/collab';
import type { NoteDocument, NoteMetadata } from '@scribe/client-sdk';
import { Menu, FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import './NoteEditorPage.css';

/** Auto-save debounce delay in milliseconds */
const AUTO_SAVE_DELAY = 1000;

/**
 * Format a date for display in the sidebar.
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Format last saved time for display.
 */
function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Inner component for the editor that has access to Yjs context.
 */
interface EditorWithYjsProps {
  initialContent: EditorContent;
  onChange: (content: EditorContent) => void;
}

const EditorWithYjs: FC<EditorWithYjsProps> = ({ initialContent, onChange }) => {
  const { doc, isLoading, error } = useYjs();

  if (isLoading) {
    return (
      <div className="text-[#6e6e73] text-sm" data-testid="collab-loading">
        Syncing...
      </div>
    );
  }

  if (error) {
    console.warn('Collaboration unavailable:', error);
  }

  return (
    <ScribeEditor
      initialContent={initialContent}
      onChange={onChange}
      yjsDoc={doc ?? undefined}
      YjsPlugin={doc ? LexicalYjsPlugin : undefined}
      autoFocus
    />
  );
};

/**
 * Inner component that renders the note editor content.
 */
interface NoteEditorContentProps {
  id: string;
}

const NoteEditorContent: FC<NoteEditorContentProps> = ({ id }) => {
  const client = useScribeClient();
  const navigate = useNavigate();
  const [note, setNote] = useState<NoteDocument | null>(null);
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingContentRef = useRef<EditorContent | null>(null);

  // Load note and notes list
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [noteResult, notesResult] = await Promise.all([
          client.api.notes.get.query(id),
          client.api.notes.list.query({ orderBy: 'updated_at', orderDir: 'desc' }),
        ]);

        if (!cancelled) {
          if (!noteResult) {
            setError(new Error('Note not found'));
          } else {
            setNote(noteResult);
            setNotes(notesResult);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [client, id]);

  const saveNote = useCallback(
    async (content: EditorContent) => {
      if (!note) return;

      try {
        setSaving(true);
        await client.api.notes.update.mutate({ id, content });
        setLastSaved(new Date());
      } catch (err) {
        console.error('Save failed:', err);
      } finally {
        setSaving(false);
      }
    },
    [client, id, note]
  );

  const handleChange = useCallback(
    (content: EditorContent) => {
      pendingContentRef.current = content;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        if (pendingContentRef.current) {
          saveNote(pendingContentRef.current);
        }
      }, AUTO_SAVE_DELAY);
    },
    [saveNote]
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        if (pendingContentRef.current) {
          saveNote(pendingContentRef.current);
        }
      }
    };
  }, [saveNote]);

  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await client.api.notes.delete.mutate(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (noteId === id) {
        navigate('/');
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleCreateNote = async () => {
    try {
      const newNote = await client.api.notes.create.mutate({
        title: 'Untitled',
        type: 'note',
      });
      setSheetOpen(false);
      navigate(`/note/${newNote.id}`);
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen bg-[#1c1c1e] flex items-center justify-center"
        data-testid="note-editor-page"
      >
        <div className="text-[#6e6e73] text-sm" data-testid="loading-state">
          Loading...
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div
        className="min-h-screen bg-[#1c1c1e] flex flex-col items-center justify-center gap-4"
        data-testid="note-editor-page"
      >
        <p className="text-red-400 text-sm" data-testid="error-state">
          {error?.message ?? 'Note not found'}
        </p>
        <Link to="/" className="text-[#34c759] text-sm hover:underline">
          Back to notes
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1c1c1e] flex flex-col" data-testid="note-editor-page">
      {/* Hamburger Menu */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-4 left-4 z-50 text-[#a1a1a6] hover:text-[#f5f5f7] hover:bg-[#2c2c2e]"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[280px] sm:w-[320px] bg-[#1c1c1e] border-[#2c2c2e] p-0"
        >
          <SheetHeader className="p-4 border-b border-[#2c2c2e]">
            <SheetTitle className="text-[#f5f5f7] text-sm font-medium">Notes</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {/* New Note Button */}
            <button
              onClick={handleCreateNote}
              className="w-full flex items-center gap-3 px-4 py-3 text-[#34c759] hover:bg-[#2c2c2e] transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm">New Note</span>
            </button>

            {/* Notes List */}
            <div className="py-2">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'group flex items-center hover:bg-[#2c2c2e] transition-colors',
                    n.id === id && 'bg-[#2c2c2e]'
                  )}
                >
                  <Link
                    to={`/note/${n.id}`}
                    onClick={() => setSheetOpen(false)}
                    className="flex-1 flex items-center gap-3 px-4 py-3"
                  >
                    <FileText className="h-4 w-4 text-[#6e6e73] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[#f5f5f7] text-sm truncate">{n.title}</p>
                      <p className="text-[#6e6e73] text-xs">{formatDate(n.updatedAt)}</p>
                    </div>
                  </Link>
                  <button
                    onClick={(e) => handleDeleteNote(n.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-2 mr-2 text-[#6e6e73] hover:text-red-500 transition-all"
                    aria-label="Delete note"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content - Minimal Editor */}
      <main className="flex-1 flex items-start justify-center pt-20 pb-8 px-4 md:px-8">
        <div className="w-full max-w-[812px] editor-wrapper">
          <YjsProvider noteId={id} collabClient={client.collab}>
            <EditorWithYjs initialContent={note.content as EditorContent} onChange={handleChange} />
          </YjsProvider>
        </div>
      </main>

      {/* Save status indicator */}
      <div className="fixed bottom-4 right-4 text-[#6e6e73] text-xs" data-testid="save-status">
        {saving ? 'Saving...' : lastSaved ? `Saved ${formatSavedTime(lastSaved)}` : ''}
      </div>
    </div>
  );
};

/**
 * Note editor page component.
 */
export const NoteEditorPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { status, error, isConnected } = useScribe();

  if (status === 'connecting') {
    return (
      <div
        className="min-h-screen bg-[#1c1c1e] flex items-center justify-center"
        data-testid="note-editor-page"
      >
        <div className="text-[#6e6e73] text-sm" data-testid="connecting-state">
          Connecting...
        </div>
      </div>
    );
  }

  if (error || status === 'error') {
    return (
      <div
        className="min-h-screen bg-[#1c1c1e] flex flex-col items-center justify-center gap-4"
        data-testid="note-editor-page"
      >
        <p className="text-red-400 text-sm" data-testid="connection-error-state">
          {error?.message ?? 'Connection error'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="text-[#f5f5f7] border-[#3a3a3c]"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div
        className="min-h-screen bg-[#1c1c1e] flex flex-col items-center justify-center gap-4"
        data-testid="note-editor-page"
      >
        <p className="text-[#6e6e73] text-sm" data-testid="disconnected-state">
          Disconnected
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="text-[#f5f5f7] border-[#3a3a3c]"
        >
          Reconnect
        </Button>
      </div>
    );
  }

  if (!id) {
    return (
      <div
        className="min-h-screen bg-[#1c1c1e] flex flex-col items-center justify-center gap-4"
        data-testid="note-editor-page"
      >
        <p className="text-[#6e6e73] text-sm" data-testid="error-state">
          No note ID provided
        </p>
        <Link to="/" className="text-[#34c759] text-sm hover:underline">
          Back to notes
        </Link>
      </div>
    );
  }

  return <NoteEditorContent id={id} />;
};
