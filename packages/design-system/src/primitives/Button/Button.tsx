import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import * as styles from './Button.css';
import clsx from 'clsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'ghost' | 'subtle';
  tone?: 'accent' | 'neutral' | 'danger';
  size?: 'sm' | 'md';
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /**
   * Indicates the pressed state for toggle buttons.
   * Use for buttons that toggle between two states (e.g., bold, mute).
   * - true: button is pressed/active
   * - false: button is not pressed
   * - undefined: button is not a toggle button
   */
  'aria-pressed'?: boolean;
  /**
   * Indicates whether a disclosure button's controlled element is expanded.
   * Use for buttons that show/hide content (e.g., accordion, dropdown).
   * - true: controlled element is expanded
   * - false: controlled element is collapsed
   * - undefined: button does not control expandable content
   */
  'aria-expanded'?: boolean;
  /**
   * Indicates that the button is disabled for assistive technologies.
   * Prefer using the native `disabled` attribute when possible.
   * Use aria-disabled when you need the button to remain focusable while disabled
   * (e.g., to allow tooltip display on a disabled button).
   */
  'aria-disabled'?: boolean;
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
    disabled,
    'aria-pressed': ariaPressed,
    'aria-expanded': ariaExpanded,
    'aria-disabled': ariaDisabled,
    ...props
  },
  ref
) {
  // Compute aria-disabled: use explicit prop, or derive from disabled if not set
  const computedAriaDisabled = ariaDisabled ?? (disabled ? true : undefined);

  return (
    <button
      ref={ref}
      className={clsx(styles.base, styles.sizes[size], variantToneMap[variant][tone], className)}
      disabled={disabled}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      aria-disabled={computedAriaDisabled}
      {...props}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
});
