/**
 * Spellcheck Dictionary IPC Handlers
 *
 * This module provides IPC handlers for managing the spellcheck dictionary:
 * - Add/remove words from custom dictionary
 * - Get/set spellcheck languages
 * - Query available languages
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `dictionary:addWord` | `word: string` | `{ success: true }` | Add word to dictionary |
 * | `dictionary:removeWord` | `word: string` | `{ success: true }` | Remove word from dictionary |
 * | `dictionary:getLanguages` | none | `string[]` | Get active spellcheck languages |
 * | `dictionary:setLanguages` | `languages: string[]` | `{ success: true }` | Set spellcheck languages |
 * | `dictionary:getAvailableLanguages` | none | `string[]` | Get all available languages |
 *
 * ## Error Conditions
 *
 * - `dictionary:addWord` throws if word is empty
 * - `dictionary:removeWord` throws if word is empty
 * - `dictionary:setLanguages` throws if languages is not an array
 * - All handlers throw if main window is not available
 *
 * @module handlers/dictionaryHandlers
 */

import { ipcMain } from 'electron';
import { HandlerDependencies, requireWindowManager } from './types';

/**
 * Setup IPC handlers for spellcheck dictionary management.
 *
 * @param deps - Handler dependencies (requires mainWindow)
 *
 * @example
 * ```typescript
 * // From renderer
 * await window.api.invoke('dictionary:addWord', 'Scribe');
 * const languages = await window.api.invoke('dictionary:getLanguages');
 * ```
 */
export function setupDictionaryHandlers(deps: HandlerDependencies): void {
  /**
   * IPC: `dictionary:addWord`
   *
   * Adds a word to the user's custom spellcheck dictionary.
   * The word will no longer be marked as misspelled.
   *
   * @param word - The word to add (will be trimmed)
   * @returns `{ success: true }`
   * @throws Error if word is empty or whitespace-only
   */
  ipcMain.handle('dictionary:addWord', async (_event, word: string) => {
    const windowManager = requireWindowManager(deps);
    const mainWindow = windowManager.getMainWindow();
    if (!mainWindow) {
      throw new Error('No window available');
    }
    if (!word?.trim()) {
      throw new Error('Word is required');
    }
    mainWindow.webContents.session.addWordToSpellCheckerDictionary(word.trim());
    return { success: true };
  });

  /**
   * IPC: `dictionary:removeWord`
   *
   * Removes a word from the user's custom spellcheck dictionary.
   * The word will be marked as misspelled again if not in system dictionary.
   *
   * @param word - The word to remove (will be trimmed)
   * @returns `{ success: true }`
   * @throws Error if word is empty or whitespace-only
   */
  ipcMain.handle('dictionary:removeWord', async (_event, word: string) => {
    const windowManager = requireWindowManager(deps);
    const mainWindow = windowManager.getMainWindow();
    if (!mainWindow) {
      throw new Error('No window available');
    }
    if (!word?.trim()) {
      throw new Error('Word is required');
    }
    mainWindow.webContents.session.removeWordFromSpellCheckerDictionary(word.trim());
    return { success: true };
  });

  /**
   * IPC: `dictionary:getLanguages`
   *
   * Gets the currently active spellcheck languages.
   *
   * @returns `string[]` - Array of language codes (e.g., ['en-US', 'de-DE'])
   */
  ipcMain.handle('dictionary:getLanguages', async () => {
    const windowManager = requireWindowManager(deps);
    const mainWindow = windowManager.getMainWindow();
    if (!mainWindow) {
      throw new Error('No window available');
    }
    return mainWindow.webContents.session.getSpellCheckerLanguages();
  });

  /**
   * IPC: `dictionary:setLanguages`
   *
   * Sets the active spellcheck languages.
   * Multiple languages can be active simultaneously.
   *
   * @param languages - Array of language codes to enable (e.g., ['en-US'])
   * @returns `{ success: true }`
   * @throws Error if languages is not an array
   */
  ipcMain.handle('dictionary:setLanguages', async (_event, languages: string[]) => {
    const windowManager = requireWindowManager(deps);
    const mainWindow = windowManager.getMainWindow();
    if (!mainWindow) {
      throw new Error('No window available');
    }
    if (!Array.isArray(languages)) {
      throw new Error('Languages must be an array');
    }
    mainWindow.webContents.session.setSpellCheckerLanguages(languages);
    return { success: true };
  });

  /**
   * IPC: `dictionary:getAvailableLanguages`
   *
   * Gets all available spellcheck languages supported by the system.
   *
   * @returns `string[]` - Array of available language codes
   */
  ipcMain.handle('dictionary:getAvailableLanguages', async () => {
    const windowManager = requireWindowManager(deps);
    const mainWindow = windowManager.getMainWindow();
    if (!mainWindow) {
      throw new Error('No window available');
    }
    return mainWindow.webContents.session.availableSpellCheckerLanguages;
  });
}
