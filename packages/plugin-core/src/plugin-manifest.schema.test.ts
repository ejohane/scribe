/**
 * Tests for plugin manifest Zod validation schema.
 *
 * These tests verify:
 * 1. Valid manifests pass validation
 * 2. Invalid manifests fail with clear error messages
 * 3. All capability types are validated correctly
 * 4. Edge cases and boundary conditions
 */

import { describe, it, expect } from 'vitest';
import {
  pluginManifestSchema,
  pluginCapabilitySchema,
  trpcRouterCapabilitySchema,
  storageCapabilitySchema,
  eventHookCapabilitySchema,
  sidebarPanelCapabilitySchema,
  slashCommandCapabilitySchema,
  commandPaletteCommandCapabilitySchema,
  editorExtensionCapabilitySchema,
  validateManifest,
  safeValidateManifest,
  validateCapability,
  PluginManifestError,
  type PluginManifestFromSchema,
} from './plugin-manifest.schema.js';

// ============================================================================
// Test Fixtures - Valid Data
// ============================================================================

const validTrpcCapability = {
  type: 'trpc-router',
  namespace: 'examples',
};

const validStorageCapability = {
  type: 'storage',
  keys: ['snippets', 'settings'],
};

const validStorageCapabilityNoKeys = {
  type: 'storage',
};

const validEventHookCapability = {
  type: 'event-hook',
  events: ['note:created', 'note:updated'],
};

const validSidebarPanelCapability = {
  type: 'sidebar-panel',
  id: 'example-panel',
  label: 'Examples',
  icon: 'CheckSquare',
};

const validSidebarPanelCapabilityWithPriority = {
  type: 'sidebar-panel',
  id: 'example-panel',
  label: 'Examples',
  icon: 'CheckSquare',
  priority: 10,
};

const validSlashCommandCapability = {
  type: 'slash-command',
  command: 'snippet',
  label: 'Insert Snippet',
};

const validSlashCommandCapabilityFull = {
  type: 'slash-command',
  command: 'my-snippet',
  label: 'Insert Snippet',
  description: 'Adds a new snippet to the note',
  icon: 'Plus',
};

const validCommandPaletteCommandCapability = {
  type: 'command-palette-command',
  id: 'example.createSnippet',
  label: 'Create Snippet',
};

const validCommandPaletteCommandCapabilityFull = {
  type: 'command-palette-command',
  id: 'example.createSnippet',
  label: 'Create Snippet',
  description: 'Create a new snippet in the current note',
  icon: 'CheckSquare',
  shortcut: '⌘T',
  category: 'Examples',
  priority: 10,
};

const validEditorExtensionCapability = {
  type: 'editor-extension',
  nodes: ['example-node'],
  plugins: ['example-plugin'],
};

const validManifestFull = {
  id: '@scribe/plugin-example',
  version: '1.0.0',
  name: 'Example Plugin',
  description: 'Example capabilities for Scribe',
  author: 'Scribe Team',
  capabilities: [validTrpcCapability],
  scribeVersion: '>=1.0.0',
};

const validManifestMinimal = {
  id: 'my-plugin',
  version: '0.1.0',
  name: 'My Plugin',
  capabilities: [{ type: 'storage' }],
};

// ============================================================================
// Valid Manifest Tests
// ============================================================================

