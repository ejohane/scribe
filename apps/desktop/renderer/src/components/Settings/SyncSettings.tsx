/**
 * SyncSettings Component
 *
 * Settings section for sync configuration and account management.
 * Handles three states:
 * 1. Sync disabled - show enable button and benefits
 * 2. Sync enabled, not logged in - show login form
 * 3. Sync enabled, logged in - show account info and sync options
 */

import type { ReactNode, FormEvent } from 'react';
import { useState, useCallback } from 'react';
import {
  Button,
  SegmentedControl,
  Overlay,
  Surface,
  Text,
  CheckCircleIcon,
  CloudIcon,
  UserIcon,
  LogOutIcon,
  RefreshIcon,
} from '@scribe/design-system';
import { useSyncStatus, formatRelativeTime } from '../../hooks/useSyncStatus';
import * as styles from './SyncSettings.css';

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
 * Confirmation dialog for disabling sync
 */
interface DisableSyncDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function DisableSyncDialog({ onConfirm, onCancel }: DisableSyncDialogProps) {
  return (
    <Overlay
      open
      onClose={onCancel}
      backdrop="blur"
      ariaLabelledby="disable-sync-title"
      ariaDescribedby="disable-sync-description"
    >
      <Surface elevation="lg" padding="6" radius="lg" className={styles.confirmDialog}>
        <Text as="h2" id="disable-sync-title" size="lg" weight="bold">
          Disable Sync?
        </Text>
        <Text id="disable-sync-description" color="foregroundMuted">
          Your notes will no longer sync to the cloud. Local notes will remain on this device, but
          changes won't be backed up or available on other devices.
        </Text>
        <div className={styles.confirmDialogButtons}>
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="solid" tone="danger" onClick={onConfirm}>
            Disable Sync
          </Button>
        </div>
      </Surface>
    </Overlay>
  );
}

/**
 * Benefits display for disabled sync state
 */
