/**
 * CommandPaletteItem
 *
 * A single item in the command palette list.
 * Handles selection highlighting and click interaction.
 *
 * @module
 */

import { forwardRef, useEffect, useRef } from 'react';
import clsx from 'clsx';
import * as styles from './CommandPalette.css';
import type { CommandPaletteItem as ItemType } from './types';
import { IconByName } from './IconByName';

/**
 * Parse a keyboard shortcut string into individual key parts.
 * Handles common patterns like "⌘N", "⌘⇧F", "Ctrl+Shift+P"
 */
function parseShortcut(shortcut: string): string[] {
  // If it contains +, split by +
  if (shortcut.includes('+')) {
    return shortcut.split('+').map((k) => k.trim());
  }
  // Otherwise, split into individual modifier characters and the main key
  const keys: string[] = [];
  let i = 0;
  while (i < shortcut.length) {
    const char = shortcut[i];
    // Check for common modifier symbols (⌘, ⌥, ⌃, ⇧)
    if (['⌘', '⌥', '⌃', '⇧'].includes(char)) {
      keys.push(char);
      i++;
    } else {
      // Rest is the main key
      keys.push(shortcut.slice(i));
      break;
    }
  }
  return keys;
}

export interface CommandPaletteItemProps {
  /** The item data */
  item: ItemType;
  /** Whether this item is currently selected */
  selected: boolean;
  /** Click handler */
  onClick: () => void;
  /** Optional className */
  className?: string;
}

/**
 * An interactive item in the command palette.
 * Automatically scrolls into view when selected.
 */
export const CommandPaletteItem = forwardRef<HTMLDivElement, CommandPaletteItemProps>(
  function CommandPaletteItem({ item, selected, onClick, className }, ref) {
    const itemRef = useRef<HTMLDivElement>(null);

    // Scroll selected item into view
    useEffect(() => {
      if (selected && itemRef.current) {
        itemRef.current.scrollIntoView({ block: 'nearest' });
      }
    }, [selected]);

    // Merge refs
    const setRef = (el: HTMLDivElement | null) => {
      (itemRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      if (typeof ref === 'function') {
        ref(el);
      } else if (ref) {
        ref.current = el;
      }
    };

    // Determine icon variant based on item type
    const getIconVariant = (): keyof typeof styles.itemIconVariant => {
      if (item.type === 'note') {
        return item.noteType;
      }
      return 'default';
    };

    // Get the icon name with fallback
    const iconName = item.icon ?? 'FileText';

    // Parse shortcut into individual keys if present
    const shortcutKeys =
      item.type === 'command' && item.shortcut ? parseShortcut(item.shortcut) : [];

    return (
      <div
        ref={setRef}
        className={clsx(styles.item, selected && styles.itemSelected, className)}
        onClick={onClick}
        role="option"
        aria-selected={selected}
        id={`command-palette-item-${item.id}`}
      >
        <span className={clsx(styles.itemIcon, styles.itemIconVariant[getIconVariant()])}>
          <IconByName name={iconName} size={18} />
        </span>
        <div className={styles.itemContent}>
          <div className={styles.itemLabel}>{item.label}</div>
          {item.description && <div className={styles.itemDescription}>{item.description}</div>}
        </div>
        {shortcutKeys.length > 0 && (
          <span className={styles.itemShortcut}>
            {shortcutKeys.map((key, index) => (
              <span key={index} className={styles.keyboardKey}>
                {key}
              </span>
            ))}
          </span>
        )}
      </div>
    );
  }
);
