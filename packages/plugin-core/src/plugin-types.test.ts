/**
 * Tests for plugin type definitions and type guard utilities.
 *
 * These tests verify:
 * 1. Type guards correctly discriminate capability types
 * 2. Utility functions work as expected
 * 3. Type inference works correctly (compile-time verification)
 */

import { describe, it, expect } from 'vitest';
import {
  isTrpcRouterCapability,
  isStorageCapability,
  isEventHookCapability,
  isSidebarPanelCapability,
  isSlashCommandCapability,
  isCommandPaletteCommandCapability,
  isEditorExtensionCapability,
  hasCapability,
  getCapabilitiesByType,
  type PluginManifest,
  type PluginCapability,
  type TrpcRouterCapability,
  type StorageCapability,
  type EventHookCapability,
  type SidebarPanelCapability,
  type SlashCommandCapability,
  type CommandPaletteCommandCapability,
  type EditorExtensionCapability,
  type PluginEvent,
  type ServerPlugin,
  type ClientPlugin,
} from './plugin-types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const trpcCapability: TrpcRouterCapability = {
  type: 'trpc-router',
  namespace: 'example',
};

const storageCapability: StorageCapability = {
  type: 'storage',
  keys: ['snippets', 'settings'],
};

const eventHookCapability: EventHookCapability = {
  type: 'event-hook',
  events: ['note:created', 'note:updated'],
};

const sidebarPanelCapability: SidebarPanelCapability = {
  type: 'sidebar-panel',
  id: 'example-panel',
  label: 'Examples',
  icon: 'CheckSquare',
  priority: 10,
};

const slashCommandCapability: SlashCommandCapability = {
  type: 'slash-command',
  command: 'snippet',
  label: 'Insert Snippet',
  description: 'Insert an example snippet into the current note',
  icon: 'Plus',
};

const commandPaletteCommandCapability: CommandPaletteCommandCapability = {
  type: 'command-palette-command',
  id: 'example.createSnippet',
  label: 'Create Snippet',
  description: 'Create a new example snippet',
  icon: 'CheckSquare',
  shortcut: '⌘T',
  category: 'Examples',
  priority: 10,
};

const editorExtensionCapability: EditorExtensionCapability = {
  type: 'editor-extension',
  nodes: ['daily-note-header'],
  plugins: ['daily-note-header-plugin'],
};

const testManifest: PluginManifest = {
  id: '@scribe/plugin-example',
  version: '1.0.0',
  name: 'Example Plugin',
  description: 'Example capabilities for Scribe',
  author: 'Scribe Team',
  capabilities: [
    trpcCapability,
    storageCapability,
    eventHookCapability,
    sidebarPanelCapability,
    slashCommandCapability,
    commandPaletteCommandCapability,
    editorExtensionCapability,
  ],
  scribeVersion: '>=1.0.0',
};

