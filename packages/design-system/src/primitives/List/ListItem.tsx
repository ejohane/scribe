import { forwardRef, LiHTMLAttributes, ReactNode, KeyboardEvent } from 'react';
import * as styles from './List.css';
import clsx from 'clsx';

export interface ListItemProps extends LiHTMLAttributes<HTMLLIElement> {
  selected?: boolean;
  active?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  disabled?: boolean;
  children: ReactNode;
  /**
   * The ARIA role for the list item.
   * Defaults to "option" for use in listbox contexts.
   * Use "listitem" for standard list semantics.
   * Use "menuitem" for menu contexts.
   */
  role?: 'option' | 'listitem' | 'menuitem';
}

export const ListItem = forwardRef<HTMLLIElement, ListItemProps>(function ListItem(
  {
    selected = false,
    active = false,
    iconLeft,
    iconRight,
    disabled = false,
    onClick,
    onKeyDown,
    className,
    children,
    role = 'option',
    tabIndex,
    ...props
  },
  ref
) {
  /**
   * Handle keyboard interaction for list items.
   * Enter and Space keys trigger the click handler when not disabled.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    onKeyDown?.(event);

    if (disabled) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      // Create a synthetic mouse event for the click handler
      onClick?.(event as unknown as React.MouseEvent<HTMLLIElement>);
    }
  };

  // Compute tabIndex: disabled items should not be focusable
  // Default to 0 (focusable) for enabled items with click handlers
  const computedTabIndex = tabIndex ?? (disabled ? -1 : onClick ? 0 : undefined);

  return (
    <li
      ref={ref}
      role={role}
      aria-selected={selected}
      aria-disabled={disabled}
      tabIndex={computedTabIndex}
      className={clsx(
        styles.listItem,
        active && styles.listItemActive,
        selected && styles.listItemSelected,
        disabled && styles.listItemDisabled,
        className
      )}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {iconLeft && <span className={styles.iconWrapper}>{iconLeft}</span>}
      <span className={styles.content}>{children}</span>
      {iconRight && <span className={clsx(styles.iconWrapper, styles.iconRight)}>{iconRight}</span>}
    </li>
  );
});
