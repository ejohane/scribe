import { forwardRef, HTMLAttributes } from 'react';
import * as styles from './Icon.css';
import clsx from 'clsx';

type IconColor = 'foreground' | 'foregroundMuted' | 'accent' | 'danger' | 'warning' | 'info';

interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: IconColor;
  children: React.ReactNode;
}

export const Icon = forwardRef<HTMLSpanElement, IconProps>(function Icon(
  { size = 'md', color, className, children, ...props },
  ref
) {
  return (
    <span
      ref={ref}
      className={clsx(styles.base, styles.sizes[size], color && styles.colors[color], className)}
      aria-hidden="true"
      {...props}
    >
      {children}
    </span>
  );
});
