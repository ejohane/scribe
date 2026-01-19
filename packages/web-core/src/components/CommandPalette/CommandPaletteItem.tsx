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
          <IconByName name={iconName} size={16} />
        </span>
        <div className={styles.itemContent}>
          <div className={styles.itemLabel}>{item.label}</div>
          {item.description && <div className={styles.itemDescription}>{item.description}</div>}
        </div>
        {item.type === 'command' && item.shortcut && (
          <span className={styles.itemShortcut}>{item.shortcut}</span>
        )}
      </div>
    );
  }
);
