/**
 * Open Daily Command
 *
 * Opens today's daily note in the Scribe desktop app.
 * This is a no-view command that executes immediately.
 */

import { showToast, Toast, showHUD } from '@raycast/api';
import { openDaily } from './lib/cli';
import { getUserFriendlyError } from './lib/errors';

export default async function OpenDailyCommand() {
  try {
    const result = await openDaily();

    if (result.success) {
      await showHUD(`Opened ${result.title || 'daily note'}`);
    } else {
      // Daily note doesn't exist - show error with helpful message
      await showToast({
        style: Toast.Style.Failure,
        title: 'No Daily Note',
        message:
          result.error || "Today's daily note doesn't exist yet. Use Quick Note to create it.",
      });
    }
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: 'Failed to Open Daily',
      message: getUserFriendlyError(error),
    });
  }
}
