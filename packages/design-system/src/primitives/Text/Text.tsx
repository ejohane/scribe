import { ElementType, ComponentPropsWithoutRef, Ref, ReactElement } from 'react';
import * as styles from './Text.css';
import clsx from 'clsx';

type TextElement = 'span' | 'p' | 'label' | 'div' | 'h1' | 'h2' | 'h3';
type TextColor = 'foreground' | 'foregroundMuted' | 'accent' | 'danger' | 'warning' | 'info';

interface TextOwnProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  weight?: 'regular' | 'medium' | 'bold';
  mono?: boolean;
  color?: TextColor;
  truncate?: boolean;
}

// Type helper to extract the element type for a given tag
type ElementRef<E extends ElementType> = E extends keyof HTMLElementTagNameMap
  ? HTMLElementTagNameMap[E]
  : E extends keyof SVGElementTagNameMap
    ? SVGElementTagNameMap[E]
    : Element;

// Props type that includes the polymorphic 'as' prop and proper ref typing
export type TextProps<E extends ElementType = TextElement> = TextOwnProps & {
  as?: E;
  ref?: Ref<ElementRef<E>>;
} & Omit<ComponentPropsWithoutRef<E>, keyof TextOwnProps | 'as'>;

// Polymorphic component type
type TextComponent = <E extends ElementType = 'span'>(props: TextProps<E>) => ReactElement;

// Internal implementation
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
      // Type assertion needed for polymorphic ref forwarding
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
};

export const Text: TextComponent = TextImpl;
