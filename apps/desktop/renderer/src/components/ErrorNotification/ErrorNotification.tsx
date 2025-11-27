/**
 * Error notification component
 *
 * Displays error messages to the user in a non-intrusive way
 */

import { useEffect } from 'react';
import { Surface, Text, Icon, Button } from '@scribe/design-system';
import * as styles from './ErrorNotification.css';

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
    <div className={styles.container}>
      <Surface elevation="sm" padding="4" radius="md" bordered className={styles.content}>
        <Icon size="md" color="danger" className={styles.icon}>
          <span>⚠️</span>
        </Icon>
        <Text size="sm" color="danger" className={styles.message}>
          {error}
        </Text>
        <Button
          variant="ghost"
          tone="danger"
          size="sm"
          onClick={onDismiss}
          aria-label="Close"
          className={styles.closeButton}
        >
          ×
        </Button>
      </Surface>
    </div>
  );
}
