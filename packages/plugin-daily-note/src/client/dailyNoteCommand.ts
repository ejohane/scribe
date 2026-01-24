/**
 * Daily Note Command Palette Handler
 *
 * Provides the command palette command for opening daily notes.
 *
 * @module
 */

import type { CommandContext, CommandPaletteCommandHandler } from '@scribe/plugin-core';
import { getOrCreateDailyNoteId, type ScribeClientHook } from './dailyNoteUtils.js';

let useScribeClient: ScribeClientHook | null = null;

export function setUseScribeClient(hook: ScribeClientHook | null): void {
  useScribeClient = hook;
}

export async function ensureToday(): Promise<void> {
  if (!useScribeClient) {
    throw new Error('Daily note plugin not initialized');
  }

  const client = useScribeClient();
  await getOrCreateDailyNoteId(client.api.notes);
}

export const openDailyNoteCommandHandler: CommandPaletteCommandHandler = {
  async execute(ctx: CommandContext): Promise<void> {
    if (!useScribeClient) {
      ctx.toast('Daily note plugin not initialized', 'error');
      return;
    }

    try {
      const client = useScribeClient();
      const noteId = await getOrCreateDailyNoteId(client.api.notes);
      ctx.navigate(`/note/${noteId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      ctx.toast(`Failed to open daily note: ${message}`, 'error');
    }
  },
};
