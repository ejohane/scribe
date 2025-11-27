import { ElementType, ComponentPropsWithoutRef, Ref, ReactElement } from 'react';
import * as styles from './Surface.css';
import { vars } from '../../tokens/contract.css';
import clsx from 'clsx';

type SpacingKey = keyof typeof vars.spacing;

interface SurfaceOwnProps {
  variant?: 'surface' | 'background' | 'backgroundAlt';
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  padding?: SpacingKey;
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  bordered?: boolean;
}

// Type helper to extract the element type for a given tag
type ElementRef<E extends ElementType> = E extends keyof HTMLElementTagNameMap
  ? HTMLElementTagNameMap[E]
  : E extends keyof SVGElementTagNameMap
    ? SVGElementTagNameMap[E]
    : Element;

// Props type that includes the polymorphic 'as' prop and proper ref typing
export type SurfaceProps<E extends ElementType = 'div'> = SurfaceOwnProps & {
  as?: E;
  ref?: Ref<ElementRef<E>>;
} & Omit<ComponentPropsWithoutRef<E>, keyof SurfaceOwnProps | 'as'>;

// Polymorphic component type
type SurfaceComponent = <E extends ElementType = 'div'>(props: SurfaceProps<E>) => ReactElement;

// Internal implementation
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
      // Type assertion needed for polymorphic ref forwarding
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
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
