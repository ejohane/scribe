import { ElementType, ComponentPropsWithoutRef, Ref, ReactElement } from 'react';
import * as styles from './Surface.css';
import { vars } from '../../tokens/contract.css';
import clsx from 'clsx';

/** Available spacing token keys for padding */
type SpacingKey = keyof typeof vars.spacing;

/**
 * Core props specific to the Surface component (excluding polymorphic props).
 */
interface SurfaceOwnProps {
  /** Background color variant */
  variant?: 'surface' | 'background' | 'backgroundAlt';
  /** Box shadow elevation level */
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  /** Padding using spacing tokens */
  padding?: SpacingKey;
  /** Border radius size */
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  /** Whether to show a border */
  bordered?: boolean;
}

// Type helper to extract the element type for a given tag
type ElementRef<E extends ElementType> = E extends keyof HTMLElementTagNameMap
  ? HTMLElementTagNameMap[E]
  : E extends keyof SVGElementTagNameMap
    ? SVGElementTagNameMap[E]
    : Element;

// Type-safe ref type for polymorphic components
// Uses Element as the base type since all HTML/SVG elements extend Element
type PolymorphicRef = Ref<Element>;

// Props type that includes the polymorphic 'as' prop and proper ref typing
export type SurfaceProps<E extends ElementType = 'div'> = SurfaceOwnProps & {
  as?: E;
  ref?: Ref<ElementRef<E>>;
} & Omit<ComponentPropsWithoutRef<E>, keyof SurfaceOwnProps | 'as'>;

// Polymorphic component type
type SurfaceComponent = <E extends ElementType = 'div'>(props: SurfaceProps<E>) => ReactElement;

/**
 * Surface component for creating container elements with consistent styling.
 *
 * A polymorphic component that provides background colors, elevation (shadows),
 * padding, borders, and border radius from the design system tokens.
 * Ideal for cards, panels, modals, and other container elements.
 *
 * Uses design tokens: `color.surface`, `color.background`, `color.backgroundAlt`,
 * `color.border`, `shadow.*`, `radius.*`, `spacing.*`
 *
 * @param variant - Background color variant
 *   - `'surface'` - Elevated surface color (default, for cards/panels)
 *   - `'background'` - Base background color
 *   - `'backgroundAlt'` - Alternative/muted background
 * @param elevation - Box shadow depth
 *   - `'none'` - No shadow (default)
 *   - `'sm'` - Subtle shadow
 *   - `'md'` - Medium shadow (cards)
 *   - `'lg'` - Large shadow (modals, dropdowns)
 * @param padding - Inner padding using spacing tokens (e.g., '4', '8', '16')
 * @param radius - Border radius
 *   - `'none'` - No rounding
 *   - `'sm'` - Small radius
 *   - `'md'` - Medium radius
 *   - `'lg'` - Large radius
 *   - `'full'` - Fully rounded (pill shape)
 * @param bordered - Whether to render a 1px border
 * @param as - HTML element to render (defaults to 'div')
 * @param children - Surface content
 *
 * @example
 * // Basic card with elevation and padding
 * <Surface variant="surface" elevation="md" padding="4" radius="md">
 *   <Text>Card content</Text>
 * </Surface>
 *
 * @example
 * // Bordered panel with alt background
 * <Surface variant="backgroundAlt" bordered radius="sm" padding="3">
 *   <Text color="foregroundMuted">Info panel</Text>
 * </Surface>
 *
 * @example
 * // Modal/dialog container
 * <Surface elevation="lg" radius="lg" padding="6">
 *   <Text as="h2" size="lg" weight="bold">Dialog Title</Text>
 *   <Text>Dialog content goes here.</Text>
 * </Surface>
 *
 * @example
 * // As a semantic element
 * <Surface as="section" padding="4" radius="md">
 *   <Text as="h3">Section Title</Text>
 * </Surface>
 */
const SurfaceImpl = <E extends ElementType = 'div'>({
  variant = 'surface',
  elevation = 'none',
  padding,
  radius,
  bordered = false,
  as,
  className,
  style,
  children,
  ref,
  ...props
}: SurfaceProps<E>): ReactElement => {
  const Component: ElementType = as || 'div';

  return (
    <Component
      // Type assertion for polymorphic ref forwarding - Element is the common base type
      ref={ref as PolymorphicRef}
      className={clsx(
        styles.base,
        styles.variants[variant],
        styles.elevations[elevation],
        radius && styles.radii[radius],
        bordered && styles.bordered,
        className
      )}
      style={{
        ...style,
        ...(padding ? { padding: vars.spacing[padding] } : {}),
      }}
      {...props}
    >
      {children}
    </Component>
  );
};

export const Surface: SurfaceComponent = SurfaceImpl;
