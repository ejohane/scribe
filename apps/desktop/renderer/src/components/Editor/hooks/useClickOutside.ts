/**
 * useClickOutside Hook
 *
 * A generic hook for detecting clicks outside a specified container.
 * Useful for closing dropdowns, modals, and autocomplete menus.
 *
 * @module hooks/useClickOutside
 */

import { useEffect } from 'react';

/**
 * Hook for handling click-outside behavior.
 *
 * Detects clicks outside a container element and calls the provided callback.
 * Uses mousedown event to detect clicks before focus changes.
 *
 * @param isActive - Whether the click-outside detection is active
 * @param onClickOutside - Callback when clicking outside the container
 * @param containerSelector - CSS selector for the container (default: '[role="listbox"]')
 *
 * @example
 * ```tsx
 * function Dropdown({ isOpen, onClose }) {
 *   useClickOutside(isOpen, onClose, '.dropdown-menu');
 *   return isOpen ? <div className="dropdown-menu">...</div> : null;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With default selector (role="listbox")
 * useClickOutside(isOpen, handleClose);
 * ```
 */
export function useClickOutside(
  isActive: boolean,
  onClickOutside: () => void,
  containerSelector: string = '[role="listbox"]'
): void {
  useEffect(() => {
    if (!isActive) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is inside the container
      if (target.closest(containerSelector)) return;
      onClickOutside();
    };

    // Use mousedown to detect clicks before focus changes
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActive, onClickOutside, containerSelector]);
}
