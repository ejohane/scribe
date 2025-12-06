import { useEffect, useRef, type RefObject } from 'react';
import { Button } from '@scribe/design-system';
import * as styles from './UpdatePopover.css';

interface UpdatePopoverProps {
  version: string;
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onInstall: () => void;
}

export function UpdatePopover({ version, triggerRef, onClose, onInstall }: UpdatePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, triggerRef]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div ref={popoverRef} className={styles.popover}>
      <div className={styles.header}>Update Available</div>
      <p className={styles.message}>Version {version} is ready to install.</p>
      <Button onClick={onInstall} variant="solid" tone="accent" size="sm" className={styles.button}>
        Restart Now
      </Button>
    </div>
  );
}
