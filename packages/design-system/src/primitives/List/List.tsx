import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import * as styles from './List.css';
import clsx from 'clsx';

interface ListProps extends HTMLAttributes<HTMLUListElement> {
  children: ReactNode;
}

export const List = forwardRef<HTMLUListElement, ListProps>(function List(
  { children, className, ...props },
  ref
) {
  return (
    <ul ref={ref} role="listbox" className={clsx(styles.list, className)} {...props}>
      {children}
    </ul>
  );
});
