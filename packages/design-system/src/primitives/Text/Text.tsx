import { forwardRef, type ReactNode } from 'react';
import * as styles from './Text.css';
import clsx from 'clsx';

type TextElement = 'span' | 'p' | 'label' | 'div' | 'h1' | 'h2' | 'h3';
type TextColor = 'foreground' | 'foregroundMuted' | 'accent' | 'danger' | 'warning' | 'info';

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  weight?: 'regular' | 'medium' | 'bold';
  mono?: boolean;
  color?: TextColor;
  as?: TextElement;
  truncate?: boolean;
  children?: ReactNode;
}

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  {
    size = 'md',
    weight = 'regular',
    mono = false,
    color,
    as: Component = 'span',
    truncate = false,
    className,
    children,
    ...props
  },
  ref
) {
  return (
    <Component
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={clsx(
        styles.base,
        styles.sizes[size],
        styles.weights[weight],
        mono && styles.mono,
        color && styles.colors[color],
        truncate && styles.truncate,
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
});
