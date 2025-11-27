import { forwardRef, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import * as styles from './Input.css';
import clsx from 'clsx';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** Convenience callback that receives the input value directly */
  onValueChange?: (value: string) => void;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', iconLeft, iconRight, onChange, onValueChange, error = false, className, ...props },
  ref
) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onValueChange?.(e.target.value);
  };

  return (
    <div
      className={clsx(styles.wrapper, styles.sizes[size], error && styles.wrapperError, className)}
    >
      {iconLeft && <span className={styles.iconWrapper}>{iconLeft}</span>}
      <input
        ref={ref}
        className={clsx(styles.input, size === 'sm' && styles.inputSm)}
        onChange={handleChange}
        {...props}
      />
      {iconRight && <span className={styles.iconWrapper}>{iconRight}</span>}
    </div>
  );
});
