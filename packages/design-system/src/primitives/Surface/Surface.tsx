import { forwardRef, ElementType, ComponentPropsWithRef } from 'react';
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
  as?: ElementType;
}

type SurfaceProps<E extends ElementType = 'div'> = SurfaceOwnProps &
  Omit<ComponentPropsWithRef<E>, keyof SurfaceOwnProps>;

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  {
    variant = 'surface',
    elevation = 'none',
    padding,
    radius,
    bordered = false,
    as: Component = 'div',
    className,
    style,
    children,
    ...props
  },
  ref
) {
  return (
    <Component
      ref={ref}
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
});
