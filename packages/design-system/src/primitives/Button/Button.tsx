import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import * as styles from './Button.css';
import clsx from 'clsx';

/**
 * Props for the Button component.
 *
 * Extends native button attributes with design system variants.
 */
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

/**
 * Button component for triggering actions and interactions.
 *
 * Supports multiple visual variants and tones for different use cases.
 * Includes built-in accessibility support for toggle buttons and expandable controls.
 *
 * Uses design tokens: `color.accent`, `color.surface`, `color.danger`,
 * `spacing.2-4`, `radius.md`, `typography.weight.medium`
 *
 * @param variant - Visual style of the button
 *   - `'solid'` - Filled background (default)
 *   - `'ghost'` - Transparent background, colored text
 *   - `'subtle'` - Light background with colored text
 * @param tone - Color tone for the button
 *   - `'neutral'` - Default neutral colors (default)
 *   - `'accent'` - Primary accent color
 *   - `'danger'` - Destructive action indicator
 * @param size - Button size
 *   - `'sm'` - Small (28px height)
 *   - `'md'` - Medium (36px height, default)
 * @param iconLeft - Icon element to render before children
 * @param iconRight - Icon element to render after children
 * @param disabled - Whether the button is disabled
 * @param children - Button content (text, icons, etc.)
 *
 * @example
 * // Primary action button
 * <Button variant="solid" tone="accent" onClick={handleSave}>
 *   Save Changes
 * </Button>
 *
 * @example
 * // Ghost button with icon
 * <Button variant="ghost" tone="neutral" iconLeft={<Icon><SettingsIcon /></Icon>}>
 *   Settings
 * </Button>
 *
 * @example
 * // Danger button for destructive actions
 * <Button variant="solid" tone="danger" onClick={handleDelete}>
 *   Delete
 * </Button>
 *
 * @example
 * // Toggle button (e.g., bold formatting)
 * <Button variant="ghost" aria-pressed={isBold} onClick={toggleBold}>
 *   <BoldIcon />
 * </Button>
 */
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
