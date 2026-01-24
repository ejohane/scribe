/**
 * Daily Note Plugin Integration Tests
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { PluginLoader, PluginRegistry, type PluginContextFactory } from '@scribe/plugin-core';
import * as dailyNotePlugin from '../index.js';

describe('daily note plugin loader integration', () => {
  it('registers command palette and editor extension capabilities', async () => {
    const registry = new PluginRegistry();
    const contextFactory: PluginContextFactory = {
      create(manifest) {
        return {
          manifest,
          client: {
            query: async () => null,
            mutate: async () => null,
          },
        };
      },
    };

    const loader = new PluginLoader(registry, contextFactory);
    await loader.loadPlugin(dailyNotePlugin);

    const commands = registry.getCapabilities('command-palette-command');
    const command = commands.find((entry) => entry.id === 'dailyNote.openToday');

    expect(command).toBeDefined();
    expect(command?.label).toBe('Today');
    expect(command?.category).toBe('Notes');
    expect(command?.priority).toBe(5);
    expect(command?.shortcut).toBe('⌘D');

    const extensions = registry.getCapabilities('editor-extension');
    expect(extensions).toHaveLength(1);
    expect(extensions[0].nodes.map((node) => node.id)).toContain('DailyHeaderNode');
    expect(extensions[0].plugins.map((plugin) => plugin.id)).toContain('DailyHeaderPlugin');
  });
});
