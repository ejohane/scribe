/**
 * App.tsx
 *
 * Root component for the Scribe desktop app.
 * Uses HashRouter for Electron compatibility with file:// protocol.
 * Uses app-shell providers for platform-agnostic functionality.
 */

import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import {
  ScribeProvider,
  PlatformProvider,
  CollabProvider,
  NoteListPage,
  NoteEditorPage,
  CommandPaletteProvider,
  CommandPalette,
  type CommandItem,
} from '@scribe/web-core';
import type { PlatformCapabilities, UpdateInfo, CollabEditorProps } from '@scribe/web-core';
import type { EditorContent, NoteDocument } from '@scribe/client-sdk';
import {
  ScribeEditor,
  type EditorContent as ScribeEditorContent,
  type EditorExtensions,
  type EditorExtensionNodeEntry,
  type EditorExtensionPluginEntry,
  type EditorExtensionGuard,
} from '@scribe/editor';
import {
  PluginProvider,
  PluginClientInitializer,
  useCommandPaletteCommands,
  useEditorExtensions,
} from './plugins';

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
 * Notes page - displays all notes.
 */
function NotesPage() {
  return (
    <div className="h-screen w-screen bg-background">
      <NoteListPage />
    </div>
  );
}

/**
 * Wrapper component that integrates plugin commands with the CommandPalette.
 */
function CommandPaletteWithPlugins({ children }: { children: ReactNode }) {
  const { commands: pluginCommands, isLoading } = useCommandPaletteCommands();

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
 * Main router component that wires plugins into the editor.
 */
function AppRoutes() {
  const { extensions, isLoading: extensionsLoading } = useEditorExtensions();

  const editorExtensions = useMemo<EditorExtensions | undefined>(() => {
    if (extensions.length === 0) {
      return undefined;
    }

    const nodes: EditorExtensionNodeEntry[] = [];
    const plugins: EditorExtensionPluginEntry[] = [];
    const guards: EditorExtensionGuard[] = [];

    extensions.forEach((extension) => {
      extension.nodes.forEach((nodeEntry) => {
        if (!nodeEntry.node) {
          return;
        }

        nodes.push({
          id: `${extension.pluginId}:${nodeEntry.id}`,
          node: nodeEntry.node as EditorExtensionNodeEntry['node'],
        });
      });

      extension.plugins.forEach((pluginEntry) => {
        if (!pluginEntry.plugin) {
          return;
        }

        plugins.push({
          id: `${extension.pluginId}:${pluginEntry.id}`,
          plugin: pluginEntry.plugin as EditorExtensionPluginEntry['plugin'],
        });
      });

      if (extension.guards?.length) {
        guards.push(...(extension.guards as EditorExtensionGuard[]));
      }
    });

    if (nodes.length === 0 && plugins.length === 0 && guards.length === 0) {
      return undefined;
    }

    return { nodes, plugins, guards };
  }, [extensions]);

  const renderEditor = useCallback(
    (
      content: EditorContent,
      onChange: (content: EditorContent) => void,
      collabProps?: CollabEditorProps,
      note?: NoteDocument
    ) => {
      if (extensionsLoading) {
        return <div className="editor-loading">Loading editor extensions...</div>;
      }

      const dailyNotePrefix = '@scribe/plugin-daily-note:';
      const shouldShowDailyHeader = note?.type === 'daily';
      const filteredExtensions = editorExtensions
        ? {
            ...editorExtensions,
            nodes: shouldShowDailyHeader
              ? editorExtensions.nodes
              : editorExtensions.nodes?.filter((entry) => !entry.id.startsWith(dailyNotePrefix)),
            plugins: shouldShowDailyHeader
              ? editorExtensions.plugins
              : editorExtensions.plugins?.filter((entry) => !entry.id.startsWith(dailyNotePrefix)),
          }
        : undefined;
      const hasExtensions =
        !!filteredExtensions &&
        ((filteredExtensions.nodes?.length ?? 0) > 0 ||
          (filteredExtensions.plugins?.length ?? 0) > 0 ||
          (filteredExtensions.guards?.length ?? 0) > 0);

      return (
        <ScribeEditor
          initialContent={content as ScribeEditorContent}
          onChange={onChange as (content: ScribeEditorContent) => void}
          autoFocus
          showToolbar={false}
          placeholder=""
          yjsDoc={collabProps?.yjsDoc}
          YjsPlugin={collabProps?.YjsPlugin}
          editorExtensions={hasExtensions ? filteredExtensions : undefined}
        />
      );
    },
    [editorExtensions, extensionsLoading]
  );

  return (
    <CommandPaletteWithPlugins>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/note/:id" element={<NoteEditorPage renderEditor={renderEditor} />} />
      </Routes>
    </CommandPaletteWithPlugins>
  );
}

/**
 * Root application component.
 *
 * Handles async daemon port resolution and sets up providers.
 *
 * Route structure:
 * - / -> Redirects to /notes
 * - /notes -> Note list
 * - /note/:id -> Note editor
 */
export function App() {
  const [daemonPort, setDaemonPort] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const port = await window.scribe.scribe.getDaemonPort();
        if (mounted) {
          setDaemonPort(port);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to get daemon port'));
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Show loading while getting daemon port
  if (!daemonPort && !error) {
    return <div style={{ padding: '2rem', color: '#666' }}>Loading...</div>;
  }

  // Show error if daemon port resolution failed
  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        <h2>Connection Error</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  const daemonUrl = `http://localhost:${daemonPort}`;

  // Platform capabilities for Electron
  const capabilities: PlatformCapabilities = {
    window: {
      openNewWindow: () => window.scribe.window.new(),
      openNoteInWindow: (id) => window.scribe.window.openNote(id),
      close: () => window.scribe.window.close(),
    },
    dialog: {
      selectFolder: () => window.scribe.dialog.selectFolder(),
      saveFile: async (_content, _filename) => {
        // TODO: Implement file save dialog
        return false;
      },
    },
    shell: {
      openExternal: (url) => window.scribe.shell.openExternal(url),
    },
    update: {
      check: () => window.scribe.update.check(),
      install: () => window.scribe.update.install(),
      onAvailable: (cb: (info: UpdateInfo) => void) => {
        return window.scribe.update.onAvailable((info) => {
          cb({ version: info.version });
        });
      },
    },
  };

  return (
    <HashRouter>
      <PlatformProvider platform="electron" capabilities={capabilities}>
        <ScribeProvider daemonUrl={daemonUrl}>
          <CollabProvider daemonUrl={daemonUrl}>
            <PluginClientInitializer>
              <PluginProvider>
                <AppRoutes />
              </PluginProvider>
            </PluginClientInitializer>
          </CollabProvider>
        </ScribeProvider>
      </PlatformProvider>
    </HashRouter>
  );
}

export default App;
