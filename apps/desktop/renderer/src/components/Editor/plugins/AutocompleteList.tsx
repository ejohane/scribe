/**
 * AutocompleteList Component
 *
 * A shared component for rendering autocomplete dropdowns with consistent
 * loading, empty, and list rendering patterns. Wraps the FloatingMenu
 * design system primitives with a type-safe, generic API.
 *
 * @example
 * ```tsx
 * <AutocompleteList
 *   items={searchResults}
 *   selectedIndex={selectedIndex}
 *   onSelect={handleSelect}
 *   renderItem={(item, isSelected) => (
 *     <FloatingMenuItem key={item.id} selected={isSelected}>
 *       {item.title}
 *     </FloatingMenuItem>
 *   )}
 *   emptyMessage="No results found"
 * />
 * ```
 */

import type { ReactNode } from 'react';
import { FloatingMenuEmpty, FloatingMenuLoading } from '@scribe/design-system';

/**
 * Props for the AutocompleteList component
 */
export interface AutocompleteListProps<T> {
  /**
   * Array of items to render in the list
   */
  items: T[];

  /**
   * Currently selected item index for keyboard navigation
   */
  selectedIndex: number;

  /**
   * Callback when an item is selected (via click)
   */
  onSelect: (item: T) => void;

  /**
   * Render function for each item. Should return a FloatingMenuItem or similar.
   * @param item - The item to render
   * @param isSelected - Whether this item is currently selected
   * @param index - The item's index in the list
   */
  renderItem: (item: T, isSelected: boolean, index: number) => ReactNode;

  /**
   * Message to display when items array is empty
   */
  emptyMessage: string;

  /**
   * Optional message to display while loading
   * @default "Loading..."
   */
  loadingMessage?: string;

  /**
   * Whether the list is currently loading data
   * @default false
   */
  isLoading?: boolean;

  /**
   * Whether to show a spinner in the loading state
   * @default true
   */
  showLoadingSpinner?: boolean;

  /**
   * Optional additional content to render after the items (e.g., create action)
   */
  footer?: ReactNode;
}

/**
 * AutocompleteList - A generic list component for autocomplete dropdowns
 *
 * Handles the common pattern of:
 * 1. Loading state with optional spinner
 * 2. Empty state with customizable message
 * 3. List of items with selected state tracking
 * 4. Optional footer content (e.g., "Create new..." action)
 */
export function AutocompleteList<T>({
  items,
  selectedIndex,
  onSelect: _onSelect,
  renderItem,
  emptyMessage,
  loadingMessage = 'Loading...',
  isLoading = false,
  showLoadingSpinner = true,
  footer,
}: AutocompleteListProps<T>): ReactNode {
  // Loading state
  if (isLoading) {
    return (
      <FloatingMenuLoading showSpinner={showLoadingSpinner}>{loadingMessage}</FloatingMenuLoading>
    );
  }

  // Empty state (only show if no footer/create action)
  if (items.length === 0 && !footer) {
    return <FloatingMenuEmpty>{emptyMessage}</FloatingMenuEmpty>;
  }

  // Render items with optional footer
  return (
    <>
      {items.map((item, index) => renderItem(item, index === selectedIndex, index))}
      {footer}
    </>
  );
}
