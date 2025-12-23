/**
 * useAutocompleteKeyboardNavigation Hook
 *
 * A hook for handling keyboard navigation in autocomplete menus.
 * Manages ArrowUp, ArrowDown, Enter, and Tab key interactions.
 *
 * @module hooks/useAutocompleteKeyboard
 */

import { useEffect } from 'react';

/**
 * Minimal actions interface for keyboard navigation.
 * Only requires the navigation functions, not the full AutocompleteActions.
 */
export interface KeyboardNavigationActions {
  /** Move selection up */
  selectPrevious: () => void;
  /** Move selection down */
  selectNext: (maxIndex: number) => void;
}

/**
 * Hook for keyboard navigation in autocomplete menus.
 *
 * Handles keyboard events for navigating through autocomplete results:
 * - ArrowUp: Select previous item
 * - ArrowDown: Select next item
 * - Enter/Tab: Select current item
 *
 * Events are captured at the document level with `capture: true` to
 * prevent them from propagating to the editor.
 *
 * @param isOpen - Whether the autocomplete menu is open
 * @param selectedIndex - Current selected index in results
 * @param totalItems - Total number of selectable items
 * @param onSelect - Callback when an item is selected (Enter/Tab pressed)
 * @param actions - Navigation actions (selectPrevious, selectNext)
 *
 * @example
 * ```tsx
 * function AutocompleteMenu({ isOpen, results, onItemSelect }) {
 *   const [selectedIndex, setSelectedIndex] = useState(0);
 *
 *   const actions = {
 *     selectPrevious: () => setSelectedIndex(i => Math.max(i - 1, 0)),
 *     selectNext: (max) => setSelectedIndex(i => Math.min(i + 1, max)),
 *   };
 *
 *   useAutocompleteKeyboardNavigation(
 *     isOpen,
 *     selectedIndex,
 *     results.length,
 *     () => onItemSelect(results[selectedIndex]),
 *     actions
 *   );
 *
 *   return isOpen ? <ul>...</ul> : null;
 * }
 * ```
 */
export function useAutocompleteKeyboardNavigation(
  isOpen: boolean,
  selectedIndex: number,
  totalItems: number,
  onSelect: () => void,
  actions: KeyboardNavigationActions
): void {
  useEffect(() => {
    if (!isOpen || totalItems === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          actions.selectNext(totalItems - 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          actions.selectPrevious();
          break;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          onSelect();
          break;
      }
    };

    // Capture phase to intercept before editor handles keys
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, selectedIndex, totalItems, onSelect, actions]);
}