const minimalManifest: PluginManifest = {
  id: '@scribe/plugin-minimal',
  version: '0.1.0',
  name: 'Minimal Plugin',
  capabilities: [],
};

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('Type Guards', () => {
  describe('isTrpcRouterCapability', () => {
    it('returns true for trpc-router capability', () => {
      expect(isTrpcRouterCapability(trpcCapability)).toBe(true);
    });

    it('returns false for other capability types', () => {
      expect(isTrpcRouterCapability(storageCapability)).toBe(false);
      expect(isTrpcRouterCapability(eventHookCapability)).toBe(false);
      expect(isTrpcRouterCapability(sidebarPanelCapability)).toBe(false);
      expect(isTrpcRouterCapability(slashCommandCapability)).toBe(false);
      expect(isTrpcRouterCapability(commandPaletteCommandCapability)).toBe(false);
      expect(isTrpcRouterCapability(editorExtensionCapability)).toBe(false);
    });
  });

  describe('isStorageCapability', () => {
    it('returns true for storage capability', () => {
      expect(isStorageCapability(storageCapability)).toBe(true);
    });

    it('returns false for other capability types', () => {
      expect(isStorageCapability(trpcCapability)).toBe(false);
      expect(isStorageCapability(eventHookCapability)).toBe(false);
      expect(isStorageCapability(sidebarPanelCapability)).toBe(false);
      expect(isStorageCapability(slashCommandCapability)).toBe(false);
    });
  });

  describe('isEventHookCapability', () => {
    it('returns true for event-hook capability', () => {
      expect(isEventHookCapability(eventHookCapability)).toBe(true);
    });

    it('returns false for other capability types', () => {
      expect(isEventHookCapability(trpcCapability)).toBe(false);
      expect(isEventHookCapability(storageCapability)).toBe(false);
      expect(isEventHookCapability(sidebarPanelCapability)).toBe(false);
      expect(isEventHookCapability(slashCommandCapability)).toBe(false);
    });
  });

  describe('isSidebarPanelCapability', () => {
    it('returns true for sidebar-panel capability', () => {
      expect(isSidebarPanelCapability(sidebarPanelCapability)).toBe(true);
    });

    it('returns false for other capability types', () => {
      expect(isSidebarPanelCapability(trpcCapability)).toBe(false);
      expect(isSidebarPanelCapability(storageCapability)).toBe(false);
      expect(isSidebarPanelCapability(eventHookCapability)).toBe(false);
      expect(isSidebarPanelCapability(slashCommandCapability)).toBe(false);
    });
  });

  describe('isSlashCommandCapability', () => {
    it('returns true for slash-command capability', () => {
      expect(isSlashCommandCapability(slashCommandCapability)).toBe(true);
    });

    it('returns false for other capability types', () => {
      expect(isSlashCommandCapability(trpcCapability)).toBe(false);
      expect(isSlashCommandCapability(storageCapability)).toBe(false);
      expect(isSlashCommandCapability(eventHookCapability)).toBe(false);
      expect(isSlashCommandCapability(sidebarPanelCapability)).toBe(false);
      expect(isSlashCommandCapability(commandPaletteCommandCapability)).toBe(false);
    });
  });

  describe('isCommandPaletteCommandCapability', () => {
    it('returns true for command-palette-command capability', () => {
      expect(isCommandPaletteCommandCapability(commandPaletteCommandCapability)).toBe(true);
    });

    it('returns false for other capability types', () => {
      expect(isCommandPaletteCommandCapability(trpcCapability)).toBe(false);
      expect(isCommandPaletteCommandCapability(storageCapability)).toBe(false);
      expect(isCommandPaletteCommandCapability(eventHookCapability)).toBe(false);
      expect(isCommandPaletteCommandCapability(sidebarPanelCapability)).toBe(false);
      expect(isCommandPaletteCommandCapability(slashCommandCapability)).toBe(false);
      expect(isCommandPaletteCommandCapability(editorExtensionCapability)).toBe(false);
    });
  });

  describe('isEditorExtensionCapability', () => {
    it('returns true for editor-extension capability', () => {
      expect(isEditorExtensionCapability(editorExtensionCapability)).toBe(true);
    });

    it('returns false for other capability types', () => {
      expect(isEditorExtensionCapability(trpcCapability)).toBe(false);
      expect(isEditorExtensionCapability(storageCapability)).toBe(false);
      expect(isEditorExtensionCapability(eventHookCapability)).toBe(false);
      expect(isEditorExtensionCapability(sidebarPanelCapability)).toBe(false);
      expect(isEditorExtensionCapability(slashCommandCapability)).toBe(false);
      expect(isEditorExtensionCapability(commandPaletteCommandCapability)).toBe(false);
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('hasCapability', () => {
  it('returns true when manifest has the capability type', () => {
    expect(hasCapability(testManifest, 'trpc-router')).toBe(true);
    expect(hasCapability(testManifest, 'storage')).toBe(true);
    expect(hasCapability(testManifest, 'event-hook')).toBe(true);
    expect(hasCapability(testManifest, 'sidebar-panel')).toBe(true);
    expect(hasCapability(testManifest, 'slash-command')).toBe(true);
    expect(hasCapability(testManifest, 'command-palette-command')).toBe(true);
    expect(hasCapability(testManifest, 'editor-extension')).toBe(true);
  });

  it('returns false when manifest does not have the capability type', () => {
    expect(hasCapability(minimalManifest, 'trpc-router')).toBe(false);
    expect(hasCapability(minimalManifest, 'storage')).toBe(false);
    expect(hasCapability(minimalManifest, 'event-hook')).toBe(false);
    expect(hasCapability(minimalManifest, 'sidebar-panel')).toBe(false);
    expect(hasCapability(minimalManifest, 'slash-command')).toBe(false);
    expect(hasCapability(minimalManifest, 'command-palette-command')).toBe(false);
    expect(hasCapability(minimalManifest, 'editor-extension')).toBe(false);
  });
});

describe('getCapabilitiesByType', () => {
  it('returns all capabilities of the specified type', () => {
    const trpcCaps = getCapabilitiesByType(testManifest, 'trpc-router');
    expect(trpcCaps).toHaveLength(1);
    expect(trpcCaps[0].namespace).toBe('examples');

    const storageCaps = getCapabilitiesByType(testManifest, 'storage');
    expect(storageCaps).toHaveLength(1);
    expect(storageCaps[0].keys).toEqual(['snippets', 'settings']);

    const sidebarCaps = getCapabilitiesByType(testManifest, 'sidebar-panel');
    expect(sidebarCaps).toHaveLength(1);
    expect(sidebarCaps[0].label).toBe('Tasks');

    const editorCaps = getCapabilitiesByType(testManifest, 'editor-extension');
    expect(editorCaps).toHaveLength(1);
    expect(editorCaps[0].nodes).toEqual(['daily-note-header']);
  });

  it('returns empty array when no capabilities of type exist', () => {
    expect(getCapabilitiesByType(minimalManifest, 'trpc-router')).toEqual([]);
    expect(getCapabilitiesByType(minimalManifest, 'storage')).toEqual([]);
  });

  it('handles multiple capabilities of the same type', () => {
    const manifestWithMultiplePanels: PluginManifest = {
      id: '@scribe/plugin-multi',
      version: '1.0.0',
      name: 'Multi Panel Plugin',
      capabilities: [
        { type: 'sidebar-panel', id: 'panel-a', label: 'Panel A', icon: 'A' },
        { type: 'sidebar-panel', id: 'panel-b', label: 'Panel B', icon: 'B' },
        { type: 'trpc-router', namespace: 'multi' },
      ],
    };

    const panels = getCapabilitiesByType(manifestWithMultiplePanels, 'sidebar-panel');
    expect(panels).toHaveLength(2);
    expect(panels.map((p) => p.id)).toEqual(['panel-a', 'panel-b']);
  });
});

// ============================================================================
// Type Structure Tests (compile-time + runtime verification)
// ============================================================================

describe('PluginManifest structure', () => {
  it('accepts a complete manifest', () => {
    const manifest: PluginManifest = {
      id: '@scribe/test',
      version: '1.0.0',
      name: 'Test Plugin',
      description: 'A test plugin',
      author: 'Test Author',
      capabilities: [],
      scribeVersion: '>=1.0.0',
    };

    expect(manifest.id).toBe('@scribe/test');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.name).toBe('Test Plugin');
    expect(manifest.description).toBe('A test plugin');
    expect(manifest.author).toBe('Test Author');
    expect(manifest.capabilities).toEqual([]);
    expect(manifest.scribeVersion).toBe('>=1.0.0');
  });

  it('accepts a minimal manifest', () => {
    const manifest: PluginManifest = {
      id: '@scribe/minimal',
      version: '0.1.0',
      name: 'Minimal',
      capabilities: [],
    };

    expect(manifest.description).toBeUndefined();
    expect(manifest.author).toBeUndefined();
    expect(manifest.scribeVersion).toBeUndefined();
  });
});

describe('PluginEvent discriminated union', () => {
  it('correctly narrows NoteCreatedEvent', () => {
    const event: PluginEvent = {
      type: 'note:created',
      noteId: 'note-123',
      title: 'New Note',
      createdAt: new Date('2024-01-01'),
    };

    if (event.type === 'note:created') {
      // TypeScript should narrow this to NoteCreatedEvent
      expect(event.noteId).toBe('note-123');
      expect(event.title).toBe('New Note');
      expect(event.createdAt).toBeInstanceOf(Date);
    }
  });

  it('correctly narrows NoteUpdatedEvent', () => {
    const event: PluginEvent = {
      type: 'note:updated',
      noteId: 'note-123',
      title: 'Updated Note',
      updatedAt: new Date('2024-01-02'),
      changes: { title: true, content: false },
    };

    if (event.type === 'note:updated') {
      expect(event.changes.title).toBe(true);
      expect(event.changes.content).toBe(false);
    }
  });

  it('correctly narrows NoteDeletedEvent', () => {
    const event: PluginEvent = {
      type: 'note:deleted',
      noteId: 'note-123',
    };

    if (event.type === 'note:deleted') {
      expect(event.noteId).toBe('note-123');
    }
  });
});

describe('PluginCapability discriminated union', () => {
  it('enables exhaustive switch handling', () => {
    function describeCapability(cap: PluginCapability): string {
      switch (cap.type) {
        case 'trpc-router':
          return `Router at ${cap.namespace}`;
        case 'storage':
          return `Storage with ${cap.keys?.length ?? 0} keys`;
        case 'event-hook':
          return `Hooks for ${cap.events.join(', ')}`;
        case 'sidebar-panel':
          return `Panel: ${cap.label}`;
        case 'slash-command':
          return `Command: /${cap.command}`;
        case 'command-palette-command':
          return `Palette: ${cap.id}`;
        case 'editor-extension':
          return `Editor extension with ${cap.nodes?.length ?? 0} nodes`;
      }
    }

    expect(describeCapability(trpcCapability)).toBe('Router at examples');
    expect(describeCapability(storageCapability)).toBe('Storage with 2 keys');
    expect(describeCapability(eventHookCapability)).toBe('Hooks for note:created, note:updated');
    expect(describeCapability(sidebarPanelCapability)).toBe('Panel: Examples');
    expect(describeCapability(slashCommandCapability)).toBe('Command: /snippet');
    expect(describeCapability(commandPaletteCommandCapability)).toBe(
      'Palette: example.createSnippet'
    );
    expect(describeCapability(editorExtensionCapability)).toBe('Editor extension with 1 nodes');
  });
});

// ============================================================================
// Plugin Instance Type Tests
// ============================================================================

describe('ServerPlugin structure', () => {
  it('accepts a minimal server plugin', () => {
    const plugin: ServerPlugin = {
      manifest: minimalManifest,
    };

    expect(plugin.manifest).toBe(minimalManifest);
    expect(plugin.router).toBeUndefined();
    expect(plugin.eventHandlers).toBeUndefined();
    expect(plugin.onActivate).toBeUndefined();
    expect(plugin.onDeactivate).toBeUndefined();
  });

  it('accepts a full server plugin with lifecycle hooks', () => {
    const plugin: ServerPlugin = {
      manifest: testManifest,
      eventHandlers: {
        'note:created': async (_event) => {
          // Handle created event
        },
        'note:deleted': (_event) => {
          // Handle deleted event (sync)
        },
      },
      async onActivate() {
        // Plugin activated
      },
      async onDeactivate() {
        // Plugin deactivated
      },
    };

    expect(plugin.eventHandlers?.['note:created']).toBeDefined();
    expect(plugin.eventHandlers?.['note:deleted']).toBeDefined();
    expect(plugin.eventHandlers?.['note:updated']).toBeUndefined();
  });
});

describe('ClientPlugin structure', () => {
  it('accepts a minimal client plugin', () => {
    const plugin: ClientPlugin = {
      manifest: minimalManifest,
    };

    expect(plugin.manifest).toBe(minimalManifest);
    expect(plugin.sidebarPanels).toBeUndefined();
    expect(plugin.slashCommands).toBeUndefined();
  });

  it('accepts a client plugin with slash commands', () => {
    const plugin: ClientPlugin = {
      manifest: testManifest,
      slashCommands: {
        snippet: {
          execute({ text, insertContent }) {
            insertContent({ type: 'snippet', text });
          },
        },
      },
    };

    expect(plugin.slashCommands?.['snippet']).toBeDefined();
    expect(plugin.slashCommands?.['snippet'].execute).toBeInstanceOf(Function);
  });

  it('accepts a client plugin with editor extensions', () => {
    class DailyNoteHeaderNode {
      static getType() {
        return 'daily-note-header';
      }
    }

    const DailyNoteHeaderPlugin = () => null;

    const plugin: ClientPlugin = {
      manifest: testManifest,
      editorExtensions: {
        nodes: [DailyNoteHeaderNode],
        plugins: [DailyNoteHeaderPlugin],
      },
    };

    expect(plugin.editorExtensions?.nodes).toContain(DailyNoteHeaderNode);
    expect(plugin.editorExtensions?.plugins).toContain(DailyNoteHeaderPlugin);
  });
});

// ============================================================================
// Optional Fields Tests
// ============================================================================

describe('Optional capability fields', () => {
  it('storage capability keys is optional', () => {
    const cap: StorageCapability = {
      type: 'storage',
    };
    expect(cap.keys).toBeUndefined();
  });

  it('sidebar-panel priority is optional', () => {
    const cap: SidebarPanelCapability = {
      type: 'sidebar-panel',
      id: 'test',
      label: 'Test',
      icon: 'Test',
    };
    expect(cap.priority).toBeUndefined();
  });

  it('slash-command description and icon are optional', () => {
    const cap: SlashCommandCapability = {
      type: 'slash-command',
      command: 'test',
      label: 'Test',
    };
    expect(cap.description).toBeUndefined();
    expect(cap.icon).toBeUndefined();
  });

  it('command-palette-command optional fields are optional', () => {
    const cap: CommandPaletteCommandCapability = {
      type: 'command-palette-command',
      id: 'test.command',
      label: 'Test Command',
    };
    expect(cap.description).toBeUndefined();
    expect(cap.icon).toBeUndefined();
    expect(cap.shortcut).toBeUndefined();
    expect(cap.category).toBeUndefined();
    expect(cap.priority).toBeUndefined();
  });

  it('editor-extension nodes and plugins are optional', () => {
    const cap: EditorExtensionCapability = {
      type: 'editor-extension',
    };
    expect(cap.nodes).toBeUndefined();
    expect(cap.plugins).toBeUndefined();
  });
});