describe('pluginManifestSchema - valid manifests', () => {
  it('accepts a complete manifest with all fields', () => {
    const result = pluginManifestSchema.safeParse(validManifestFull);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('@scribe/plugin-example');
      expect(result.data.version).toBe('1.0.0');
      expect(result.data.name).toBe('Todo Plugin');
      expect(result.data.description).toBe('Task management for Scribe');
      expect(result.data.author).toBe('Scribe Team');
      expect(result.data.capabilities).toHaveLength(1);
      expect(result.data.scribeVersion).toBe('>=1.0.0');
    }
  });

  it('accepts a minimal manifest with required fields only', () => {
    const result = pluginManifestSchema.safeParse(validManifestMinimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('my-plugin');
      expect(result.data.description).toBeUndefined();
      expect(result.data.author).toBeUndefined();
      expect(result.data.scribeVersion).toBeUndefined();
    }
  });

  it('accepts scoped package IDs', () => {
    const manifest = {
      ...validManifestMinimal,
      id: '@myorg/my-plugin',
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it('accepts unscoped package IDs', () => {
    const manifest = {
      ...validManifestMinimal,
      id: 'simple-plugin',
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it('accepts SemVer with prerelease tags', () => {
    const versions = ['1.0.0-alpha', '1.0.0-beta.1', '1.0.0-rc.1', '2.0.0-preview.123'];
    for (const version of versions) {
      const manifest = { ...validManifestMinimal, version };
      const result = pluginManifestSchema.safeParse(manifest);
      expect(result.success, `Expected ${version} to be valid`).toBe(true);
    }
  });

  it('accepts SemVer with build metadata', () => {
    const versions = ['1.0.0+build', '1.0.0+build.123', '1.0.0-beta+build'];
    for (const version of versions) {
      const manifest = { ...validManifestMinimal, version };
      const result = pluginManifestSchema.safeParse(manifest);
      expect(result.success, `Expected ${version} to be valid`).toBe(true);
    }
  });

  it('accepts manifest with multiple capabilities', () => {
    const manifest = {
      ...validManifestMinimal,
      capabilities: [
        validTrpcCapability,
        validStorageCapability,
        validEventHookCapability,
        validSidebarPanelCapability,
        validSlashCommandCapability,
        validCommandPaletteCommandCapability,
        validEditorExtensionCapability,
      ],
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.capabilities).toHaveLength(7);
    }
  });
});

// ============================================================================
// Invalid Manifest Tests
// ============================================================================

describe('pluginManifestSchema - invalid manifests', () => {
  it('rejects missing id', () => {
    const manifest = {
      version: '1.0.0',
      name: 'Test',
      capabilities: [{ type: 'storage' }],
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.path.includes('id'))).toBe(true);
    }
  });

  it('rejects missing version', () => {
    const manifest = {
      id: 'test',
      name: 'Test',
      capabilities: [{ type: 'storage' }],
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.path.includes('version'))).toBe(true);
    }
  });

  it('rejects missing name', () => {
    const manifest = {
      id: 'test',
      version: '1.0.0',
      capabilities: [{ type: 'storage' }],
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.path.includes('name'))).toBe(true);
    }
  });

  it('rejects empty capabilities array', () => {
    const manifest = {
      id: 'test',
      version: '1.0.0',
      name: 'Test',
      capabilities: [],
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
    if (!result.success) {
      const capError = result.error.errors.find((e) => e.path.includes('capabilities'));
      expect(capError?.message).toContain('at least one capability');
    }
  });

  it('rejects invalid ID format (uppercase)', () => {
    const manifest = {
      ...validManifestMinimal,
      id: 'MyPlugin',
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.path.includes('id'))).toBe(true);
    }
  });

  it('rejects invalid ID format (spaces)', () => {
    const manifest = {
      ...validManifestMinimal,
      id: 'my plugin',
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid version format (not SemVer)', () => {
    const invalidVersions = ['1.0', '1', 'v1.0.0', '1.0.0.0', 'latest'];
    for (const version of invalidVersions) {
      const manifest = { ...validManifestMinimal, version };
      const result = pluginManifestSchema.safeParse(manifest);
      expect(result.success, `Expected ${version} to be invalid`).toBe(false);
    }
  });

  it('rejects version as number instead of string', () => {
    const manifest = {
      ...validManifestMinimal,
      version: 1,
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const manifest = {
      ...validManifestMinimal,
      name: '',
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it('rejects name exceeding 100 characters', () => {
    const manifest = {
      ...validManifestMinimal,
      name: 'a'.repeat(101),
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it('rejects description exceeding 500 characters', () => {
    const manifest = {
      ...validManifestMinimal,
      description: 'a'.repeat(501),
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it('rejects author exceeding 100 characters', () => {
    const manifest = {
      ...validManifestMinimal,
      author: 'a'.repeat(101),
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid capability type', () => {
    const manifest = {
      ...validManifestMinimal,
      capabilities: [{ type: 'unknown-type' }],
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Capability Schema Tests - trpc-router
// ============================================================================

describe('trpcRouterCapabilitySchema', () => {
  it('accepts valid namespace', () => {
    const result = trpcRouterCapabilitySchema.safeParse(validTrpcCapability);
    expect(result.success).toBe(true);
  });

  it('accepts camelCase namespaces', () => {
    const validNamespaces = ['examples', 'myExamples', 'myLongNamespace123'];
    for (const namespace of validNamespaces) {
      const cap = { type: 'trpc-router', namespace };
      const result = trpcRouterCapabilitySchema.safeParse(cap);
      expect(result.success, `Expected ${namespace} to be valid`).toBe(true);
    }
  });

  it('rejects uppercase starting namespace', () => {
    const cap = { type: 'trpc-router', namespace: 'Todos' };
    const result = trpcRouterCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('camelCase');
    }
  });

  it('rejects namespace with hyphens', () => {
    const cap = { type: 'trpc-router', namespace: 'my-examples' };
    const result = trpcRouterCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects namespace with spaces', () => {
    const cap = { type: 'trpc-router', namespace: 'my examples' };
    const result = trpcRouterCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects empty namespace', () => {
    const cap = { type: 'trpc-router', namespace: '' };
    const result = trpcRouterCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects missing namespace', () => {
    const cap = { type: 'trpc-router' };
    const result = trpcRouterCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Capability Schema Tests - storage
// ============================================================================

describe('storageCapabilitySchema', () => {
  it('accepts storage with keys', () => {
    const result = storageCapabilitySchema.safeParse(validStorageCapability);
    expect(result.success).toBe(true);
  });

  it('accepts storage without keys', () => {
    const result = storageCapabilitySchema.safeParse(validStorageCapabilityNoKeys);
    expect(result.success).toBe(true);
  });

  it('rejects empty string in keys array', () => {
    const cap = { type: 'storage', keys: ['valid', ''] };
    const result = storageCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Capability Schema Tests - event-hook
// ============================================================================

describe('eventHookCapabilitySchema', () => {
  it('accepts valid events', () => {
    const result = eventHookCapabilitySchema.safeParse(validEventHookCapability);
    expect(result.success).toBe(true);
  });

  it('accepts all valid event types', () => {
    const cap = {
      type: 'event-hook',
      events: ['note:created', 'note:updated', 'note:deleted'],
    };
    const result = eventHookCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(true);
  });

  it('rejects empty events array', () => {
    const cap = { type: 'event-hook', events: [] };
    const result = eventHookCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('at least one event');
    }
  });

  it('rejects invalid event types', () => {
    const cap = { type: 'event-hook', events: ['note:created', 'invalid:event'] };
    const result = eventHookCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Capability Schema Tests - sidebar-panel
// ============================================================================

describe('sidebarPanelCapabilitySchema', () => {
  it('accepts valid sidebar panel', () => {
    const result = sidebarPanelCapabilitySchema.safeParse(validSidebarPanelCapability);
    expect(result.success).toBe(true);
  });

  it('accepts sidebar panel with priority', () => {
    const result = sidebarPanelCapabilitySchema.safeParse(validSidebarPanelCapabilityWithPriority);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe(10);
    }
  });

  it('rejects empty id', () => {
    const cap = { ...validSidebarPanelCapability, id: '' };
    const result = sidebarPanelCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects empty label', () => {
    const cap = { ...validSidebarPanelCapability, label: '' };
    const result = sidebarPanelCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects empty icon', () => {
    const cap = { ...validSidebarPanelCapability, icon: '' };
    const result = sidebarPanelCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects non-integer priority', () => {
    const cap = { ...validSidebarPanelCapability, priority: 10.5 };
    const result = sidebarPanelCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('integer');
    }
  });
});

// ============================================================================
// Capability Schema Tests - slash-command
// ============================================================================

describe('slashCommandCapabilitySchema', () => {
  it('accepts valid slash command', () => {
    const result = slashCommandCapabilitySchema.safeParse(validSlashCommandCapability);
    expect(result.success).toBe(true);
  });

  it('accepts slash command with all optional fields', () => {
    const result = slashCommandCapabilitySchema.safeParse(validSlashCommandCapabilityFull);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('Adds a new snippet to the note');
      expect(result.data.icon).toBe('Plus');
    }
  });

  it('accepts valid command formats', () => {
    const validCommands = ['snippet', 'my-snippet', 'snippet123', 'my-long-command-name'];
    for (const command of validCommands) {
      const cap = { ...validSlashCommandCapability, command };
      const result = slashCommandCapabilitySchema.safeParse(cap);
      expect(result.success, `Expected ${command} to be valid`).toBe(true);
    }
  });

  it('rejects uppercase command', () => {
    const cap = { ...validSlashCommandCapability, command: 'Task' };
    const result = slashCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('lowercase');
    }
  });

  it('rejects command with spaces', () => {
    const cap = { ...validSlashCommandCapability, command: 'my snippet' };
    const result = slashCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects command with underscores', () => {
    const cap = { ...validSlashCommandCapability, command: 'my_snippet' };
    const result = slashCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects empty command', () => {
    const cap = { ...validSlashCommandCapability, command: '' };
    const result = slashCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects empty label', () => {
    const cap = { ...validSlashCommandCapability, label: '' };
    const result = slashCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects command starting with number', () => {
    const cap = { ...validSlashCommandCapability, command: '123snippet' };
    const result = slashCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Capability Schema Tests - command-palette-command
// ============================================================================

describe('commandPaletteCommandCapabilitySchema', () => {
  it('accepts valid command palette command', () => {
    const result = commandPaletteCommandCapabilitySchema.safeParse(
      validCommandPaletteCommandCapability
    );
    expect(result.success).toBe(true);
  });

  it('accepts command palette command with all optional fields', () => {
    const result = commandPaletteCommandCapabilitySchema.safeParse(
      validCommandPaletteCommandCapabilityFull
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('Create a new snippet in the current note');
      expect(result.data.icon).toBe('CheckSquare');
      expect(result.data.shortcut).toBe('⌘T');
      expect(result.data.category).toBe('Tasks');
      expect(result.data.priority).toBe(10);
    }
  });

  it('accepts valid command ID formats (dot notation)', () => {
    const validIds = ['example.createSnippet', 'notes.archive', 'app.settings.open', 'search'];
    for (const id of validIds) {
      const cap = { ...validCommandPaletteCommandCapability, id };
      const result = commandPaletteCommandCapabilitySchema.safeParse(cap);
      expect(result.success, `Expected ${id} to be valid`).toBe(true);
    }
  });

  it('rejects ID starting with uppercase', () => {
    const cap = { ...validCommandPaletteCommandCapability, id: 'Todo.createTask' };
    const result = commandPaletteCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('dot notation');
    }
  });

  it('rejects ID with hyphens', () => {
    const cap = { ...validCommandPaletteCommandCapability, id: 'example-create-snippet' };
    const result = commandPaletteCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects ID with spaces', () => {
    const cap = { ...validCommandPaletteCommandCapability, id: 'example create snippet' };
    const result = commandPaletteCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects ID with underscores', () => {
    const cap = { ...validCommandPaletteCommandCapability, id: 'example_create_snippet' };
    const result = commandPaletteCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects empty ID', () => {
    const cap = { ...validCommandPaletteCommandCapability, id: '' };
    const result = commandPaletteCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects empty label', () => {
    const cap = { ...validCommandPaletteCommandCapability, label: '' };
    const result = commandPaletteCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects ID starting with number', () => {
    const cap = { ...validCommandPaletteCommandCapability, id: '123example.create' };
    const result = commandPaletteCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects ID with segment starting with number', () => {
    const cap = { ...validCommandPaletteCommandCapability, id: 'example.123create' };
    const result = commandPaletteCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects non-integer priority', () => {
    const cap = { ...validCommandPaletteCommandCapability, priority: 10.5 };
    const result = commandPaletteCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('integer');
    }
  });

  it('accepts negative priority', () => {
    const cap = { ...validCommandPaletteCommandCapability, priority: -10 };
    const result = commandPaletteCommandCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Capability Schema Tests - editor-extension
// ============================================================================

describe('editorExtensionCapabilitySchema', () => {
  it('accepts editor extension with nodes and plugins', () => {
    const result = editorExtensionCapabilitySchema.safeParse(validEditorExtensionCapability);
    expect(result.success).toBe(true);
  });

  it('accepts editor extension with only nodes', () => {
    const cap = { type: 'editor-extension', nodes: ['example-node'] };
    const result = editorExtensionCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(true);
  });

  it('accepts editor extension with only plugins', () => {
    const cap = { type: 'editor-extension', plugins: ['example-plugin'] };
    const result = editorExtensionCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(true);
  });

  it('rejects empty node IDs', () => {
    const cap = { type: 'editor-extension', nodes: [''] };
    const result = editorExtensionCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects empty plugin IDs', () => {
    const cap = { type: 'editor-extension', plugins: [''] };
    const result = editorExtensionCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Discriminated Union Tests
// ============================================================================

describe('pluginCapabilitySchema - discriminated union', () => {
  it('correctly identifies trpc-router type', () => {
    const result = pluginCapabilitySchema.safeParse(validTrpcCapability);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('trpc-router');
    }
  });

  it('correctly identifies storage type', () => {
    const result = pluginCapabilitySchema.safeParse(validStorageCapability);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('storage');
    }
  });

  it('correctly identifies event-hook type', () => {
    const result = pluginCapabilitySchema.safeParse(validEventHookCapability);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('event-hook');
    }
  });

  it('correctly identifies sidebar-panel type', () => {
    const result = pluginCapabilitySchema.safeParse(validSidebarPanelCapability);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('sidebar-panel');
    }
  });

  it('correctly identifies slash-command type', () => {
    const result = pluginCapabilitySchema.safeParse(validSlashCommandCapability);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('slash-command');
    }
  });

  it('correctly identifies command-palette-command type', () => {
    const result = pluginCapabilitySchema.safeParse(validCommandPaletteCommandCapability);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('command-palette-command');
    }
  });

  it('correctly identifies editor-extension type', () => {
    const result = pluginCapabilitySchema.safeParse(validEditorExtensionCapability);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('editor-extension');
    }
  });

  it('rejects unknown capability type', () => {
    const cap = { type: 'unknown', data: 'test' };
    const result = pluginCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });

  it('rejects missing type field', () => {
    const cap = { namespace: 'test' };
    const result = pluginCapabilitySchema.safeParse(cap);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Validation Helper Tests
// ============================================================================

describe('validateManifest', () => {
  it('returns validated manifest for valid input', () => {
    const manifest = validateManifest(validManifestFull);
    expect(manifest.id).toBe('@scribe/plugin-example');
    expect(manifest.name).toBe('Todo Plugin');
  });

  it('throws PluginManifestError for invalid input', () => {
    expect(() => validateManifest({})).toThrow(PluginManifestError);
  });

  it('includes path information in error message', () => {
    try {
      validateManifest({ id: 'test', version: 'invalid', name: 'Test', capabilities: [] });
    } catch (error) {
      expect(error).toBeInstanceOf(PluginManifestError);
      if (error instanceof PluginManifestError) {
        expect(error.message).toContain('version');
        expect(error.message).toContain('capabilities');
      }
    }
  });

  it('provides detailed error messages', () => {
    try {
      validateManifest({
        id: 'INVALID',
        version: '1.0',
        name: '',
        capabilities: [],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(PluginManifestError);
      if (error instanceof PluginManifestError) {
        expect(error.message).toContain('Invalid plugin manifest');
        expect(error.errors.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('safeValidateManifest', () => {
  it('returns success=true for valid manifest', () => {
    const result = safeValidateManifest(validManifestMinimal);
    expect(result.success).toBe(true);
  });

  it('returns success=false for invalid manifest', () => {
    const result = safeValidateManifest({});
    expect(result.success).toBe(false);
  });

  it('includes error details on failure', () => {
    const result = safeValidateManifest({ id: 'test' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.length).toBeGreaterThan(0);
    }
  });
});

describe('validateCapability', () => {
  it('returns validated capability for valid input', () => {
    const cap = validateCapability(validTrpcCapability);
    expect(cap.type).toBe('trpc-router');
  });

  it('throws PluginManifestError for invalid capability', () => {
    expect(() => validateCapability({ type: 'unknown' })).toThrow(PluginManifestError);
  });

  it('validates specific capability rules', () => {
    expect(() => validateCapability({ type: 'trpc-router', namespace: 'INVALID' })).toThrow(
      PluginManifestError
    );
  });
});

// ============================================================================
// PluginManifestError Tests
// ============================================================================

describe('PluginManifestError', () => {
  it('has correct name property', () => {
    const error = new PluginManifestError('Test error');
    expect(error.name).toBe('PluginManifestError');
  });

  it('has correct message property', () => {
    const error = new PluginManifestError('Test error message');
    expect(error.message).toBe('Test error message');
  });

  it('is instance of Error', () => {
    const error = new PluginManifestError('Test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PluginManifestError);
  });

  it('stores Zod errors when provided', () => {
    const result = pluginManifestSchema.safeParse({});
    if (!result.success) {
      const error = new PluginManifestError('Invalid', result.error);
      expect(error.errors.length).toBeGreaterThan(0);
    }
  });

  it('has empty errors array when no Zod error provided', () => {
    const error = new PluginManifestError('Test');
    expect(error.errors).toEqual([]);
  });
});

// ============================================================================
// Type Compatibility Tests
// ============================================================================

describe('Type compatibility with plugin-types.ts', () => {
  it('validated manifest is assignable to PluginManifest interface', () => {
    // This test ensures compile-time compatibility
    const validated: PluginManifestFromSchema = validateManifest(validManifestFull);

    // Runtime verification that all expected fields exist
    expect(validated.id).toBeDefined();
    expect(validated.version).toBeDefined();
    expect(validated.name).toBeDefined();
    expect(validated.capabilities).toBeDefined();
  });

  it('validated capabilities match expected structure', () => {
    const manifest = validateManifest({
      id: 'test',
      version: '1.0.0',
      name: 'Test',
      capabilities: [
        { type: 'trpc-router', namespace: 'test' },
        { type: 'storage', keys: ['key1'] },
        { type: 'event-hook', events: ['note:created'] },
        { type: 'sidebar-panel', id: 'p1', label: 'Panel', icon: 'Icon' },
        { type: 'slash-command', command: 'cmd', label: 'Cmd' },
        { type: 'command-palette-command', id: 'test.cmd', label: 'Test Command' },
        { type: 'editor-extension', nodes: ['note-header'], plugins: ['note-header-plugin'] },
      ],
    });

    expect(manifest.capabilities).toHaveLength(7);

    // Verify each capability has the expected structure
    const [trpc, storage, event, panel, cmd, paletteCmd, editorExtension] = manifest.capabilities;

    expect(trpc.type).toBe('trpc-router');
    expect(storage.type).toBe('storage');
    expect(event.type).toBe('event-hook');
    expect(panel.type).toBe('sidebar-panel');
    expect(cmd.type).toBe('slash-command');
    expect(paletteCmd.type).toBe('command-palette-command');
    expect(editorExtension.type).toBe('editor-extension');
  });
});

// ============================================================================
// Edge Cases and Boundary Tests
// ============================================================================

describe('Edge cases', () => {
  it('accepts name at exactly 100 characters', () => {
    const manifest = {
      ...validManifestMinimal,
      name: 'a'.repeat(100),
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it('accepts description at exactly 500 characters', () => {
    const manifest = {
      ...validManifestMinimal,
      description: 'a'.repeat(500),
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it('accepts author at exactly 100 characters', () => {
    const manifest = {
      ...validManifestMinimal,
      author: 'a'.repeat(100),
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it('handles null input gracefully', () => {
    const result = pluginManifestSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('handles undefined input gracefully', () => {
    const result = pluginManifestSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  it('handles array input gracefully', () => {
    const result = pluginManifestSchema.safeParse([]);
    expect(result.success).toBe(false);
  });

  it('handles string input gracefully', () => {
    const result = pluginManifestSchema.safeParse('not an object');
    expect(result.success).toBe(false);
  });

  it('strips unknown properties', () => {
    const manifest = {
      ...validManifestMinimal,
      unknownField: 'should be ignored',
      anotherUnknown: 123,
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
    if (result.success) {
      // Zod by default allows extra properties; they're just not in the type
      expect('unknownField' in result.data).toBe(false);
    }
  });

  it('validates deeply nested capability errors', () => {
    const manifest = {
      ...validManifestMinimal,
      capabilities: [{ type: 'sidebar-panel', id: '', label: '', icon: '' }],
    };
    const result = pluginManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Should have errors for id, label, and icon
      expect(result.error.errors.length).toBeGreaterThanOrEqual(3);
    }
  });
});
