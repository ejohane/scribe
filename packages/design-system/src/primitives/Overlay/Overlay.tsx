import { forwardRef, HTMLAttributes, ReactNode, useEffect, useCallback } from 'react';
import * as styles from './Overlay.css';
import { Portal } from './Portal';
import clsx from 'clsx';

export interface OverlayProps extends HTMLAttributes<HTMLDivElement> {
  backdrop?: 'none' | 'transparent' | 'blur';
  open?: boolean;
  onClose?: () => void;
  /**
   * Whether pressing Escape should trigger onClose.
   * Set to false when the consumer handles Escape key behavior itself.
   * @default true
   */
  closeOnEscape?: boolean;
  /**
   * ID of the element that labels the dialog (for accessibility).
   * Should reference the dialog's title element.
   */
  ariaLabelledby?: string;
  /**
   * ID of the element that describes the dialog content (for accessibility).
   * Should reference a description or main content element.
   */
  ariaDescribedby?: string;
  children: ReactNode;
}

export const Overlay = forwardRef<HTMLDivElement, OverlayProps>(function Overlay(
  {
    backdrop = 'none',
    open = true,
    onClose,
    closeOnEscape = true,
    ariaLabelledby,
    ariaDescribedby,
    className,
    children,
    onClick,
    ...props
  },
  ref
) {
  // Handle Escape key
  useEffect(() => {
    if (!open || !onClose || !closeOnEscape) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, closeOnEscape]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Only close if clicking the backdrop itself, not children
      if (event.target === event.currentTarget && onClose) {
        onClose();
      }
      onClick?.(event);
    },
    [onClose, onClick]
  );

  if (!open) {
    return null;
  }

  return (
    <Portal>
      <div
        ref={ref}
        className={clsx(styles.overlay, styles.backdrop[backdrop], className)}
        onClick={handleBackdropClick}
        {...props}
      >
        <div
          className={styles.content}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledby}
          aria-describedby={ariaDescribedby}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
});
