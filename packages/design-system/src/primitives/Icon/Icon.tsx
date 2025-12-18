import { forwardRef, HTMLAttributes } from 'react';
import * as styles from './Icon.css';
import clsx from 'clsx';

/** Available semantic color options for icons */
type IconColor = 'foreground' | 'foregroundMuted' | 'accent' | 'danger' | 'warning' | 'info';

/**
 * Props for the Icon component.
 *
 * Extends native span attributes with design system styling options.
 */
export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  /** Icon size (controls both width and height) */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Semantic color for the icon */
  color?: IconColor;
  /** SVG icon element to render */
  children: React.ReactNode;
}

/**
 * Icon component for displaying SVG icons with consistent sizing and colors.
 *
 * Wraps SVG icons in a span element with proper sizing and color inheritance.
 * Automatically sets `aria-hidden="true"` since icons are typically decorative.
 * For icons that convey meaning, override with an accessible label.
 *
 * Uses design tokens: `component.icon.xs/sm/md/lg`, `color.*`
 *
 * @param size - Icon size
 *   - `'xs'` - 12px (inline text icons)
 *   - `'sm'` - 16px (compact UI)
 *   - `'md'` - 20px (default, buttons)
 *   - `'lg'` - 24px (larger UI elements)
 * @param color - Semantic color for the icon
 *   - `'foreground'` - Primary color
 *   - `'foregroundMuted'` - Secondary/muted color
 *   - `'accent'` - Accent/brand color
 *   - `'danger'` - Error/danger indicator
 *   - `'warning'` - Warning indicator
 *   - `'info'` - Informational indicator
 * @param children - SVG icon element (e.g., from an icon library)
 *
 * @example
 * // Basic icon in a button
 * <Button variant="ghost">
 *   <Icon size="md"><PlusIcon /></Icon>
 *   Add Item
 * </Button>
 *
 * @example
 * // Colored status icon
 * <Icon size="sm" color="danger">
 *   <AlertCircleIcon />
 * </Icon>
 *
 * @example
 * // Muted decorative icon
 * <Icon size="xs" color="foregroundMuted">
 *   <ChevronRightIcon />
 * </Icon>
 *
 * @example
 * // Accessible icon with label (override aria-hidden)
 * <Icon size="md" aria-hidden={false} aria-label="Settings">
 *   <SettingsIcon />
 * </Icon>
 */
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
