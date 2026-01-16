/**
 * ConnectionStatus component
 *
 * Displays the current connection status to the Scribe daemon.
 * Shows appropriate UI for connecting, error, and disconnected states.
 * When connected, nothing is displayed.
 */

import { type FC } from 'react';
import { useScribe } from '../providers/ScribeProvider';
import './ConnectionStatus.css';

/**
 * Props for ConnectionStatus component.
 */
export interface ConnectionStatusProps {
  /** Optional callback when retry button is clicked */
  onRetry?: () => void;
}

/**
 * Displays connection status with appropriate styling and retry functionality.
 *
 * - Shows "Connecting..." spinner when connecting
 * - Shows error message and retry button when connection fails
 * - Shows "Disconnected" message when not connected
 * - Shows nothing when connected
 *
 * @example
 * ```tsx
 * <ConnectionStatus onRetry={() => window.location.reload()} />
 * ```
 */
export const ConnectionStatus: FC<ConnectionStatusProps> = ({ onRetry }) => {
  const { status, error } = useScribe();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  if (status === 'connecting') {
    return (
      <div className="connection-status connecting" role="status" aria-live="polite">
        <span className="connection-status-spinner" aria-hidden="true" />
        <span>Connecting to Scribe daemon...</span>
      </div>
    );
  }

  if (status === 'error' || error) {
    return (
      <div className="connection-status error" role="alert">
        <span className="connection-status-icon" aria-hidden="true">
          !
        </span>
        <span className="connection-status-message">
          Connection failed: {error?.message ?? 'Unknown error'}
        </span>
        <button
          className="connection-status-retry"
          onClick={handleRetry}
          type="button"
          aria-label="Retry connection"
        >
          Retry
        </button>
      </div>
    );
  }

  if (status === 'disconnected') {
    return (
      <div className="connection-status disconnected" role="status" aria-live="polite">
        <span className="connection-status-icon" aria-hidden="true">
          ○
        </span>
        <span>Disconnected from daemon</span>
        <button
          className="connection-status-retry"
          onClick={handleRetry}
          type="button"
          aria-label="Reconnect"
        >
          Reconnect
        </button>
      </div>
    );
  }

  // Connected - show nothing
  return null;
};
