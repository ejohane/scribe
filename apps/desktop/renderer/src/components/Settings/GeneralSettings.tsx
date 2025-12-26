/**
 * GeneralSettings Component
 *
 * Main settings section containing Vault Location, Version, and Theme settings.
 * Each setting is organized in a SettingsGroup for consistent layout.
 */

import type { ReactNode } from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Button, SegmentedControl, useTheme, Overlay, Surface, Text } from '@scribe/design-system';
import { useVaultPath } from '../../hooks/useVaultPath';
import { useUpdateStatus } from '../../hooks/useUpdateStatus';
import * as styles from './GeneralSettings.css';

interface SettingsGroupProps {
  /** Title of the settings group */
  title: string;
  /** Optional description text */
  description?: string;
  /** Content to render in the group */
  children: ReactNode;
}

/**
 * Reusable container for grouping related settings
 */
function SettingsGroup({ title, description, children }: SettingsGroupProps) {
  return (
    <section className={styles.settingsGroup}>
      <div className={styles.settingsGroupHeader}>
        <h3 className={styles.settingsGroupTitle}>{title}</h3>
        {description && <p className={styles.settingsGroupDescription}>{description}</p>}
      </div>
      <div className={styles.settingsGroupContent}>{children}</div>
    </section>
  );
}

/**
 * Restart Dialog component
 * Shows a modal asking the user to restart the app after vault change
 */
interface RestartDialogProps {
  onRestartNow: () => void;
  onLater: () => void;
}

function RestartDialog({ onRestartNow, onLater }: RestartDialogProps) {
  return (
    <Overlay
      open
      onClose={onLater}
      backdrop="blur"
      ariaLabelledby="restart-dialog-title"
      ariaDescribedby="restart-dialog-description"
    >
      <Surface elevation="lg" padding="6" radius="lg" className={styles.restartDialog}>
        <Text as="h2" id="restart-dialog-title" size="lg" weight="bold">
          Restart Required
        </Text>
        <Text id="restart-dialog-description" color="foregroundMuted">
          Scribe needs to restart to use the new vault.
        </Text>
        <div className={styles.restartDialogButtons}>
          <Button variant="subtle" onClick={onLater}>
            Later
          </Button>
          <Button variant="solid" tone="accent" onClick={onRestartNow}>
            Restart Now
          </Button>
        </div>
      </Surface>
    </Overlay>
  );
}

/**
 * Vault Location setting
 * Displays the current vault path with Change and Create New buttons for vault management.
 */
function VaultLocationSetting() {
  const { path, isLoading, error: pathError, refresh, createVault } = useVaultPath();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleChangeVault = useCallback(async () => {
    setValidationError(null);
    setIsChanging(true);

    try {
      // Open folder picker
      const selectedPath = await window.scribe.dialog.selectFolder({
        title: 'Select Scribe Vault',
        defaultPath: path || undefined,
      });

      if (!selectedPath) {
        // User cancelled
        setIsChanging(false);
        return;
      }

      // Validate and set path (handler does validation)
      const result = await window.scribe.vault.setPath(selectedPath);

      if (!result.success) {
        setValidationError(result.error || 'Failed to switch vault');
        setIsChanging(false);
        return;
      }

      // Show restart dialog
      if (result.requiresRestart) {
        setShowRestartDialog(true);
      }
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to switch vault');
    } finally {
      setIsChanging(false);
    }
  }, [path]);

  const handleCreateVault = useCallback(async () => {
    setValidationError(null);
    setIsCreating(true);

    try {
      // Open folder picker for new vault location
      const selectedPath = await window.scribe.dialog.selectFolder({
        title: 'Choose Location for New Vault',
      });

      if (!selectedPath) {
        // User cancelled
        setIsCreating(false);
        return;
      }

      // Create the new vault
      const result = await createVault(selectedPath);

      if (!result.success) {
        setValidationError(result.error || 'Failed to create vault');
        setIsCreating(false);
        return;
      }

      // Show restart dialog (vault:create sets config and requires restart)
      setShowRestartDialog(true);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to create vault');
    } finally {
      setIsCreating(false);
    }
  }, [createVault]);

  const handleRestartNow = useCallback(() => {
    window.scribe.app.relaunch();
  }, []);

  const handleRestartLater = useCallback(() => {
    setShowRestartDialog(false);
    // Refresh to show the new path that will be used after restart
    refresh();
  }, [refresh]);

  // Determine if any operation is in progress
  const isBusy = isChanging || isCreating;

  if (isLoading && !path) {
    return (
      <div>
        <span className={styles.placeholder}>Loading vault path...</span>
      </div>
    );
  }

  if (pathError) {
    return (
      <div>
        <span className={styles.placeholder}>{pathError}</span>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.vaultPath}>{path}</div>
      {validationError && <div className={styles.errorMessage}>{validationError}</div>}
      <div className={styles.buttonGroup}>
        <Button variant="subtle" onClick={handleChangeVault} disabled={isBusy}>
          {isChanging ? 'Selecting...' : 'Change'}
        </Button>
        <Button variant="subtle" onClick={handleCreateVault} disabled={isBusy}>
          {isCreating ? 'Creating...' : 'Create New'}
        </Button>
      </div>
      {showRestartDialog && (
        <RestartDialog onRestartNow={handleRestartNow} onLater={handleRestartLater} />
      )}
    </div>
  );
}

