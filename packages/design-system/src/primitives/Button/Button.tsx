import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import * as styles from './Button.css';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'ghost' | 'subtle';
  tone?: 'accent' | 'neutral' | 'danger';
  size?: 'sm' | 'md';
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

const variantToneMap = {
  solid: {
    accent: styles.solidAccent,
    neutral: styles.solidNeutral,
    danger: styles.solidDanger,
  },
  ghost: {
    accent: styles.ghostAccent,
    neutral: styles.ghostNeutral,
    danger: styles.ghostDanger,
  },
  subtle: {
    accent: styles.subtleAccent,
    neutral: styles.subtleNeutral,
    danger: styles.subtleDanger,
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'solid',
    tone = 'neutral',
    size = 'md',
    iconLeft,
    iconRight,
    className,
    children,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(styles.base, styles.sizes[size], variantToneMap[variant][tone], className)}
      {...props}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
});
