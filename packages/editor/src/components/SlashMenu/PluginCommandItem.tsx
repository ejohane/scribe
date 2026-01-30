/**
 * PluginCommandItem
 *
 * Renders a single plugin-provided slash command item in the menu.
 * Wraps command execution with error handling and provides context
 * to the handler.
 *
 * @module
 */

import { useRef, useEffect, type MouseEvent } from 'react';
import type { SlashCommandEntry, SlashCommandArgs } from '@scribe/plugin-core';
import { useSlashCommandContext } from './SlashCommandContext.js';
import * as styles from './SlashMenu.css.js';

/**
 * Get an icon component by name.
 * Falls back to a generic plug icon for unknown icons.
 */
function getIconElement(iconName?: string): JSX.Element {
  // For now, render a simple SVG based on known icon names
  // In a full implementation, this would map to lucide-react icons
  const size = 16;

  switch (iconName) {
    case 'check-square':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case 'plug':
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22v-5" />
          <path d="M9 8V2" />
          <path d="M15 8V2" />
          <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
        </svg>
      );
  }
}

/**
 * Props for the PluginCommandItem component.
 */
export interface PluginCommandItemProps {
  /** The slash command entry from the plugin registry */
  command: SlashCommandEntry;
  /** Whether this item is currently selected */
  isSelected: boolean;
  /** Callback when the item is clicked */
  onClick: () => void;
  /** Callback when mouse enters the item */
  onMouseEnter: () => void;
  /** Optional hook before command execution */
  onBeforeExecute?: () => void;
}

/**
 * PluginCommandItem component.
 *
 * Renders a plugin-provided slash command with proper error handling.
 * When clicked, executes the command handler with the full context.
 *
 * @example
 * ```tsx
 * <PluginCommandItem
 *   command={slashCommandEntry}
 *   isSelected={index === selectedIndex}
 *   onClick={() => handleSelect(command)}
 *   onMouseEnter={() => setSelectedIndex(index)}
 * />
 * ```
 */
export function PluginCommandItem({
  command,
  isSelected,
  onClick,
  onMouseEnter,
  onBeforeExecute,
}: PluginCommandItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ctx = useSlashCommandContext();

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

  const handleClick = async () => {
    if (!command.handler) {
      ctx.toast(`Command "${command.command}" has no handler`, 'error');
      onClick();
      return;
    }

    onBeforeExecute?.();

    // Build args for the handler
    const args: SlashCommandArgs = {
      text: '', // Empty text since slash commands don't have arguments in this context
      noteId: ctx.noteId ?? '',
      insertContent: (content: unknown) => {
        // For now, convert to string and insert as text
        // A more sophisticated implementation could handle Lexical nodes
        if (typeof content === 'string') {
          ctx.insertText(content);
        } else {
          ctx.insertText(JSON.stringify(content));
        }
      },
    };

    try {
      await command.handler.execute(args);
      ctx.close();
      onClick();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      // eslint-disable-next-line no-console -- Log for debugging
      console.error(`[plugin:${command.pluginId}] Slash command error:`, error);
      ctx.toast(`Command failed: ${message}`, 'error');
      ctx.close();
      onClick();
    }
  };

  return (
    <div
      ref={ref}
      className={`${styles.menuItem} ${isSelected ? styles.menuItemSelected : ''}`}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseEnter={onMouseEnter}
      role="option"
      aria-selected={isSelected}
    >
      <div className={`${styles.menuItemIcon} ${styles.menuItemIconPlugin}`}>
        {getIconElement(command.icon)}
      </div>
      <div className={styles.menuItemText}>
        <div className={styles.menuItemLabel}>{command.label}</div>
        {command.description && (
          <div className={styles.menuItemDescription}>{command.description}</div>
        )}
      </div>
    </div>
  );
}
