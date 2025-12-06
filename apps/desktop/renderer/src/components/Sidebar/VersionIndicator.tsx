import { useState, useRef } from 'react';
import { useUpdateStatus } from '../../hooks/useUpdateStatus';
import { UpdatePopover } from './UpdatePopover';
import * as styles from './VersionIndicator.css';

// Get version from package.json at build time
declare const __APP_VERSION__: string;

export function VersionIndicator() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { hasUpdate, version: newVersion, installUpdate, dismiss } = useUpdateStatus();

  const handleClick = () => {
    if (hasUpdate) {
      setPopoverOpen(true);
    }
  };

  const handleClose = () => {
    setPopoverOpen(false);
    dismiss();
  };

  return (
    <div className={styles.container}>
      <button
        ref={triggerRef}
        className={styles.versionButton}
        onClick={handleClick}
        disabled={!hasUpdate}
        type="button"
      >
        <span className={styles.versionText}>v{__APP_VERSION__}</span>
        {hasUpdate && <span className={styles.updateBadge} />}
      </button>

      {popoverOpen && (
        <UpdatePopover
          version={newVersion!}
          triggerRef={triggerRef}
          onClose={handleClose}
          onInstall={installUpdate}
        />
      )}
    </div>
  );
}
