/**
 * SlashMenu Component
 *
 * Floating menu that displays available slash commands.
 * Supports filtering by query and keyboard navigation.
 */

import { useRef, useEffect } from 'react';
import type { SlashCommand } from './commands';
import { SlashMenuItem } from './SlashMenuItem';
import * as styles from './SlashMenu.css';

interface SlashMenuProps {
  /** Filtered commands to display */
  commands: SlashCommand[];
  /** Position of the menu */
  position: { top: number; left: number };
  /** Currently selected index */
  selectedIndex: number;
  /** Callback when a command is selected */
  onSelect: (command: SlashCommand) => void;
  /** Callback when hovering over an item */
  onHover: (index: number) => void;
}

export function SlashMenu({
  commands,
  position,
  selectedIndex,
  onSelect,
  onHover,
}: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Group commands by section
  const formattingCommands = commands.filter((cmd) => cmd.section === 'formatting');
  const aiCommands = commands.filter((cmd) => cmd.section === 'ai');

  // Track global index for each item
  let globalIndex = 0;

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // The plugin will handle closing via blur/escape
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (commands.length === 0) {
    return (
      <div
        ref={menuRef}
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
      ref={menuRef}
      className={styles.menu}
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="Slash commands"
    >
      {/* Formatting section */}
      {formattingCommands.length > 0 && (
        <>
          {formattingCommands.map((command) => {
            const index = globalIndex++;
            return (
              <SlashMenuItem
                key={command.id}
                command={command}
                isSelected={index === selectedIndex}
                onClick={() => onSelect(command)}
                onMouseEnter={() => onHover(index)}
              />
            );
          })}
        </>
      )}

      {/* Divider between sections */}
      {formattingCommands.length > 0 && aiCommands.length > 0 && (
        <>
          <div className={styles.divider} />
          <div className={styles.sectionLabel}>AI</div>
        </>
      )}

      {/* AI section */}
      {aiCommands.length > 0 && (
        <>
          {aiCommands.map((command) => {
            const index = globalIndex++;
            return (
              <SlashMenuItem
                key={command.id}
                command={command}
                isSelected={index === selectedIndex}
                onClick={() => onSelect(command)}
                onMouseEnter={() => onHover(index)}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
