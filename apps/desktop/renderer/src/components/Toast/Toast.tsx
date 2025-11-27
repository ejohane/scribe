/**
 * Toast notification component
 *
 * Displays toast notifications stacked at the bottom-center of the viewport.
 * Supports success (default) and error styles with slide animations.
 */

import { Text } from '@scribe/design-system';
import type { Toast as ToastType } from '../../hooks/useToast';
import * as styles from './Toast.css';

interface ToastProps {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
}

export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className={styles.container} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles.toastVariants[toast.type === 'error' ? 'error' : 'success']}`}
          onClick={() => onDismiss(toast.id)}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        >
          <Text size="sm" as="span">
            {toast.message}
          </Text>
        </div>
      ))}
    </div>
  );
}
