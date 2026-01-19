/**
 * App component
 *
 * Root application component for Scribe Web client.
 * Minimal design: full-screen editor with push-out notes sidebar.
 */

import { useState, useEffect, useMemo, type FC, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import {
  ScribeProvider,
  PlatformProvider,
  CollabProvider,
  NoteListPage,
  NoteEditorPage,
  CommandPaletteProvider,
  CommandPalette,
  type CollabEditorProps,
} from '@scribe/web-core';
import { ScribeEditor, type EditorContent as ScribeEditorContent } from '@scribe/editor';
import type { EditorContent } from '@scribe/client-sdk';
import { Button } from './components/ui/button';
import { Menu } from 'lucide-react';
import { PluginProvider, PluginClientInitializer, useCommandPaletteCommands } from './plugins';
import type { CommandItem } from '@scribe/web-core';
import { DAEMON_PORT, DAEMON_HOST } from './config';

const DAEMON_URL = `http://${DAEMON_HOST}:${DAEMON_PORT}`;

/**
 * Render function for the editor component.
 * Minimal mode - no toolbar, just the text and cursor.
 * Supports collaborative editing when collabProps are provided.
 */
function renderEditor(
  content: EditorContent,
  onChange: (content: EditorContent) => void,
  collabProps?: CollabEditorProps
) {
  return (
    <ScribeEditor
      initialContent={content as ScribeEditorContent}
      onChange={onChange as (content: ScribeEditorContent) => void}
      autoFocus
      showToolbar={false}
      placeholder=""
      yjsDoc={collabProps?.yjsDoc}
      YjsPlugin={collabProps?.YjsPlugin}
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
 * Home page - redirects to notes list.
 */
function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/notes', { replace: true });
  }, [navigate]);

  return null;
}

/**
 * Notes page - displays all notes in a centered layout.
 */
function NotesPage() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md h-full max-h-[600px] border border-border/30 rounded-lg shadow-lg bg-background overflow-hidden">
        <NoteListPage />
      </div>
    </div>
  );
}

/**
 * Wrapper component that integrates plugin commands with the CommandPalette.
 *
 * This component:
 * 1. Fetches command palette commands from loaded plugins
 * 2. Converts them to the format expected by CommandPaletteProvider
 * 3. Passes them as pluginCommands prop
 */
function CommandPaletteWithPlugins({ children }: { children: ReactNode }) {
  const { commands: pluginCommands, isLoading } = useCommandPaletteCommands();

  // Convert plugin commands to CommandItem format
  const convertedCommands = useMemo<CommandItem[]>(() => {
    if (isLoading) return [];

    return pluginCommands
      .filter((cmd) => cmd.handler !== undefined)
      .map((cmd) => ({
        type: 'command' as const,
        id: cmd.id,
        label: cmd.label,
        description: cmd.description,
        icon: cmd.icon,
        shortcut: cmd.shortcut,
        category: cmd.category,
        priority: cmd.priority,
        handler: cmd.handler!,
      }));
  }, [pluginCommands, isLoading]);

  return (
    <CommandPaletteProvider pluginCommands={convertedCommands}>
      {children}
      <CommandPalette />
    </CommandPaletteProvider>
  );
}

/**
 * Main App component.
 */
export const App: FC = () => {
  return (
    <BrowserRouter>
      <PlatformProvider platform="web" capabilities={{}}>
        <ScribeProvider daemonUrl={DAEMON_URL}>
          <CollabProvider daemonUrl={DAEMON_URL}>
            <PluginClientInitializer>
              <PluginProvider>
                <CommandPaletteWithPlugins>
                  <div className="h-screen w-screen bg-background">
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/notes" element={<NotesPage />} />
                      <Route path="/note/:id" element={<EditorLayout />} />
                    </Routes>
                  </div>
                </CommandPaletteWithPlugins>
              </PluginProvider>
            </PluginClientInitializer>
          </CollabProvider>
        </ScribeProvider>
      </PlatformProvider>
    </BrowserRouter>
  );
};
