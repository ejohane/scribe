/**
 * Navigation buttons component for back/forward note navigation
 *
 * Displays back and forward buttons for browser-style navigation
 * through the note history stack.
 */

import { Button, ArrowLeftIcon, ArrowRightIcon } from '@scribe/design-system';
import * as styles from './NavigationButtons.css';

interface NavigationButtonsProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}

export function NavigationButtons({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: NavigationButtonsProps) {
  return (
    <div className={styles.container}>
      <Button
        variant="ghost"
        tone="neutral"
        size="sm"
        className={styles.button}
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Go back to previous note"
        title="Go back (Cmd+[)"
        type="button"
      >
        <ArrowLeftIcon size={16} />
      </Button>
      <Button
        variant="ghost"
        tone="neutral"
        size="sm"
        className={styles.button}
        onClick={onForward}
        disabled={!canGoForward}
        aria-label="Go forward to next note"
        title="Go forward (Cmd+])"
        type="button"
      >
        <ArrowRightIcon size={16} />
      </Button>
    </div>
  );
}
