/**
 * Editor Components
 *
 * Exports editor-related components including the SlashMenu
 * and plugin command integration.
 *
 * @module
 */

export { SlashMenu, getFilteredCommandCount, getCommandByIndex } from './SlashMenu';
export type { SlashMenuProps, CoreSlashCommand, SlashMenuCommand } from './SlashMenu';

export { PluginCommandItem } from './PluginCommandItem';
export type { PluginCommandItemProps } from './PluginCommandItem';

export { SlashCommandProvider, useSlashCommandContext } from './SlashCommandContext';
export type {
  SlashCommandContext,
  SlashCommandProviderConfig,
  SlashCommandProviderProps,
} from './SlashCommandContext';

export { SlashMenuPlugin } from './SlashMenuPlugin';
export type { SlashMenuPluginProps } from './SlashMenuPlugin';
