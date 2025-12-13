/**
 * SlashMenu Component
 *
 * Floating menu that displays available slash commands.
 * Supports filtering by query and keyboard navigation.
 * Uses the FloatingMenu design system primitive for consistent styling.
 */

import { useRef, useEffect } from 'react';
import type { SlashCommand } from './commands';
import { SlashMenuItem } from './SlashMenuItem';
import {
  FloatingMenu,
  FloatingMenuEmpty,
  FloatingMenuDivider,
  FloatingMenuSection,
} from '@scribe/design-system';

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
      <FloatingMenu ref={menuRef} position={position} ariaLabel="Slash commands" width="lg">
        <FloatingMenuEmpty>No matching commands</FloatingMenuEmpty>
      </FloatingMenu>
    );
  }

  return (
    <FloatingMenu ref={menuRef} position={position} ariaLabel="Slash commands" width="lg">
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
          <FloatingMenuDivider />
          <FloatingMenuSection label="AI" />
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
    </FloatingMenu>
  );
}
