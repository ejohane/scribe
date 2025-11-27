import { forwardRef, LiHTMLAttributes, ReactNode } from 'react';
import * as styles from './List.css';
import clsx from 'clsx';

export interface ListItemProps extends LiHTMLAttributes<HTMLLIElement> {
  selected?: boolean;
  active?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  disabled?: boolean;
  children: ReactNode;
}

export const ListItem = forwardRef<HTMLLIElement, ListItemProps>(function ListItem(
  {
    selected = false,
    active = false,
    iconLeft,
    iconRight,
    disabled = false,
    onClick,
    className,
    children,
    ...props
  },
  ref
) {
  return (
    <li
      ref={ref}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      className={clsx(
        styles.listItem,
        active && styles.listItemActive,
        selected && styles.listItemSelected,
        disabled && styles.listItemDisabled,
        className
      )}
      onClick={disabled ? undefined : onClick}
      {...props}
    >
      {iconLeft && <span className={styles.iconWrapper}>{iconLeft}</span>}
      <span className={styles.content}>{children}</span>
      {iconRight && <span className={clsx(styles.iconWrapper, styles.iconRight)}>{iconRight}</span>}
    </li>
  );
});
