/**
 * SettingsPage Component
 *
 * Full-screen modal settings page with VS Code-style sidebar navigation.
 * Opens when the gear icon in the sidebar footer is clicked.
 */

import { useState, useCallback } from 'react';
import { CloseIcon, SettingsIcon, CalendarIcon, CloudIcon } from '@scribe/design-system';
import { Overlay } from '@scribe/design-system';
import * as styles from './SettingsPage.css';
import clsx from 'clsx';
import { GeneralSettings } from './GeneralSettings';
import { SyncSettings } from './SyncSettings';

/** Available settings sections */
export type SettingsSection = 'general' | 'sync' | 'changelog';

export interface SettingsPageProps {
  /** Whether the settings page is open */
  isOpen: boolean;
  /** Callback when settings page should close */
  onClose: () => void;
}

interface SettingsSidebarProps {
  /** Currently active section */
  activeSection: SettingsSection;
  /** Callback when a section is selected */
  onSelect: (section: SettingsSection) => void;
}

/**
 * Sidebar navigation for settings sections
 */
function SettingsSidebar({ activeSection, onSelect }: SettingsSidebarProps) {
  return (
    <nav className={styles.sidebar}>
      <button
        className={clsx(styles.navItem, activeSection === 'general' && styles.navItemActive)}
        onClick={() => onSelect('general')}
        type="button"
      >
        <SettingsIcon size={18} />
        General
      </button>
      <button
        className={clsx(styles.navItem, activeSection === 'sync' && styles.navItemActive)}
        onClick={() => onSelect('sync')}
        type="button"
      >
        <CloudIcon size={18} />
        Sync
      </button>
      <button
        className={clsx(styles.navItem, activeSection === 'changelog' && styles.navItemActive)}
        onClick={() => onSelect('changelog')}
        type="button"
      >
        <CalendarIcon size={18} />
        Changelog
      </button>
    </nav>
  );
}

/**
 * Changelog settings section - placeholder
 */
function ChangelogSettings() {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionHeading}>Changelog</h2>
      <p className={styles.sectionDescription}>
        Release notes and version history will appear here in a future update.
      </p>
    </div>
  );
}

/**
 * SettingsPage component
 *
 * A full-screen modal with sidebar navigation for accessing app settings.
 * Uses the VS Code / macOS System Settings style layout.
 *
 * @example
 * <SettingsPage isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
 */
export function SettingsPage({ isOpen, onClose }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  const handleClose = useCallback(() => {
    onClose();
    // Reset to general when closing
    setActiveSection('general');
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <Overlay open={isOpen} onClose={handleClose} backdrop="blur" closeOnEscape>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>Settings</h1>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close settings"
            type="button"
          >
            <CloseIcon size={20} />
          </button>
        </header>

        <div className={styles.content}>
          <SettingsSidebar activeSection={activeSection} onSelect={setActiveSection} />

          <main className={styles.main}>
            {activeSection === 'general' && <GeneralSettings />}
            {activeSection === 'sync' && <SyncSettings />}
            {activeSection === 'changelog' && <ChangelogSettings />}
          </main>
        </div>
      </div>
    </Overlay>
  );
}
