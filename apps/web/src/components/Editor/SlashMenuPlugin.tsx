/**
 * SlashMenuPlugin wrapper for shared editor plugin.
 */

import { SlashMenuPlugin as SharedSlashMenuPlugin } from '@scribe/editor';
import type { SlashMenuCommandDefinition } from '@scribe/editor';
import { useSlashCommands } from '../../plugins/index.js';
import { slashCommands } from './slashCommands';

export interface SlashMenuPluginProps {
  noteId?: string;
}

export function SlashMenuPlugin({ noteId }: SlashMenuPluginProps) {
  const { commands: pluginCommands, isLoading: isLoadingPlugins } = useSlashCommands();

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    if (type === 'error') {
      console.error(message);
      return;
    }
    console.info(message);
  };

  return (
    <SharedSlashMenuPlugin
      coreCommands={slashCommands as SlashMenuCommandDefinition[]}
      pluginCommands={pluginCommands}
      isLoadingPlugins={isLoadingPlugins}
      noteId={noteId}
      showToast={showToast}
    />
  );
}
