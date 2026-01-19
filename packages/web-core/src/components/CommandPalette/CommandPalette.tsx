/**
 * CommandPalette
 *
 * The main command palette UI component.
 * Renders the modal overlay, search input, and results list.
 *
 * @module
 */

import { useCallback, useEffect } from 'react';
import { Portal } from '@scribe/design-system';
import clsx from 'clsx';
import * as styles from './CommandPalette.css';
import { CommandPaletteInput } from './CommandPaletteInput';
import { CommandPaletteItem } from './CommandPaletteItem';
import { CommandPaletteSection } from './CommandPaletteSection';
import { useCommandPalette } from './CommandPaletteProvider';

export interface CommandPaletteProps {
  /** Optional className for the container */
  className?: string;
}

/**
 * The main command palette component.
 *
 * Renders a modal overlay with a search input and filterable results.
 * Uses the CommandPaletteProvider for state management.
 *
 * @example
 * ```tsx
 * // In your app, wrap with provider and render the palette
 * <CommandPaletteProvider>
 *   <App />
 *   <CommandPalette />
 * </CommandPaletteProvider>
 * ```
 */
export function CommandPalette({ className }: CommandPaletteProps) {
  const {
    isOpen,
    view,
    query,
    selectedIndex,
    isSearching,
    sections,
    totalItems,
    setQuery,
    close,
    selectNext,
    selectPrevious,
    executeSelected,
  } = useCommandPalette();

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close if clicking the backdrop itself
      if (e.target === e.currentTarget) {
        close();
      }
    },
    [close]
  );

  // Prevent body scroll when open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  // Track the global item index for selection
  let globalIndex = 0;

  // Determine placeholder text for empty state
  const emptyText =
    view === 'command'
      ? query
        ? 'No commands found'
        : 'Type to search commands...'
      : query
        ? 'No notes found'
        : 'Type to search notes...';

  // Determine if we should show loading state
  const showLoading = isSearching && query.length >= 2;

  return (
    <Portal>
      <div
        className={styles.backdrop}
        onClick={handleBackdropClick}
        role="presentation"
        aria-hidden="true"
      >
        <div
          className={clsx(styles.container, className)}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <CommandPaletteInput
            value={query}
            onChange={setQuery}
            onSubmit={executeSelected}
            onEscape={close}
            onArrowDown={selectNext}
            onArrowUp={selectPrevious}
            view={view}
          />

          <div
            className={styles.results}
            role="listbox"
            aria-label="Results"
            aria-activedescendant={
              totalItems > 0
                ? `command-palette-item-${sections.flatMap((s) => s.items)[selectedIndex]?.id}`
                : undefined
            }
          >
            {showLoading ? (
              <div className={styles.loadingState}>
                <span className={styles.spinner} />
                Searching...
              </div>
            ) : totalItems === 0 ? (
              <div className={styles.emptyState}>{emptyText}</div>
            ) : (
              sections.map((section) => (
                <CommandPaletteSection key={section.id} label={section.label}>
                  {section.items.map((item) => {
                    const itemIndex = globalIndex++;
                    return (
                      <CommandPaletteItem
                        key={item.id}
                        item={item}
                        selected={itemIndex === selectedIndex}
                        onClick={() => {
                          // Execute this specific item
                          executeSelected();
                        }}
                      />
                    );
                  })}
                </CommandPaletteSection>
              ))
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
