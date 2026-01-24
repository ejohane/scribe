/**
 * @scribe/plugin-daily-note
 *
 * Scaffold for the Daily Note plugin module exports.
 *
 * @module
 */

export { manifest, createServerPlugin } from './server/index.js';
export {
  createClientPlugin,
  createDailyContent,
  formatDailyHeaderDate,
  getOrCreateDailyNoteId,
  initializeClientPlugin,
  openDailyNoteCommandHandler,
  setUseScribeClient,
} from './client/index.js';
