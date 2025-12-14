/**
 * UpdateToast component
 *
 * Displays a dismissable toast notification when a new app version is available.
 * Positioned at the bottom-right of the viewport with a card-style design.
 */

import { useState, useCallback } from 'react';
import { Button } from '@scribe/design-system';
import { useUpdateStatus } from '../../hooks/useUpdateStatus';
import * as styles from './UpdateToast.css';

export function UpdateToast() {
  const { hasUpdate, version, installUpdate, dismiss, dismissed } = useUpdateStatus();
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    // Wait for animation to complete before dismissing
    setTimeout(() => {
      dismiss();
      setIsExiting(false);
    }, 200);
  }, [dismiss]);

  if (!hasUpdate || dismissed) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={`${styles.card} ${isExiting ? styles.cardExiting : ''}`}>
        <div className={styles.header}>
          <h4 className={styles.title}>Update Available</h4>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleDismiss}
            aria-label="Dismiss update notification"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M11 3L3 11M3 3L11 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className={styles.message}>Version {version} is ready to install.</p>
        <Button
          onClick={installUpdate}
          variant="solid"
          tone="accent"
          size="sm"
          className={styles.button}
        >
          Restart Now
        </Button>
      </div>
    </div>
  );
}
