import { ElementType, ComponentPropsWithoutRef, Ref, ReactElement } from 'react';
import * as styles from './Text.css';
import clsx from 'clsx';

/** Allowed HTML elements for the Text component */
type TextElement = 'span' | 'p' | 'label' | 'div' | 'h1' | 'h2' | 'h3';

/** Available semantic color options for text */
type TextColor = 'foreground' | 'foregroundMuted' | 'accent' | 'danger' | 'warning' | 'info';

/**
 * Core props specific to the Text component (excluding polymorphic props).
 */
interface TextOwnProps {
  /** Font size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Font weight */
  weight?: 'regular' | 'medium' | 'bold';
  /** Use monospace font family */
  mono?: boolean;
  /** Semantic color for the text */
  color?: TextColor;
  /** Truncate text with ellipsis on overflow */
  truncate?: boolean;
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
export type TextProps<E extends ElementType = TextElement> = TextOwnProps & {
  as?: E;
  ref?: Ref<ElementRef<E>>;
} & Omit<ComponentPropsWithoutRef<E>, keyof TextOwnProps | 'as'>;

// Polymorphic component type
type TextComponent = <E extends ElementType = 'span'>(props: TextProps<E>) => ReactElement;

/**
 * Text component for rendering styled typography.
 *
 * A polymorphic component that renders text with consistent styling from the design system.
 * Supports semantic HTML elements via the `as` prop for proper document structure.
 *
 * Uses design tokens: `typography.fontFamily.ui`, `typography.fontFamily.mono`,
 * `typography.size.*`, `typography.weight.*`, `typography.lineHeight.*`, `color.*`
 *
 * @param size - Font size variant
 *   - `'xs'` - Extra small text (e.g., captions, timestamps)
 *   - `'sm'` - Small text (e.g., secondary info)
 *   - `'md'` - Medium text (default body text)
 *   - `'lg'` - Large text (e.g., subheadings)
 *   - `'xl'` - Extra large text (e.g., headings)
 * @param weight - Font weight
 *   - `'regular'` - Normal weight (default)
 *   - `'medium'` - Medium/semi-bold
 *   - `'bold'` - Bold
 * @param mono - Whether to use monospace font (for code, IDs, etc.)
 * @param color - Semantic color for the text
 *   - `'foreground'` - Primary text color
 *   - `'foregroundMuted'` - Secondary/muted text
 *   - `'accent'` - Accent/link color
 *   - `'danger'` - Error/danger text
 *   - `'warning'` - Warning text
 *   - `'info'` - Informational text
 * @param truncate - Whether to truncate with ellipsis on overflow
 * @param as - HTML element to render (defaults to 'span')
 * @param children - Text content
 *
 * @example
 * // Basic body text
 * <Text>Hello, world!</Text>
 *
 * @example
 * // Heading with semantic element
 * <Text as="h1" size="xl" weight="bold">
 *   Page Title
 * </Text>
 *
 * @example
 * // Muted caption text
 * <Text size="xs" color="foregroundMuted">
 *   Last updated 2 hours ago
 * </Text>
 *
 * @example
 * // Code/monospace text
 * <Text mono size="sm">
 *   const x = 42;
 * </Text>
 *
 * @example
 * // Truncated text in constrained width
 * <Text truncate style={{ maxWidth: 200 }}>
 *   This is a very long text that will be truncated
 * </Text>
 */
const TextImpl = <E extends ElementType = 'span'>({
  size = 'md',
  weight = 'regular',
  mono = false,
  color,
  as,
  truncate = false,
  className,
  children,
  ref,
  ...props
}: TextProps<E>): ReactElement => {
  const Component: ElementType = as || 'span';

  return (
    <Component
      // Type assertion for polymorphic ref forwarding - Element is the common base type
      ref={ref as PolymorphicRef}
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
};

export const Text: TextComponent = TextImpl;
