/**
 * PaletteItem Component
 *
 * Shared item component for browse mode panels.
 * Extracts common rendering logic for notes/people in the command palette.
 *
 * Features:
 * - Icon rendering (customizable)
 * - Title with truncation
 * - Description (e.g., relative date)
 * - Enter hint on selection
 * - Optional delete button
 * - Mouse hover/click handling
 */

import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Text, Icon, CornerDownLeftIcon, CloseIcon } from '@scribe/design-system';
import * as styles from '../CommandPalette.css';
import { truncateTitle } from './utils';

export interface PaletteItemProps {
  /** Unique key for the item */
  id: string;
  /** Title to display */
  title: string | undefined;
  /** Description (shown as muted text) */
  description?: string;
  /** Icon to display before the title */
  icon: ReactNode;
  /** Whether this item is currently selected */
  isSelected: boolean;
  /** Index of this item in the list */
  index: number;
  /** Called when mouse enters this item */
  onMouseEnter: (index: number) => void;
  /** Called when this item is clicked */
  onClick: () => void;
  /** Optional delete button configuration */
  deleteButton?: {
    /** Called when delete button is clicked */
    onDelete: () => void;
    /** Aria label for the delete button */
    ariaLabel: string;
  };
}

/**
 * A single item in a browse mode panel.
 * Renders consistently across file-browse, delete-browse, and person-browse modes.
 */
export function PaletteItem({
  id,
  title,
  description,
  icon,
  isSelected,
  index,
  onMouseEnter,
  onClick,
  deleteButton,
}: PaletteItemProps) {
  return (
    <div
      key={id}
      className={clsx(styles.paletteItem, isSelected && styles.paletteItemSelected)}
      onClick={onClick}
      onMouseEnter={() => onMouseEnter(index)}
    >
      <span className={styles.itemIcon}>{icon}</span>
      <div className={styles.itemTextContainer}>
        <Text size="sm" weight="medium" truncate className={styles.itemTitle}>
          {truncateTitle(title ?? null)}
        </Text>
        {description && (
          <Text size="xs" color="foregroundMuted" className={styles.itemDescription}>
            {description}
          </Text>
        )}
      </div>
      <span className={clsx(styles.enterHint, isSelected && styles.enterHintVisible)}>
        <CornerDownLeftIcon />
      </span>
      {deleteButton && (
        <button
          className={styles.deleteIcon}
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering item click
            deleteButton.onDelete();
          }}
          aria-label={deleteButton.ariaLabel}
          type="button"
        >
          <Icon size="sm" color="foregroundMuted">
            <CloseIcon className={styles.deleteIconSvg} />
          </Icon>
        </button>
      )}
    </div>
  );
}

/**
 * Props for PaletteItemList wrapper
 */
export interface PaletteItemListProps {
  /** Whether data is loading */
  isLoading: boolean;
  /** Loading message to display */
  loadingMessage?: string;
  /** Whether there are no items in the source data */
  isEmpty: boolean;
  /** Message to show when source is empty */
  emptyMessage: string;
  /** Whether search returned no results */
  hasNoResults: boolean;
  /** Message to show when no results found */
  noResultsMessage?: string;
  /** Whether displayed items list is empty (after filtering) */
  hasNoDisplayedItems: boolean;
  /** Children to render when there are items */
  children: ReactNode;
}

/**
 * Wrapper component handling loading/empty/no-results states.
 * Renders children only when there are items to display.
 */
export function PaletteItemList({
  isLoading,
  loadingMessage = 'Loading...',
  isEmpty,
  emptyMessage,
  hasNoResults,
  noResultsMessage = 'No results',
  hasNoDisplayedItems,
  children,
}: PaletteItemListProps) {
  // Loading state
  if (isLoading) {
    return (
      <Text color="foregroundMuted" className={styles.noResults}>
        {loadingMessage}
      </Text>
    );
  }

  // Empty source state
  if (isEmpty) {
    return (
      <Text color="foregroundMuted" className={styles.noResults}>
        {emptyMessage}
      </Text>
    );
  }

  // No results from search
  if (hasNoResults) {
    return (
      <Text color="foregroundMuted" className={styles.noResults}>
        {noResultsMessage}
      </Text>
    );
  }

  // No items to display (all filtered out)
  if (hasNoDisplayedItems) {
    return (
      <Text color="foregroundMuted" className={styles.noResults}>
        {noResultsMessage}
      </Text>
    );
  }

  // Render items
  return <>{children}</>;
}
