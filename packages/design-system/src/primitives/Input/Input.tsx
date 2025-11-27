import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import * as styles from './Input.css';
import clsx from 'clsx';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange'> {
  size?: 'sm' | 'md';
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', iconLeft, iconRight, value, onChange, error = false, className, ...props },
  ref
) {
  return (
    <div
      className={clsx(styles.wrapper, styles.sizes[size], error && styles.wrapperError, className)}
    >
      {iconLeft && <span className={styles.iconWrapper}>{iconLeft}</span>}
      <input
        ref={ref}
        className={clsx(styles.input, size === 'sm' && styles.inputSm)}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        {...props}
      />
      {iconRight && <span className={styles.iconWrapper}>{iconRight}</span>}
    </div>
  );
});
