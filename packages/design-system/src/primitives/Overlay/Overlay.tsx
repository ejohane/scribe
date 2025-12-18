import { forwardRef, HTMLAttributes, ReactNode, useEffect, useCallback } from 'react';
import * as styles from './Overlay.css';
import { Portal } from './Portal';
import clsx from 'clsx';

/**
 * Props for the Overlay component.
 *
 * Extends native div attributes with overlay-specific behavior options.
 */
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

/**
 * Overlay component for modal dialogs, drawers, and full-screen overlays.
 *
 * Renders content in a Portal with backdrop support, scroll locking, and
 * automatic keyboard handling. Implements the ARIA dialog pattern with
 * proper focus management considerations.
 *
 * Uses design tokens: `color.background` (backdrop), CSS blur filter
 *
 * @param backdrop - Visual style of the backdrop
 *   - `'none'` - No backdrop (default)
 *   - `'transparent'` - Invisible backdrop (catches clicks)
 *   - `'blur'` - Blurred backdrop effect
 * @param open - Whether the overlay is visible (defaults to true)
 * @param onClose - Callback when overlay should close (backdrop click or Escape)
 * @param closeOnEscape - Whether Escape key triggers onClose (defaults to true)
 * @param ariaLabelledby - ID of the element labeling the dialog (for accessibility)
 * @param ariaDescribedby - ID of the element describing the dialog (for accessibility)
 * @param children - Overlay content (typically a Surface with dialog content)
 *
 * @example
 * // Basic modal dialog
 * <Overlay open={isOpen} onClose={() => setIsOpen(false)} backdrop="blur">
 *   <Surface elevation="lg" padding="6" radius="lg">
 *     <Text as="h2" id="dialog-title" size="lg" weight="bold">
 *       Confirm Action
 *     </Text>
 *     <Text id="dialog-desc">Are you sure you want to proceed?</Text>
 *     <Button onClick={() => setIsOpen(false)}>Cancel</Button>
 *     <Button tone="accent" onClick={handleConfirm}>Confirm</Button>
 *   </Surface>
 * </Overlay>
 *
 * @example
 * // Accessible dialog with proper ARIA
 * <Overlay
 *   open={showDialog}
 *   onClose={handleClose}
 *   backdrop="blur"
 *   ariaLabelledby="modal-title"
 *   ariaDescribedby="modal-description"
 * >
 *   <Surface elevation="lg" padding="6" radius="lg">
 *     <Text as="h2" id="modal-title">Edit Profile</Text>
 *     <Text id="modal-description">Update your profile information.</Text>
 *     {/* form content *\/}
 *   </Surface>
 * </Overlay>
 *
 * @example
 * // Overlay with custom Escape handling (e.g., for multi-step flows)
 * <Overlay open={true} closeOnEscape={false} onClose={handleClose}>
 *   <WizardComponent onEscape={handleStepBack} />
 * </Overlay>
 */
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