/**
 * Version setting
 * Displays current app version and provides update checking functionality.
 * Uses the useUpdateStatus hook to manage update state.
 */
function VersionSetting() {
  const { status, version, error, installUpdate } = useUpdateStatus();
  const [lastCheckResult, setLastCheckResult] = useState<'up-to-date' | null>(null);
  const lastStatusRef = useRef(status);

  // Track when checking completes without finding an update
  useEffect(() => {
    if (lastStatusRef.current === 'checking' && status === 'idle') {
      setLastCheckResult('up-to-date');
      const timer = setTimeout(() => setLastCheckResult(null), 3000);
      return () => clearTimeout(timer);
    }
    lastStatusRef.current = status;
  }, [status]);

  const checkForUpdates = useCallback(() => {
    setLastCheckResult(null);
    window.scribe.update.check();
  }, []);

  const renderUpdateButton = () => {
    switch (status) {
      case 'idle':
        return (
          <Button variant="subtle" onClick={checkForUpdates}>
            Check for Updates
          </Button>
        );
      case 'checking':
        return (
          <Button variant="subtle" disabled>
            Checking...
          </Button>
        );
      case 'downloading':
        return (
          <Button variant="subtle" disabled>
            Downloading...
          </Button>
        );
      case 'ready':
        return (
          <Button variant="solid" tone="accent" onClick={installUpdate}>
            Restart to Update
          </Button>
        );
      case 'error':
        return (
          <Button variant="subtle" onClick={checkForUpdates}>
            Retry Check
          </Button>
        );
    }
  };

  const renderStatusMessage = () => {
    switch (status) {
      case 'ready':
        return (
          <Text size="sm" color="accent">
            Update ready: v{version}
          </Text>
        );
      case 'error':
        return (
          <Text size="sm" color="danger">
            {error}
          </Text>
        );
      default:
        if (lastCheckResult === 'up-to-date') {
          return (
            <Text size="sm" color="foregroundMuted">
              You're up to date
            </Text>
          );
        }
        return null;
    }
  };

  return (
    <div className={styles.versionSetting}>
      <div className={styles.versionRow}>
        <span className={styles.versionText}>v{__APP_VERSION__}</span>
        {renderUpdateButton()}
      </div>
      {renderStatusMessage()}
    </div>
  );
}

/**
 * Theme setting
 * Uses SegmentedControl to allow users to select between Dark, Light, and System themes.
 * Changes apply immediately and persist via the ThemeProvider's storage adapter.
 */
function ThemeSetting() {
  const { theme, setTheme } = useTheme();

  const options: Array<{ value: 'dark' | 'light' | 'system'; label: string }> = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'system', label: 'System' },
  ];

  return (
    <div className={styles.themeSetting}>
      <SegmentedControl
        options={options}
        value={theme}
        onChange={setTheme}
        aria-label="Theme preference"
        size="md"
      />
    </div>
  );
}

/**
 * GeneralSettings component
 *
 * Contains the main settings for the application:
 * - Vault Location: Current vault path with change/create options
 * - Version: App version with update checking
 * - Theme: Light/Dark/System theme selection
 */
export function GeneralSettings() {
  return (
    <div className={styles.generalSettings}>
      <SettingsGroup
        title="Vault Location"
        description="Your notes are stored in this folder on your computer."
      >
        <VaultLocationSetting />
      </SettingsGroup>

      <SettingsGroup title="Version" description="Check for updates to get the latest features.">
        <VersionSetting />
      </SettingsGroup>

      <SettingsGroup title="Theme" description="Choose how Scribe looks.">
        <ThemeSetting />
      </SettingsGroup>
    </div>
  );
}
