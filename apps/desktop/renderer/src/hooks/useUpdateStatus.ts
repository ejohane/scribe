import { useState, useEffect, useCallback } from 'react';

interface UpdateStatus {
  status: 'idle' | 'checking' | 'downloading' | 'ready' | 'error';
  version?: string;
  error?: string;
}

export function useUpdateStatus() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubChecking = window.scribe.update.onChecking(() => {
      setUpdateStatus({ status: 'checking' });
    });

    const unsubAvailable = window.scribe.update.onAvailable((info) => {
      setUpdateStatus({ status: 'downloading', version: info.version });
    });

    const unsubNotAvailable = window.scribe.update.onNotAvailable(() => {
      setUpdateStatus({ status: 'idle' });
    });

    const unsubDownloaded = window.scribe.update.onDownloaded((info) => {
      setUpdateStatus({ status: 'ready', version: info.version });
      setDismissed(false); // Reset dismissed for new update
    });

    const unsubError = window.scribe.update.onError((error) => {
      setUpdateStatus({ status: 'error', error: error.message });
    });

    // Cleanup all subscriptions
    return () => {
      unsubChecking();
      unsubAvailable();
      unsubNotAvailable();
      unsubDownloaded();
      unsubError();
    };
  }, []);

  const installUpdate = useCallback(() => {
    window.scribe.update.install();
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  return {
    ...updateStatus,
    dismissed,
    installUpdate,
    dismiss,
    hasUpdate: updateStatus.status === 'ready',
  };
}
