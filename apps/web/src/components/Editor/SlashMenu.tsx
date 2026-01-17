/**
 * SlashMenu Component
 *
 * Floating menu that displays available slash commands including both
 * core editor commands and plugin-provided commands.
 *
 * Features:
 * - Displays commands grouped by category (formatting, plugins)
 * - Supports filtering by query
 * - Keyboard navigation
 * - Plugin command integration via useSlashCommands hook
 *
 * @module
 */

import { useRef, useEffect, forwardRef, type MouseEvent, type ReactNode } from 'react';
import type { SlashCommandEntry } from '@scribe/plugin-core';
import { PluginCommandItem } from './PluginCommandItem';
import * as styles from './SlashMenu.css';

/**
 * Core slash command definition (built-in editor commands).
 */
export interface CoreSlashCommand {
  /** Unique identifier for the command */
  id: string;
  /** Display label */
  label: string;
  /** Short description */
  description: string;
  /** Keywords for filtering */
  keywords: string[];
  /** Section for grouping */
  section: 'formatting' | 'insert' | 'ai';
  /** Execute function */
  execute: () => void;
  /** Icon element to display */
  icon?: ReactNode;
}

/**
 * Combined command type for display in the menu.
 */
export type SlashMenuCommand =
  | { type: 'core'; command: CoreSlashCommand }
  | { type: 'plugin'; command: SlashCommandEntry };

/**
 * Category labels for grouped display.
 */
const CATEGORY_LABELS: Record<string, string> = {
  formatting: 'Formatting',
  insert: 'Insert',
  ai: 'AI',
  plugins: 'Plugins',
};

/**
 * Props for the SlashMenu component.
 */
export interface SlashMenuProps {
  /** Core editor commands */
  coreCommands: CoreSlashCommand[];
  /** Plugin-provided commands */
  pluginCommands: SlashCommandEntry[];
  /** Whether plugin commands are still loading */
  isLoadingPlugins?: boolean;
  /** Position of the menu */
  position: { top: number; left: number };
  /** Currently selected index (across all commands) */
  selectedIndex: number;
  /** Current filter query */
  query: string;
  /** Callback when a core command is selected */
  onSelectCore: (command: CoreSlashCommand) => void;
  /** Callback when a plugin command is selected */
  onSelectPlugin: (command: SlashCommandEntry) => void;
  /** Callback when hovering over an item */
  onHover: (index: number) => void;
}

/**
 * Filter commands by query string.
 */
function filterCoreCommands(commands: CoreSlashCommand[], query: string): CoreSlashCommand[] {
  if (!query.trim()) {
    return commands;
  }

  const lowerQuery = query.toLowerCase();

  return commands.filter((cmd) => {
    if (cmd.label.toLowerCase().includes(lowerQuery)) return true;
    if (cmd.description.toLowerCase().includes(lowerQuery)) return true;
    if (cmd.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery))) return true;
    return false;
  });
}

function filterPluginCommands(commands: SlashCommandEntry[], query: string): SlashCommandEntry[] {
  if (!query.trim()) {
    return commands;
  }

  const lowerQuery = query.toLowerCase();

  return commands.filter((cmd) => {
    if (cmd.label.toLowerCase().includes(lowerQuery)) return true;
    if (cmd.description?.toLowerCase().includes(lowerQuery)) return true;
    if (cmd.command.toLowerCase().includes(lowerQuery)) return true;
    return false;
  });
}

/**
 * Group core commands by section.
 */
function groupCoreCommands(commands: CoreSlashCommand[]): Record<string, CoreSlashCommand[]> {
  const groups: Record<string, CoreSlashCommand[]> = {};

  for (const cmd of commands) {
    if (!groups[cmd.section]) {
      groups[cmd.section] = [];
    }
    groups[cmd.section].push(cmd);
  }

  return groups;
}

/**
 * SlashMenu - Main slash command menu component.
 *
 * Displays both core editor commands and plugin-provided commands
 * in a categorized, filterable menu.
 *
 * @example
 * ```tsx
 * <SlashMenu
 *   coreCommands={coreCommands}
 *   pluginCommands={pluginCommands}
 *   position={{ top: 100, left: 200 }}
 *   selectedIndex={0}
 *   query=""
 *   onSelectCore={handleSelectCore}
 *   onSelectPlugin={handleSelectPlugin}
 *   onHover={setSelectedIndex}
 * />
 * ```
 */
