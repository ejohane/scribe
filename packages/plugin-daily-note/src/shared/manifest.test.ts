/**
 * Daily Note Manifest Tests
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import type {
  CommandPaletteCommandCapability,
  EditorExtensionCapability,
} from '@scribe/plugin-core';
import { manifest } from './manifest.js';

describe('daily note manifest', () => {
  it('declares plugin identity', () => {
    expect(manifest.id).toBe('@scribe/plugin-daily-note');
    expect(manifest.name).toBe('Daily Note Plugin');
  });

  it('includes command palette and editor extension capabilities', () => {
    const capabilityTypes = manifest.capabilities.map((cap) => cap.type);
    expect(capabilityTypes).toContain('command-palette-command');
    expect(capabilityTypes).toContain('editor-extension');
  });

  it('declares the Today command palette entry', () => {
    const command = manifest.capabilities.find(
      (cap): cap is CommandPaletteCommandCapability =>
        cap.type === 'command-palette-command' && cap.id === 'dailyNote.openToday'
    );

    expect(command).toBeDefined();
    expect(command?.label).toBe('Today');
    expect(command?.category).toBe('Notes');
    expect(command?.priority).toBe(5);
    expect(command?.icon).toBe('Calendar');
    expect(command?.shortcut).toBe('⌘D');
  });

  it('declares editor extension node and plugin IDs', () => {
    const extension = manifest.capabilities.find(
      (cap): cap is EditorExtensionCapability => cap.type === 'editor-extension'
    );

    expect(extension).toBeDefined();
    expect(extension?.nodes).toEqual(['DailyHeaderNode']);
    expect(extension?.plugins).toEqual(['DailyHeaderPlugin']);
  });
});
