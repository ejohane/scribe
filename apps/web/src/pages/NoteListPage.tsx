/**
 * NoteListPage
 *
 * Extremely minimal notes interface - just a page and a cursor to type.
 * Notes list is accessible via hamburger menu.
 */

import { useEffect, useState, useRef, type FC } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScribe, useScribeClient } from '../providers/ScribeProvider';
import type { NoteMetadata } from '@scribe/client-sdk';
import { Menu, FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

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
 * Inner component that renders the minimal note interface.
 */
const NoteListContent: FC = () => {
  const client = useScribeClient();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const result = await client.api.notes.list.query({
        orderBy: 'updated_at',
        orderDir: 'desc',
      });
      setNotes(result);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [client]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleCreateNote = async () => {
    if (!inputValue.trim()) return;

    try {
      const title = inputValue.trim().split('\n')[0].slice(0, 50) || 'Untitled';
      const note = await client.api.notes.create.mutate({
        title,
        type: 'note',
      });
      setInputValue('');
      navigate(`/note/${note.id}`);
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter to create note
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCreateNote();
    }
  };

  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await client.api.notes.delete.mutate(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#1c1c1e] flex flex-col" data-testid="note-list-page">
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
              onClick={() => {
                setSheetOpen(false);
                inputRef.current?.focus();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-[#34c759] hover:bg-[#2c2c2e] transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm">New Note</span>
            </button>

            {/* Notes List */}
            <div className="py-2">
              {loading ? (
                <p className="px-4 py-3 text-[#6e6e73] text-sm">Loading...</p>
              ) : notes.length === 0 ? (
                <p className="px-4 py-3 text-[#6e6e73] text-sm">No notes yet</p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="group flex items-center hover:bg-[#2c2c2e] transition-colors"
                  >
                    <Link
                      to={`/note/${note.id}`}
                      onClick={() => setSheetOpen(false)}
                      className="flex-1 flex items-center gap-3 px-4 py-3"
                    >
                      <FileText className="h-4 w-4 text-[#6e6e73] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[#f5f5f7] text-sm truncate">{note.title}</p>
                        <p className="text-[#6e6e73] text-xs">{formatDate(note.updatedAt)}</p>
                      </div>
                    </Link>
                    <button
                      onClick={(e) => handleDeleteNote(note.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-2 mr-2 text-[#6e6e73] hover:text-red-500 transition-all"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content - Minimal Writing Area */}
      <main className="flex-1 flex items-start justify-center pt-20 pb-8 px-4 md:px-8">
        <div className="w-full max-w-[812px]">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Start typing..."
            className={cn(
              'w-full min-h-[calc(100vh-120px)] bg-transparent border-none outline-none resize-none',
              'text-[#f5f5f7] text-lg leading-relaxed',
              'placeholder:text-[#6e6e73]',
              'caret-[#34c759]'
            )}
            data-testid="create-note-input"
          />
        </div>
      </main>

      {/* Subtle hint at bottom */}
      {inputValue.trim() && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-[#6e6e73] text-xs">
          <kbd className="px-1.5 py-0.5 bg-[#2c2c2e] rounded text-[10px]">⌘</kbd>
          <span className="mx-1">+</span>
          <kbd className="px-1.5 py-0.5 bg-[#2c2c2e] rounded text-[10px]">Enter</kbd>
          <span className="ml-2">to save</span>
        </div>
      )}
    </div>
  );
};

/**
 * Notes page component - minimal interface.
 */
export const NoteListPage: FC = () => {
  const { status, error, isConnected } = useScribe();

  if (status === 'connecting') {
    return (
      <div
        className="min-h-screen bg-[#1c1c1e] flex items-center justify-center"
        data-testid="note-list-page"
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
        data-testid="note-list-page"
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
        data-testid="note-list-page"
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

  return <NoteListContent />;
};
