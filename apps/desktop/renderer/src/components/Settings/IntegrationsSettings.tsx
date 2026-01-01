/**
 * IntegrationsSettings Component
 *
 * Settings section for managing external integrations:
 * - CLI Tool: Install/uninstall the Scribe command-line interface
 * - Raycast Extension: Install the Raycast extension for quick capture
 */

import type { ReactNode } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { Button, Text } from '@scribe/design-system';
import type { CLIStatus, RaycastStatus } from '@scribe/shared';
import * as styles from './IntegrationsSettings.css';

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
 * Status badge component
 */
function StatusBadge({ installed }: { installed: boolean }) {
  return (
    <span className={installed ? styles.statusInstalled : styles.statusNotInstalled}>
      {installed ? 'Installed' : 'Not Installed'}
    </span>
  );
}

/**
 * CLI Tool setting
 * Allows users to install/uninstall the Scribe CLI
 */
function CLISetting() {
  const [status, setStatus] = useState<CLIStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const cliStatus = await window.scribe.cli.getStatus();
      setStatus(cliStatus);
    } catch (error) {
      console.error('Failed to get CLI status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleInstall = useCallback(async () => {
    setIsInstalling(true);
    setMessage(null);

    try {
      const result = await window.scribe.cli.install();
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        if (result.needsPathSetup) {
          setMessage({
            type: 'success',
            text: 'CLI installed! Add ~/.local/bin to your PATH to use it from terminal.',
          });
        }
      } else {
        setMessage({ type: 'error', text: result.message });
      }
      await refreshStatus();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Installation failed',
      });
    } finally {
      setIsInstalling(false);
    }
  }, [refreshStatus]);

  const handleUninstall = useCallback(async () => {
    setIsInstalling(true);
    setMessage(null);

    try {
      const result = await window.scribe.cli.uninstall();
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
      await refreshStatus();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Uninstallation failed',
      });
    } finally {
      setIsInstalling(false);
    }
  }, [refreshStatus]);

  if (isLoading) {
    return <div className={styles.placeholder}>Loading...</div>;
  }

  const isInstalled = status?.installed && status?.linkedToThisApp;

  return (
    <div className={styles.integrationItem}>
      <div className={styles.integrationHeader}>
        <div className={styles.integrationInfo}>
          <Text weight="medium">Command Line Interface</Text>
          <Text size="sm" color="foregroundMuted">
            Use Scribe from your terminal with the <code className={styles.code}>scribe</code>{' '}
            command
          </Text>
        </div>
        <StatusBadge installed={!!isInstalled} />
      </div>

      {status?.installed && !status?.linkedToThisApp && (
        <div className={styles.warningMessage}>
          A different version of the CLI is installed. Reinstall to update.
        </div>
      )}

      {message && (
        <div className={message.type === 'success' ? styles.successMessage : styles.errorMessage}>
          {message.text}
        </div>
      )}

      <div className={styles.buttonGroup}>
        {isInstalled ? (
          <Button variant="subtle" onClick={handleUninstall} disabled={isInstalling}>
            {isInstalling ? 'Uninstalling...' : 'Uninstall'}
          </Button>
        ) : (
          <Button variant="solid" tone="accent" onClick={handleInstall} disabled={isInstalling}>
            {isInstalling ? 'Installing...' : 'Install CLI'}
          </Button>
        )}
      </div>

      {status?.targetPath && (
        <Text size="xs" color="foregroundMuted" className={styles.pathInfo}>
          Installs to: {status.targetPath}
        </Text>
      )}
    </div>
  );
}

/**
 * Raycast Extension setting
 * Allows users to install the Raycast extension for quick capture
 */
function RaycastSetting() {
  const [status, setStatus] = useState<RaycastStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const raycastStatus = await window.scribe.raycast.getStatus();
      setStatus(raycastStatus);
    } catch (error) {
      console.error('Failed to get Raycast status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleInstall = useCallback(async () => {
    setIsInstalling(true);
    setMessage(null);

    try {
      const result = await window.scribe.raycast.install();
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
      } else {
        setMessage({ type: 'error', text: result.error || result.message });
      }
      await refreshStatus();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Installation failed',
      });
    } finally {
      setIsInstalling(false);
    }
  }, [refreshStatus]);

  const handleOpenInRaycast = useCallback(async () => {
    try {
      const result = await window.scribe.raycast.openInRaycast();
      if (!result.success) {
        setMessage({ type: 'error', text: result.error || result.message });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to open Raycast',
      });
    }
  }, []);

  if (isLoading) {
    return <div className={styles.placeholder}>Loading...</div>;
  }

  const isFullyInstalled = status?.extensionInstalled && status?.dependenciesInstalled;

  // Check prerequisites
  const missingPrereqs: string[] = [];
  if (!status?.raycastInstalled) {
    missingPrereqs.push('Raycast app');
  }
  if (!status?.cliInstalled) {
    missingPrereqs.push('Scribe CLI');
  }

  return (
    <div className={styles.integrationItem}>
      <div className={styles.integrationHeader}>
        <div className={styles.integrationInfo}>
          <Text weight="medium">Raycast Extension</Text>
          <Text size="sm" color="foregroundMuted">
            Quick capture notes and tasks from anywhere on your Mac
          </Text>
        </div>
        <StatusBadge installed={!!isFullyInstalled} />
      </div>

      {missingPrereqs.length > 0 && (
        <div className={styles.prerequisiteWarning}>
          <Text size="sm" color="foregroundMuted">
            Requires: {missingPrereqs.join(', ')}
          </Text>
          {!status?.raycastInstalled && (
            <Text size="xs" color="foregroundMuted">
              Get Raycast free at{' '}
              <a
                href="https://raycast.com"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
                onClick={(e) => {
                  e.preventDefault();
                  window.scribe.shell.openExternal('https://raycast.com');
                }}
              >
                raycast.com
              </a>
            </Text>
          )}
        </div>
      )}

      {message && (
        <div className={message.type === 'success' ? styles.successMessage : styles.errorMessage}>
          {message.text}
        </div>
      )}

      <div className={styles.buttonGroup}>
        {isFullyInstalled ? (
          <Button variant="subtle" onClick={handleOpenInRaycast}>
            Open in Raycast
          </Button>
        ) : (
          <Button
            variant="solid"
            tone="accent"
            onClick={handleInstall}
            disabled={isInstalling || missingPrereqs.length > 0}
          >
            {isInstalling ? 'Installing...' : 'Install Extension'}
          </Button>
        )}
      </div>

      {status?.installPath && isFullyInstalled && (
        <Text size="xs" color="foregroundMuted" className={styles.pathInfo}>
          Installed at: {status.installPath}
        </Text>
      )}
    </div>
  );
}

/**
 * IntegrationsSettings component
 *
 * Contains settings for external integrations:
 * - CLI Tool: Command line interface for Scribe
 * - Raycast Extension: Quick capture from anywhere
 */
export function IntegrationsSettings() {
  return (
    <div className={styles.integrationsSettings}>
      <SettingsGroup
        title="CLI Tool"
        description="Access your vault from the command line for scripting and automation."
      >
        <CLISetting />
      </SettingsGroup>

      <SettingsGroup
        title="Raycast Extension"
        description="Capture notes and tasks instantly from anywhere on your Mac using Raycast."
      >
        <RaycastSetting />
      </SettingsGroup>
    </div>
  );
}
