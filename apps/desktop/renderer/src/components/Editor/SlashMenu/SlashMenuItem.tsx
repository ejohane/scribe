/**
 * SlashMenuItem Component
 *
 * Individual item in the slash command menu.
 * Displays icon, label, and description.
 */

import { useRef, useEffect, type MouseEvent } from 'react';
import clsx from 'clsx';
import type { SlashCommand } from './commands';
import {
  TextIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  QuoteIcon,
  SparklesIcon,
} from '@scribe/design-system';
import * as styles from './SlashMenu.css';

interface SlashMenuItemProps {
  command: SlashCommand;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

export function SlashMenuItem({ command, isSelected, onClick, onMouseEnter }: SlashMenuItemProps) {
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

  const isAiCommand = command.section === 'ai';

  return (
    <div
      ref={ref}
      className={clsx(styles.menuItem, isSelected && styles.menuItemSelected)}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onMouseEnter={onMouseEnter}
      role="option"
      aria-selected={isSelected}
    >
      <div className={clsx(styles.menuItemIcon, isAiCommand && styles.menuItemIconAi)}>
        <CommandIcon commandId={command.id} />
      </div>
      <div className={styles.menuItemText}>
        <div className={styles.menuItemLabel}>{command.label}</div>
        <div className={styles.menuItemDescription}>{command.description}</div>
      </div>
    </div>
  );
}

// ============================================================================
// Icon selector based on command ID
// ============================================================================

interface CommandIconProps {
  commandId: string;
}

function CommandIcon({ commandId }: CommandIconProps) {
  switch (commandId) {
    case 'text':
      return <TextIcon />;
    case 'heading1':
      return <Heading1Icon />;
    case 'heading2':
      return <Heading2Icon />;
    case 'heading3':
      return <Heading3Icon />;
    case 'bullet':
      return <ListIcon />;
    case 'quote':
      return <QuoteIcon />;
    case 'ai-continue':
    case 'ai-summarize':
      return <SparklesIcon />;
    default:
      return <TextIcon />;
  }
}
