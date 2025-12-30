/**
 * ShareMenu Component
 *
 * A share button with dropdown menu for export options.
 * Currently supports exporting notes to Markdown format.
 *
 * Accessibility Features (WCAG 2.1 AA):
 * - Full keyboard navigation (Arrow keys, Home/End, Enter/Space, Escape, Tab)
 * - Proper ARIA attributes for menu pattern
 * - Focus management (auto-focus first item, return focus on close)
 * - Reduced motion support
 * - Visible focus indicators
 *
 * @example
 * ```tsx
 * <ShareMenu
 *   noteId={note.id}
 *   onExportSuccess={(filename) => showToast(`Exported to ${filename}`)}
 *   onExportError={(error) => showToast(`Export failed: ${error}`, 'error')}
 * />
 * ```
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { NoteId, EditorContent, Note } from '@scribe/shared';
import { extractMarkdown } from '@scribe/shared';
import { ClipboardCopyIcon, FileTextIcon } from '@scribe/design-system';
import * as styles from './ShareMenu.css';

/**
 * Share icon SVG component
 * Standard share/upload icon (arrow pointing up from a box)
 */
function ShareIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

export interface ShareMenuProps {
  /** ID of the note to share */
  noteId: NoteId;
  /** Note content for copy operation (optional - copy is disabled without it) */
  noteContent?: EditorContent;
  /** Callback when export completes successfully */
  onExportSuccess?: (filePath: string) => void;
  /** Callback when export fails */
  onExportError?: (error: string) => void;
  /** Callback when copy completes successfully */
  onCopySuccess?: () => void;
  /** Callback when copy fails */
  onCopyError?: (error: string) => void;
  /** Controlled open state (optional - if provided, component is controlled) */
  isOpen?: boolean;
  /** Callback when open state changes (required when isOpen is provided) */
  onOpenChange?: (isOpen: boolean) => void;
}

/**
 * Menu item definition for extensibility
 */
interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void | Promise<void>;
}

/**
 * ShareMenu component
 *
 * Renders a share button that opens a dropdown menu with export options.
 *
 * Features:
 * - Share icon button (28x28px, subtle styling)
 * - Dropdown menu with export options
 * - Export to Markdown via IPC to main process
 * - Loading state while exporting
 * - Full keyboard navigation (WCAG 2.1 AA compliant)
 * - Focus management
 * - Click outside to close
 *
 * Keyboard Navigation:
 * - Tab: Focus share button
 * - Enter/Space: Toggle menu open/close
 * - Arrow Down: Move to next menu item (wrap)
 * - Arrow Up: Move to previous menu item (wrap)
 * - Home: Move to first menu item
 * - End: Move to last menu item
 * - Enter/Space: Activate focused item
 * - Escape: Close menu, return focus to button
 * - Tab (when open): Close menu, move to next element
 */
