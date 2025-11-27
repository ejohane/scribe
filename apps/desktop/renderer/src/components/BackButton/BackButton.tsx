/**
 * Back navigation button component
 *
 * Displays a back button in the upper-left corner of the editor
 * to navigate to previously viewed notes in the navigation history.
 */

import './BackButton.css';

interface BackButtonProps {
  visible: boolean;
  onClick: () => void;
}

export function BackButton({ visible, onClick }: BackButtonProps) {
  if (!visible) return null;

  return (
    <button
      className="back-button"
      onClick={onClick}
      aria-label="Go back to previous note"
      title="Go back (⌘[)"
      type="button"
    >
      ←
    </button>
  );
}
