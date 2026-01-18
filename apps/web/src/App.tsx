/**
 * App component
 *
 * Root application component for Scribe Web client.
 * Minimal design: full-screen editor with push-out notes sidebar.
 */

import { useState, useEffect, type FC } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import {
  ScribeProvider,
  PlatformProvider,
  NoteListPage,
  NoteEditorPage,
  useTrpc,
} from '@scribe/web-core';
import { ScribeEditor, type EditorContent as ScribeEditorContent } from '@scribe/editor';
import type { EditorContent } from '@scribe/client-sdk';
import { Button } from './components/ui/button';
import { Menu } from 'lucide-react';
import { PluginProvider, PluginClientInitializer } from './plugins';
import { DAEMON_PORT, DAEMON_HOST } from './config';

const DAEMON_URL = `http://${DAEMON_HOST}:${DAEMON_PORT}`;

/**
 * Render function for the editor component.
 * Minimal mode - no toolbar, just the text and cursor.
 */
function renderEditor(content: EditorContent, onChange: (content: EditorContent) => void) {
  return (
    <ScribeEditor
      initialContent={content as ScribeEditorContent}
      onChange={onChange as (content: ScribeEditorContent) => void}
      autoFocus
      showToolbar={false}
      placeholder=""
    />
  );
}

/**
 * Main editor layout with push-style sidebar.
 * Sidebar pushes content and appears visually behind the note canvas.
 */
function EditorLayout() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNoteSelect = (noteId: string) => {
    navigate(`/note/${noteId}`);
  };

  const menuButton = () => (
    <Button
      variant="ghost"
      size="icon"
      className="bg-background/90 backdrop-blur-sm text-foreground/60 hover:text-foreground hover:bg-background border border-border/30 shadow-sm"
      onClick={() => setSidebarOpen(!sidebarOpen)}
    >
      <Menu className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="editor-layout" data-sidebar-open={sidebarOpen}>
      {/* Sidebar - pushes content, appears behind canvas */}
      <aside className="editor-sidebar">
        <NoteListPage onNoteSelect={handleNoteSelect} selectedNoteId={id} />
      </aside>

      {/* Main canvas - elevated above sidebar */}
      <div className="editor-canvas">
        <NoteEditorPage renderEditor={renderEditor} renderMenuButton={menuButton} />
      </div>
    </div>
  );
}

/**
 * Home page - redirects to most recent note or creates one.
 */
function HomePage() {
  const navigate = useNavigate();
  const trpc = useTrpc();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrCreate() {
      try {
        const notes = await trpc.notes.list.query({
          limit: 1,
          orderBy: 'updated_at',
          orderDir: 'desc',
        });

        if (notes.length > 0) {
          navigate(`/note/${notes[0].id}`, { replace: true });
        } else {
          // Create first note
          const newNote = await trpc.notes.create.mutate({
            title: 'Untitled',
            type: 'note',
          });
          navigate(`/note/${newNote.id}`, { replace: true });
        }
      } catch (err) {
        console.error('Failed to load notes:', err);
        setLoading(false);
      }
    }

    loadOrCreate();
  }, [navigate, trpc]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-foreground/20 text-sm">Loading...</div>
      </div>
    );
  }

  return null;
}

/**
 * Main App component.
 */
export const App: FC = () => {
  return (
    <BrowserRouter>
      <PlatformProvider platform="web" capabilities={{}}>
        <ScribeProvider daemonUrl={DAEMON_URL}>
          <PluginClientInitializer>
            <PluginProvider>
              <div className="h-screen w-screen bg-background">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/note/:id" element={<EditorLayout />} />
                </Routes>
              </div>
            </PluginProvider>
          </PluginClientInitializer>
        </ScribeProvider>
      </PlatformProvider>
    </BrowserRouter>
  );
};
