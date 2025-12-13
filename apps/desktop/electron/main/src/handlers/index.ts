/**
 * IPC Handler Modules
 *
 * This module exports setup functions for all IPC handlers organized by domain.
 * Each handler module registers its own IPC handlers when called with dependencies.
 *
 * ## Handler Modules
 *
 * | Module | Channels | Description |
 * |--------|----------|-------------|
 * | {@link setupAppHandlers} | `ping`, `app:*`, `shell:*` | App configuration, devtools, shell operations |
 * | {@link setupNotesHandlers} | `notes:*` | Notes CRUD, title search, date-based queries |
 * | {@link setupSearchHandlers} | `search:*` | Full-text search across notes |
 * | {@link setupGraphHandlers} | `graph:*` | Graph traversal, backlinks, tag queries |
 * | {@link setupPeopleHandlers} | `people:*` | Person note management |
 * | {@link setupDictionaryHandlers} | `dictionary:*` | Spellcheck dictionary management |
 * | {@link setupDailyHandlers} | `daily:*` | Daily note get-or-create |
 * | {@link setupMeetingHandlers} | `meeting:*` | Meeting note creation and attendees |
 * | {@link setupTasksHandlers} | `tasks:*` | Task toggle, list, reorder |
 *
 * ## IPC Channel Naming Convention
 *
 * All channels follow the pattern `domain:action`:
 * - Domain groups related functionality (e.g., `notes`, `tasks`)
 * - Action describes the operation (e.g., `list`, `create`, `toggle`)
 *
 * ## Error Handling
 *
 * All handlers may throw if dependencies are not initialized (vault, graph, search, etc.).
 * Some handlers wrap errors using {@link ScribeError} for user-friendly messages.
 *
 * @module handlers
 */

export { setupNotesHandlers } from './notesHandlers';
export { setupSearchHandlers } from './searchHandlers';
export { setupGraphHandlers } from './graphHandlers';
export { setupPeopleHandlers } from './peopleHandlers';
export { setupAppHandlers } from './appHandlers';
export { setupDictionaryHandlers } from './dictionaryHandlers';
export { setupDailyHandlers } from './dailyHandlers';
export { setupMeetingHandlers } from './meetingHandlers';
export { setupTasksHandlers } from './tasksHandlers';

export type { HandlerDependencies, AppConfig } from './types';
