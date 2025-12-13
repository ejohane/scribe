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
  /**
   * Accessible label for the input when a visible label is not present.
   * Use either aria-label or aria-labelledby, not both.
   */
  'aria-label'?: string;
  /**
   * ID of the element that labels the input.
   * Use either aria-label or aria-labelledby, not both.
   */
  'aria-labelledby'?: string;
  /**
   * ID of the element that describes the input (e.g., help text or error message).
   */
  'aria-describedby'?: string;
  /**
   * Indicates whether the input value is invalid.
   * When true, assistive technologies will announce the input as invalid.
   * Automatically set to true when error prop is true if not explicitly provided.
   */
  'aria-invalid'?: boolean;
  /**
   * Indicates whether the input is required.
   * Provides additional context for assistive technologies.
   */
  'aria-required'?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = 'md',
    iconLeft,
    iconRight,
    onChange,
    onValueChange,
    error = false,
    className,
    'aria-invalid': ariaInvalid,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    'aria-describedby': ariaDescribedby,
    'aria-required': ariaRequired,
    ...props
  },
  ref
) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onValueChange?.(e.target.value);
  };

  // Default aria-invalid to true when error is true, unless explicitly set
  const computedAriaInvalid = ariaInvalid ?? (error ? true : undefined);

  return (
    <div
      className={clsx(styles.wrapper, styles.sizes[size], error && styles.wrapperError, className)}
    >
      {iconLeft && <span className={styles.iconWrapper}>{iconLeft}</span>}
      <input
        ref={ref}
        className={clsx(styles.input, size === 'sm' && styles.inputSm)}
        onChange={handleChange}
        aria-invalid={computedAriaInvalid}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        aria-required={ariaRequired}
        {...props}
      />
      {iconRight && <span className={styles.iconWrapper}>{iconRight}</span>}
    </div>
  );
});
