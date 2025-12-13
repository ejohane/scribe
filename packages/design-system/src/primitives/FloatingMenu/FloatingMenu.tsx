/**
 * FloatingMenu Component
 *
 * A floating menu primitive for autocomplete dropdowns, command palettes,
 * and context menus. Renders via Portal for proper stacking context.
 *
 * @example
 * ```tsx
 * <FloatingMenu position={{ top: 100, left: 200 }} open={isOpen}>
 *   <FloatingMenuItem selected={index === 0} onClick={handleClick}>
 *     Option 1
 *   </FloatingMenuItem>
 * </FloatingMenu>
 * ```
 */

import { forwardRef, HTMLAttributes, ReactNode, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Portal } from '../Overlay/Portal';
import * as styles from './FloatingMenu.css';

export type FloatingMenuWidth = 'sm' | 'md' | 'lg';

export interface FloatingMenuProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  /**
   * Position of the floating menu (typically cursor position)
   */
  position: { top: number; left: number };
  /**
   * Whether the menu is open/visible
   */
  open?: boolean;
  /**
   * Width variant of the menu
   * @default 'md'
   */
  width?: FloatingMenuWidth;
  /**
   * Accessible label for the menu
   */
  ariaLabel?: string;
  /**
   * Menu contents
   */
  children: ReactNode;
}

export const FloatingMenu = forwardRef<HTMLDivElement, FloatingMenuProps>(function FloatingMenu(
  { position, open = true, width = 'md', ariaLabel, className, children, ...props },
  ref
) {
  if (!open) return null;

  return (
    <Portal>
      <div
        ref={ref}
        className={clsx(styles.container, styles.containerWidth[width], className)}
        style={{ top: position.top, left: position.left }}
        role="listbox"
        aria-label={ariaLabel}
        {...props}
      >
        {children}
      </div>
    </Portal>
  );
});

/**
 * FloatingMenuItem Component
 *
 * An interactive item within a FloatingMenu.
 * Supports selected state and click interaction.
 */
export interface FloatingMenuItemProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Whether this item is currently selected/highlighted
   */
  selected?: boolean;
  /**
   * Icon to display on the left side
   */
  icon?: ReactNode;
  /**
   * Icon shape variant
   * @default 'square'
   */
  iconShape?: 'square' | 'circle';
  /**
   * Icon color variant
   * @default 'default'
   */
  iconVariant?: 'default' | 'accent' | 'warning' | 'muted';
  /**
   * Item content
   */
  children: ReactNode;
}

export const FloatingMenuItem = forwardRef<HTMLDivElement, FloatingMenuItemProps>(
  function FloatingMenuItem(
    {
      selected = false,
      icon,
      iconShape = 'square',
      iconVariant = 'default',
      onClick,
      className,
      children,
      ...props
    },
    ref
  ) {
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

    return (
      <div
        ref={setRef}
        className={clsx(styles.item, selected && styles.itemSelected, className)}
        onClick={onClick}
        role="option"
        aria-selected={selected}
        {...props}
      >
        {icon && (
          <span
            className={clsx(
              styles.itemIcon,
              styles.itemIconShape[iconShape],
              styles.itemIconVariant[iconVariant]
            )}
          >
            {icon}
          </span>
        )}
        <span className={styles.itemText}>{children}</span>
      </div>
    );
  }
);

/**
 * FloatingMenuItemContent Component
 *
 * A compound content area with label and description for menu items.
 */
export interface FloatingMenuItemContentProps {
  /**
   * Primary label text
   */
  label: string;
  /**
   * Optional description text
   */
  description?: string;
}

export function FloatingMenuItemContent({ label, description }: FloatingMenuItemContentProps) {
  return (
    <div className={styles.itemText}>
      <div className={styles.itemLabel}>{label}</div>
      {description && <div className={styles.itemDescription}>{description}</div>}
    </div>
  );
}

/**
 * FloatingMenuEmpty Component
 *
 * Displayed when there are no items to show in the menu.
 */
export interface FloatingMenuEmptyProps {
  children?: ReactNode;
}

export function FloatingMenuEmpty({ children = 'No results' }: FloatingMenuEmptyProps) {
  return <div className={styles.emptyState}>{children}</div>;
}

/**
 * FloatingMenuLoading Component
 *
 * Displayed while the menu is loading data.
 */
export interface FloatingMenuLoadingProps {
  /**
   * Whether to show the spinner
   * @default true
   */
  showSpinner?: boolean;
  children?: ReactNode;
}

export function FloatingMenuLoading({
  showSpinner = true,
  children = 'Loading...',
}: FloatingMenuLoadingProps) {
  return (
    <div className={styles.loadingState}>
      {showSpinner && <span className={styles.spinner} />}
      {children}
    </div>
  );
}

/**
 * FloatingMenuDivider Component
 *
 * A horizontal divider between menu sections.
 */
export function FloatingMenuDivider() {
  return <div className={styles.divider} />;
}

/**
 * FloatingMenuSection Component
 *
 * A labeled section header for grouping menu items.
 */
export interface FloatingMenuSectionProps {
  /**
   * Section label text
   */
  label: string;
}

export function FloatingMenuSection({ label }: FloatingMenuSectionProps) {
  return <div className={styles.sectionLabel}>{label}</div>;
}

/**
 * FloatingMenuAction Component
 *
 * A special action item (e.g., "Create new...") separated from regular items.
 */
export interface FloatingMenuActionProps extends FloatingMenuItemProps {
  /**
   * Whether this is a "create" action that should be visually separated
   * @default true
   */
  separated?: boolean;
}

export const FloatingMenuAction = forwardRef<HTMLDivElement, FloatingMenuActionProps>(
  function FloatingMenuAction({ separated = true, className, ...props }, ref) {
    return (
      <FloatingMenuItem
        ref={ref}
        className={clsx(separated && styles.actionItem, className)}
        {...props}
      />
    );
  }
);
