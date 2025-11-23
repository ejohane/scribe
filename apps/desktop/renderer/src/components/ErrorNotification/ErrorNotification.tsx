/**
 * Error notification component
 *
 * Displays error messages to the user in a non-intrusive way
 */

import { useEffect } from 'react';
import './ErrorNotification.css';

interface ErrorNotificationProps {
  error: string | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function ErrorNotification({
  error,
  onDismiss,
  autoDismissMs = 5000,
}: ErrorNotificationProps) {
  useEffect(() => {
    if (error && autoDismissMs > 0) {
      const timer = setTimeout(onDismiss, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [error, onDismiss, autoDismissMs]);

  if (!error) return null;

  return (
    <div className="error-notification">
      <div className="error-notification-content">
        <span className="error-notification-icon">⚠️</span>
        <span className="error-notification-message">{error}</span>
        <button className="error-notification-close" onClick={onDismiss} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  );
}