function SyncBenefits() {
  const benefits = [
    'Access your notes from any device',
    'Automatic backup to the cloud',
    'Real-time sync across devices',
    'Never lose your work',
  ];

  return (
    <ul className={styles.benefitsList}>
      {benefits.map((benefit, index) => (
        <li key={index} className={styles.benefitItem}>
          <span className={styles.benefitIcon}>
            <CheckCircleIcon size={16} />
          </span>
          <span>{benefit}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Login form for sync authentication
 */
interface LoginFormProps {
  onSubmit: (email: string, apiKey: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string | null;
}

function LoginForm({ onSubmit, onCancel, isSubmitting, error }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!email.trim() || !apiKey.trim()) return;
      await onSubmit(email.trim(), apiKey.trim());
    },
    [email, apiKey, onSubmit]
  );

  return (
    <form className={styles.loginForm} onSubmit={handleSubmit}>
      <div className={styles.formField}>
        <label htmlFor="sync-email" className={styles.formLabel}>
          Email
        </label>
        <input
          id="sync-email"
          type="email"
          className={styles.textInput}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
          required
          autoComplete="email"
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor="sync-api-key" className={styles.formLabel}>
          API Key
        </label>
        <input
          id="sync-api-key"
          type="password"
          className={styles.textInput}
          placeholder="Enter your API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={isSubmitting}
          required
          autoComplete="current-password"
        />
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.formActions}>
        <Button variant="subtle" onClick={onCancel} disabled={isSubmitting} type="button">
          Cancel
        </Button>
        <Button variant="solid" tone="accent" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Connecting...' : 'Connect'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Account info display for logged in state
 */
interface AccountInfoProps {
  email: string;
  onLogout: () => void;
}

function AccountInfo({ email, onLogout }: AccountInfoProps) {
  return (
    <div className={styles.accountInfo}>
      <div className={styles.accountAvatar}>
        <UserIcon size={20} />
      </div>
      <div className={styles.accountDetails}>
        <span className={styles.accountEmail}>{email}</span>
        <span className={styles.accountStatus}>Sync enabled</span>
      </div>
      <Button variant="ghost" onClick={onLogout} aria-label="Log out">
        <LogOutIcon size={18} />
      </Button>
    </div>
  );
}

/**
 * Sync status indicator
 */
interface SyncStatusIndicatorProps {
  isSyncing: boolean;
  lastSyncAt: number | null;
  error: string | null;
}

function SyncStatusIndicator({ isSyncing, lastSyncAt, error }: SyncStatusIndicatorProps) {
  if (error) {
    return (
      <div className={styles.statusIndicator}>
        <Text size="sm" color="danger">
          Sync error: {error}
        </Text>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className={styles.statusIndicator}>
        <RefreshIcon size={14} className={styles.syncingIcon} />
        <span>Syncing...</span>
      </div>
    );
  }

  if (lastSyncAt) {
    return <div className={styles.lastSyncTime}>Last synced: {formatRelativeTime(lastSyncAt)}</div>;
  }

  return null;
}

/**
 * Auto-sync mode toggle
 */
interface AutoSyncToggleProps {
  autoSync: boolean;
  onChange: (autoSync: boolean) => void;
}

function AutoSyncToggle({ autoSync, onChange }: AutoSyncToggleProps) {
  const options = [
    { value: 'auto' as const, label: 'Auto' },
    { value: 'manual' as const, label: 'Manual' },
  ];

  return (
    <div className={styles.settingRow}>
      <div className={styles.settingLabel}>
        <span className={styles.settingLabelText}>Sync mode</span>
        <span className={styles.settingLabelDescription}>
          Auto sync keeps your notes up to date automatically
        </span>
      </div>
      <div className={styles.settingControl}>
        <SegmentedControl
          options={options}
          value={autoSync ? 'auto' : 'manual'}
          onChange={(value) => onChange(value === 'auto')}
          aria-label="Sync mode"
          size="sm"
        />
      </div>
    </div>
  );
}

/**
 * Disabled sync state - shows benefits and enable button
 */
interface DisabledSyncViewProps {
  onEnable: () => void;
}

function DisabledSyncView({ onEnable }: DisabledSyncViewProps) {
  return (
    <div>
      <SyncBenefits />
      <Button variant="solid" tone="accent" onClick={onEnable}>
        <CloudIcon size={18} />
        Enable Sync
      </Button>
    </div>
  );
}

/**
 * Enabled sync state - shows login form or account info
 */
interface EnabledSyncViewProps {
  isLoggedIn: boolean;
  email: string | null;
  autoSync: boolean;
  isSyncing: boolean;
  lastSyncAt: number | null;
  error: string | null;
  onLogin: (email: string, apiKey: string) => Promise<void>;
  onLogout: () => void;
  onAutoSyncChange: (autoSync: boolean) => void;
  onDisable: () => void;
  onSyncNow: () => void;
  loginError: string | null;
  isLoggingIn: boolean;
}

function EnabledSyncView({
  isLoggedIn,
  email,
  autoSync,
  isSyncing,
  lastSyncAt,
  error,
  onLogin,
  onLogout,
  onAutoSyncChange,
  onDisable,
  onSyncNow,
  loginError,
  isLoggingIn,
}: EnabledSyncViewProps) {
  const [showLoginForm, setShowLoginForm] = useState(!isLoggedIn);

  const handleLoginCancel = useCallback(() => {
    setShowLoginForm(false);
  }, []);

  // If not logged in, show login form
  if (!isLoggedIn || showLoginForm) {
    return (
      <LoginForm
        onSubmit={onLogin}
        onCancel={handleLoginCancel}
        isSubmitting={isLoggingIn}
        error={loginError}
      />
    );
  }

  // Logged in - show account info and options
  return (
    <div>
      <AccountInfo email={email || 'Unknown'} onLogout={onLogout} />

      <SyncStatusIndicator isSyncing={isSyncing} lastSyncAt={lastSyncAt} error={error} />

      <AutoSyncToggle autoSync={autoSync} onChange={onAutoSyncChange} />

      <div className={styles.buttonGroup}>
        <Button variant="subtle" onClick={onSyncNow} disabled={isSyncing}>
          <RefreshIcon size={16} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerZoneTitle}>Danger Zone</div>
        <Button variant="ghost" tone="danger" onClick={onDisable}>
          Disable Sync
        </Button>
      </div>
    </div>
  );
}

/**
 * SyncSettings component
 *
 * Main sync settings section that handles:
 * - Enabling/disabling sync
 * - Login/logout flow
 * - Auto-sync configuration
 * - Manual sync trigger
 */
export function SyncSettings() {
  const { isEnabled, isSyncing, lastSyncAt, error, syncNow, refresh } = useSyncStatus();

  // Local state for UI
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(isEnabled);

  // Handle enable sync (show login form)
  const handleEnable = useCallback(() => {
    setLocalEnabled(true);
    setIsLoggedIn(false);
  }, []);

  // Handle login
  const handleLogin = useCallback(
    async (userEmail: string, apiKey: string) => {
      setIsLoggingIn(true);
      setLoginError(null);

      try {
        const result = await window.scribe.sync.enable({ apiKey });

        if (result.success) {
          setEmail(userEmail);
          setIsLoggedIn(true);
          await refresh();
        } else {
          setLoginError(result.error || 'Failed to enable sync');
        }
      } catch (e) {
        setLoginError(e instanceof Error ? e.message : 'Failed to connect');
      } finally {
        setIsLoggingIn(false);
      }
    },
    [refresh]
  );

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await window.scribe.sync.disable();
      setIsLoggedIn(false);
      setEmail(null);
      setLocalEnabled(false);
      await refresh();
    } catch (e) {
      console.error('Failed to logout:', e);
    }
  }, [refresh]);

  // Handle auto-sync toggle
  const handleAutoSyncChange = useCallback((value: boolean) => {
    setAutoSync(value);
    // Note: In a full implementation, this would call window.scribe.sync.setConfig({ autoSync: value })
  }, []);

  // Handle disable sync confirmation
  const handleDisableConfirm = useCallback(async () => {
    try {
      await window.scribe.sync.disable();
      setShowDisableDialog(false);
      setLocalEnabled(false);
      setIsLoggedIn(false);
      setEmail(null);
      await refresh();
    } catch (e) {
      console.error('Failed to disable sync:', e);
    }
  }, [refresh]);

  // Handle sync now
  const handleSyncNow = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  // Determine which view to show
  const showEnabled = localEnabled || isEnabled;

  return (
    <div className={styles.syncSettings}>
      <SettingsGroup
        title="Cloud Sync"
        description="Sync your notes across devices and back up to the cloud."
      >
        {showEnabled ? (
          <EnabledSyncView
            isLoggedIn={isLoggedIn}
            email={email}
            autoSync={autoSync}
            isSyncing={isSyncing}
            lastSyncAt={lastSyncAt}
            error={error}
            onLogin={handleLogin}
            onLogout={handleLogout}
            onAutoSyncChange={handleAutoSyncChange}
            onDisable={() => setShowDisableDialog(true)}
            onSyncNow={handleSyncNow}
            loginError={loginError}
            isLoggingIn={isLoggingIn}
          />
        ) : (
          <DisabledSyncView onEnable={handleEnable} />
        )}
      </SettingsGroup>

      {showDisableDialog && (
        <DisableSyncDialog
          onConfirm={handleDisableConfirm}
          onCancel={() => setShowDisableDialog(false)}
        />
      )}
    </div>
  );
}