export const SlashMenu = forwardRef<HTMLDivElement, SlashMenuProps>(function SlashMenu(
  {
    coreCommands,
    pluginCommands,
    isLoadingPlugins = false,
    position,
    selectedIndex,
    query,
    onSelectCore,
    onSelectPlugin,
    onHover,
  },
  ref
) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter commands based on query
  const filteredCore = filterCoreCommands(coreCommands, query);
  const filteredPlugins = filterPluginCommands(pluginCommands, query);

  // Group core commands by section
  const groupedCore = groupCoreCommands(filteredCore);
  const coreSections = ['formatting', 'insert', 'ai'].filter(
    (section) => groupedCore[section]?.length > 0
  );

  // Total count for empty state
  const totalCount = filteredCore.length + filteredPlugins.length;

  // Track global index for each item
  let globalIndex = 0;

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (menuRef.current && !menuRef.current.contains(target)) {
        // The parent component will handle closing via blur/escape
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Empty state
  if (totalCount === 0 && !isLoadingPlugins) {
    return (
      <div
        ref={ref || menuRef}
        className={styles.menu}
        style={{ top: position.top, left: position.left }}
        role="listbox"
        aria-label="Slash commands"
      >
        <div className={styles.emptyState}>No matching commands</div>
      </div>
    );
  }

  return (
    <div
      ref={ref || menuRef}
      className={styles.menu}
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="Slash commands"
    >
      {/* Core command sections */}
      {coreSections.map((section, sectionIndex) => {
        const commands = groupedCore[section];

        return (
          <div key={section}>
            {/* Section divider (skip for first section) */}
            {sectionIndex > 0 && <div className={styles.divider} />}

            {/* Section label (only for AI section) */}
            {section === 'ai' && (
              <div className={styles.sectionLabel}>{CATEGORY_LABELS[section]}</div>
            )}

            {/* Commands */}
            {commands.map((command) => {
              const index = globalIndex++;
              return (
                <CoreCommandItem
                  key={command.id}
                  command={command}
                  isSelected={index === selectedIndex}
                  onClick={() => onSelectCore(command)}
                  onMouseEnter={() => onHover(index)}
                />
              );
            })}
          </div>
        );
      })}

      {/* Plugin commands section */}
      {filteredPlugins.length > 0 && (
        <>
          {coreSections.length > 0 && <div className={styles.divider} />}
          <div className={styles.sectionLabel}>{CATEGORY_LABELS.plugins}</div>

          {filteredPlugins.map((command) => {
            const index = globalIndex++;
            return (
              <PluginCommandItem
                key={`plugin:${command.pluginId}:${command.command}`}
                command={command}
                isSelected={index === selectedIndex}
                onClick={() => onSelectPlugin(command)}
                onMouseEnter={() => onHover(index)}
              />
            );
          })}
        </>
      )}

      {/* Loading indicator for plugins */}
      {isLoadingPlugins && (
        <div className={styles.loadingIndicator}>
          <div className={styles.loadingSpinner} />
          <span>Loading plugins...</span>
        </div>
      )}
    </div>
  );
});

/**
 * Props for CoreCommandItem component.
 */
interface CoreCommandItemProps {
  command: CoreSlashCommand;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

/**
 * Core command item - renders a built-in editor command.
 */
function CoreCommandItem({ command, isSelected, onClick, onMouseEnter }: CoreCommandItemProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Scroll into view when selected
  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isSelected]);

  // Prevent losing editor focus on click
  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div
      ref={ref}
      className={`${styles.menuItem} ${isSelected ? styles.menuItemSelected : ''}`}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onMouseEnter={onMouseEnter}
      role="option"
      aria-selected={isSelected}
    >
      <div className={styles.menuItemIcon}>{command.icon}</div>
      <div className={styles.menuItemText}>
        <div className={styles.menuItemLabel}>{command.label}</div>
        <div className={styles.menuItemDescription}>{command.description}</div>
      </div>
    </div>
  );
}

/**
 * Get the total count of filtered commands.
 * Useful for keyboard navigation bounds.
 */
export function getFilteredCommandCount(
  coreCommands: CoreSlashCommand[],
  pluginCommands: SlashCommandEntry[],
  query: string
): number {
  return (
    filterCoreCommands(coreCommands, query).length +
    filterPluginCommands(pluginCommands, query).length
  );
}

/**
 * Get a command by its global index.
 * Returns the command and its type.
 */
export function getCommandByIndex(
  coreCommands: CoreSlashCommand[],
  pluginCommands: SlashCommandEntry[],
  query: string,
  index: number
): SlashMenuCommand | null {
  const filteredCore = filterCoreCommands(coreCommands, query);
  const filteredPlugins = filterPluginCommands(pluginCommands, query);

  if (index < filteredCore.length) {
    return { type: 'core', command: filteredCore[index] };
  }

  const pluginIndex = index - filteredCore.length;
  if (pluginIndex < filteredPlugins.length) {
    return { type: 'plugin', command: filteredPlugins[pluginIndex] };
  }

  return null;
}
