/**
 * App component
 *
 * Root application component for Scribe Web client.
 * Minimal design: full-screen editor with push-out notes sidebar.
 */

import { useEffect, useMemo, useCallback, useRef, type FC, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import {
  ScribeProvider,
  PlatformProvider,
  CollabProvider,
  NoteListPage,
  NoteEditorPage,
  CommandPaletteProvider,
  CommandPalette,
  EditorShell,
  type CollabEditorProps,
} from '@scribe/web-core';
import {
  ScribeEditor,
  type EditorContent as ScribeEditorContent,
  type EditorExtensions,
  type EditorExtensionNodeEntry,
  type EditorExtensionPluginEntry,
  type EditorExtensionGuard,
} from '@scribe/editor';
import type { EditorContent, NoteDocument } from '@scribe/client-sdk';
import { computeTextHash } from '@scribe/shared';
import { Button } from './components/ui/button';
import { Menu, Settings } from 'lucide-react';
import {
  PluginProvider,
  PluginClientInitializer,
  useCommandPaletteCommands,
  useEditorExtensions,
  usePluginSettings,
  getInstalledPlugins,
} from './plugins';
import type { CommandItem } from '@scribe/web-core';
import { DAEMON_PORT, DAEMON_HOST } from './config';
import { SlashMenuPlugin } from './components/Editor/SlashMenuPlugin';

const DAEMON_URL = `http://${DAEMON_HOST}:${DAEMON_PORT}`;

/**
 * Main editor layout with push-style sidebar.
 * Sidebar pushes content and appears visually behind the note canvas.
 */
function EditorLayout() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { extensions, isLoading: extensionsLoading } = useEditorExtensions();
  const { enabledPluginIds } = usePluginSettings();
  const slashMenuNoteIdRef = useRef<string | undefined>(undefined);
  const SlashMenuExtension = useCallback(
    () => <SlashMenuPlugin noteId={slashMenuNoteIdRef.current} />,
    []
  );
  const enabledPluginsKey = useMemo(
    () => computeTextHash([...enabledPluginIds].sort().join('|')),
    [enabledPluginIds]
  );

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

      slashMenuNoteIdRef.current = note?.id;

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
      const slashMenuPluginEntry: EditorExtensionPluginEntry = {
        id: 'core:slash-menu',
        plugin: SlashMenuExtension,
      };
      const combinedExtensions: EditorExtensions = {
        nodes: filteredExtensions?.nodes,
        plugins: [...(filteredExtensions?.plugins ?? []), slashMenuPluginEntry],
        guards: filteredExtensions?.guards,
      };
      const hasExtensions =
        (combinedExtensions.nodes?.length ?? 0) > 0 ||
        (combinedExtensions.plugins?.length ?? 0) > 0 ||
        (combinedExtensions.guards?.length ?? 0) > 0;

      return (
        <ScribeEditor
          key={`editor-${enabledPluginsKey}`}
          initialContent={content as ScribeEditorContent}
          onChange={onChange as (content: ScribeEditorContent) => void}
          autoFocus
          showToolbar={false}
          placeholder=""
          yjsDoc={collabProps?.yjsDoc}
          YjsPlugin={collabProps?.YjsPlugin}
          editorExtensions={hasExtensions ? combinedExtensions : undefined}
        />
      );
    },
    [editorExtensions, enabledPluginsKey, extensionsLoading]
  );

  const handleNoteSelect = (noteId: string) => {
    navigate(`/note/${noteId}`);
  };

  const handleSettingsOpen = () => {
    navigate('/settings');
  };

  const menuButton = ({ toggle }: { isOpen: boolean; toggle: () => void }) => (
    <Button
      variant="ghost"
      size="icon"
      className="bg-background/90 backdrop-blur-sm text-foreground/60 hover:text-foreground hover:bg-background border border-border/30 shadow-sm"
      onClick={toggle}
    >
      <Menu className="h-4 w-4" />
    </Button>
  );

  const settingsButton = ({ onOpen }: { onOpen: () => void }) => (
    <Button
      variant="ghost"
      size="icon-sm"
      className="absolute bottom-3 left-3 text-foreground/60 hover:text-foreground"
      onClick={onOpen}
      title="Settings"
      aria-label="Settings"
    >
      <Settings className="h-4 w-4" />
    </Button>
  );

  return (
    <EditorShell
      noteId={id ?? null}
      onNoteSelect={handleNoteSelect}
      onSettingsOpen={handleSettingsOpen}
      renderMenuButton={menuButton}
      renderSettingsButton={settingsButton}
    >
      <NoteEditorPage renderEditor={renderEditor} />
    </EditorShell>
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
 * Settings page shell.
 */
export function SettingsPage() {
  const { isPluginEnabled, setPluginEnabled } = usePluginSettings();
  const pluginManifests = useMemo(() => {
    const modules = getInstalledPlugins();

    return modules
      .map((module, index) => ({ manifest: module.manifest, index }))
      .sort((left, right) => {
        const leftName = left.manifest.name ?? left.manifest.id;
        const rightName = right.manifest.name ?? right.manifest.id;
        const nameOrder = leftName.localeCompare(rightName);

        if (nameOrder !== 0) {
          return nameOrder;
        }

        return left.index - right.index;
      })
      .map(({ manifest }) => manifest);
  }, []);

  return (
    <div className="h-full w-full bg-background">
      <div className="mx-auto flex h-full w-full max-w-[720px] flex-col px-6 py-8">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-2 text-sm text-foreground/60">Manage plugins and preferences.</p>

        <section className="mt-8">
          <div className="overflow-hidden rounded-lg border border-border/30 bg-background shadow-lg">
            <div className="border-b border-border/30 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Plugins</h2>
              <p className="mt-1 text-xs text-foreground/60">
                Enable or disable installed plugins.
              </p>
            </div>

            {pluginManifests.length === 0 ? (
              <div
                className="px-4 py-6 text-sm text-foreground/60"
                data-testid="plugins-empty-state"
              >
                No plugins installed.
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {pluginManifests.map((manifest) => {
                  const enabled = isPluginEnabled(manifest.id);
                  const displayName = manifest.name ?? manifest.id;
                  const mutedTextClass = enabled ? 'text-foreground/60' : 'text-foreground/40';
                  const metaTextClass = enabled ? 'text-foreground/50' : 'text-foreground/30';
                  const labelTextClass = enabled ? 'text-foreground/60' : 'text-foreground/40';

                  return (
                    <div
                      key={manifest.id}
                      className="flex items-start justify-between gap-6 px-4 py-4"
                      data-testid="plugin-row"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">{displayName}</div>
                        <p className={`mt-1 text-sm ${mutedTextClass}`}>
                          {manifest.description ?? 'No description provided.'}
                        </p>
                        <p className={`mt-1 text-xs font-mono ${metaTextClass}`}>
                          {manifest.id} v{manifest.version}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold ${labelTextClass}`}>Enabled</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          aria-label={`Toggle ${displayName}`}
                          onClick={() => setPluginEnabled(manifest.id, !enabled)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full border border-border/40 transition-colors ${
                            enabled ? 'bg-foreground' : 'bg-muted/60'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform ${
                              enabled ? 'translate-x-4' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
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
                      <Route path="/settings" element={<SettingsPage />} />
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