export function ShareMenu({
  noteId,
  noteContent,
  onExportSuccess,
  onExportError,
  onCopySuccess,
  onCopyError,
  isOpen: controlledIsOpen,
  onOpenChange,
}: ShareMenuProps) {
  // Support both controlled and uncontrolled modes
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : uncontrolledIsOpen;

  const setIsOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const newValue = typeof value === 'function' ? value(isOpen) : value;
      if (isControlled) {
        onOpenChange?.(newValue);
      } else {
        setUncontrolledIsOpen(newValue);
      }
    },
    [isControlled, isOpen, onOpenChange]
  );
  const [isExporting, setIsExporting] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * Handle export to Markdown
   * Calls the IPC handler which shows a native save dialog
   */
  const handleExportMarkdown = useCallback(async () => {
    setIsExporting(true);
    setIsOpen(false);

    try {
      const result = await window.scribe.export.toMarkdown(noteId);

      if (result.success && !result.cancelled && result.filePath) {
        // Extract filename from path (works for both Unix and Windows paths)
        // The renderer doesn't have Node's path.basename, so use regex
        const filename = result.filePath.split(/[/\\]/).pop() || 'file';
        onExportSuccess?.(filename);
      } else if (!result.success && result.error) {
        onExportError?.(result.error);
      }
      // If cancelled, do nothing (no callbacks)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      onExportError?.(message);
    } finally {
      setIsExporting(false);
      // Return focus to button after export completes
      buttonRef.current?.focus();
    }
  }, [noteId, onExportSuccess, onExportError, setIsOpen]);

  /**
   * Handle copy to clipboard as Markdown
   */
  const handleCopyMarkdown = useCallback(async () => {
    if (!noteContent) {
      onCopyError?.('No note content available');
      return;
    }

    setIsOpen(false);

    try {
      // Create a minimal Note object for extractMarkdown
      const note: Note = {
        id: noteId,
        content: noteContent,
        title: '',
        tags: [],
        metadata: {
          title: '',
          tags: [],
          links: [],
          mentions: [],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const markdown = extractMarkdown(note, { includeFrontmatter: false });
      await navigator.clipboard.writeText(markdown);
      onCopySuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to copy';
      onCopyError?.(message);
    }
  }, [noteId, noteContent, onCopySuccess, onCopyError, setIsOpen]);

  // Define menu items (extensible for future export formats)
  const menuItems: MenuItem[] = [
    {
      id: 'copy-markdown',
      label: 'Copy as Markdown',
      icon: <ClipboardCopyIcon size={14} className={styles.menuItemIcon} aria-hidden="true" />,
      action: handleCopyMarkdown,
    },
    {
      id: 'export-markdown',
      label: 'Export to Markdown',
      icon: <FileTextIcon size={14} className={styles.menuItemIcon} aria-hidden="true" />,
      action: handleExportMarkdown,
    },
    // Future export formats can be added here
  ];

  /**
   * Close menu and optionally return focus to trigger button
   */
  const closeMenu = useCallback(
    (returnFocus = true) => {
      setIsOpen(false);
      setFocusedIndex(0);
      if (returnFocus) {
        buttonRef.current?.focus();
      }
    },
    [setIsOpen]
  );

  /**
   * Open menu and focus first item
   */
  const openMenu = useCallback(() => {
    setIsOpen(true);
    setFocusedIndex(0);
  }, [setIsOpen]);

  /**
   * Focus the next menu item (with wrap)
   */
  const focusNextItem = useCallback(() => {
    setFocusedIndex((prev) => (prev + 1) % menuItems.length);
  }, [menuItems.length]);

  /**
   * Focus the previous menu item (with wrap)
   */
  const focusPreviousItem = useCallback(() => {
    setFocusedIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
  }, [menuItems.length]);

  /**
   * Focus the first menu item
   */
  const focusFirstItem = useCallback(() => {
    setFocusedIndex(0);
  }, []);

  /**
   * Focus the last menu item
   */
  const focusLastItem = useCallback(() => {
    setFocusedIndex(menuItems.length - 1);
  }, [menuItems.length]);

  /**
   * Activate the currently focused menu item
   */
  const activateFocusedItem = useCallback(() => {
    const item = menuItems[focusedIndex];
    if (item) {
      item.action();
    }
  }, [menuItems, focusedIndex]);

  // Focus the menu item when focusedIndex changes
  useEffect(() => {
    if (isOpen && menuItemRefs.current[focusedIndex]) {
      menuItemRefs.current[focusedIndex]?.focus();
    }
  }, [isOpen, focusedIndex]);

  // Focus first item when menu opens
  useEffect(() => {
    if (isOpen) {
      // Use setTimeout to ensure DOM is ready
      const timer = setTimeout(() => {
        menuItemRefs.current[0]?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        // Don't return focus when clicking outside - focus stays where clicked
        closeMenu(false);
      }
    }

    if (isOpen) {
      // Use mousedown to catch clicks before the target element might be removed
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, closeMenu]);

  /**
   * Handle keyboard navigation on the menu
   */
  const handleMenuKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          focusNextItem();
          break;
        case 'ArrowUp':
          event.preventDefault();
          focusPreviousItem();
          break;
        case 'Home':
          event.preventDefault();
          focusFirstItem();
          break;
        case 'End':
          event.preventDefault();
          focusLastItem();
          break;
        case 'Escape':
          event.preventDefault();
          closeMenu(true);
          break;
        case 'Tab':
          // Close menu and let Tab naturally move focus
          closeMenu(false);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          activateFocusedItem();
          break;
      }
    },
    [
      focusNextItem,
      focusPreviousItem,
      focusFirstItem,
      focusLastItem,
      closeMenu,
      activateFocusedItem,
    ]
  );

  /**
   * Handle keyboard events on the trigger button
   */
  const handleButtonKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          // Open menu and focus first item
          event.preventDefault();
          if (!isOpen) {
            openMenu();
          }
          break;
        case 'ArrowUp':
          // Open menu and focus last item
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setFocusedIndex(menuItems.length - 1);
          }
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (isOpen) {
            closeMenu(true);
          } else {
            openMenu();
          }
          break;
      }
    },
    [isOpen, openMenu, closeMenu, menuItems.length, setIsOpen]
  );

  /**
   * Toggle menu open/closed (for click)
   */
  const handleToggleMenu = useCallback(() => {
    if (isOpen) {
      closeMenu(true);
    } else {
      openMenu();
    }
  }, [isOpen, closeMenu, openMenu]);

  return (
    <div className={styles.container} ref={menuRef}>
      {/* Share button */}
      <button
        ref={buttonRef}
        className={styles.shareButton}
        onClick={handleToggleMenu}
        onKeyDown={handleButtonKeyDown}
        disabled={isExporting}
        aria-label="Share note"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'share-menu-dropdown' : undefined}
        title="Share"
        type="button"
      >
        <ShareIcon size={18} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          id="share-menu-dropdown"
          className={styles.dropdown}
          role="menu"
          aria-label="Share options"
          onKeyDown={handleMenuKeyDown}
        >
          {menuItems.map((item, index) => (
            <button
              key={item.id}
              ref={(el) => {
                menuItemRefs.current[index] = el;
              }}
              className={styles.menuItem}
              onClick={() => item.action()}
              role="menuitem"
              type="button"
              tabIndex={focusedIndex === index ? 0 : -1}
              aria-current={focusedIndex === index ? 'true' : undefined}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
