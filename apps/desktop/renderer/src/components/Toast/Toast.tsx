/**
 * Toast notification component
 *
 * Displays toast notifications stacked at the bottom-center of the viewport.
 * Supports success (default) and error styles with slide animations.
 */

import type { Toast as ToastType } from '../../hooks/useToast';
import './Toast.css';

interface ToastProps {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
}

export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast${toast.type === 'error' ? ' toast--error' : ''}`}
          onClick={() => onDismiss(toast.id)}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
