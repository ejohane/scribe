/**
 * useSettingsPage Hook
 *
 * Manages the state for the Settings page modal.
 */

import { useState, useCallback } from 'react';
import type { SettingsSection } from '../components/Settings/SettingsPage';

export interface UseSettingsPageResult {
  /** Whether the settings page is open */
  isOpen: boolean;
  /** Open the settings page */
  open: () => void;
  /** Close the settings page */
  close: () => void;
  /** Toggle the settings page open/closed */
  toggle: () => void;
  /** Currently active section */
  activeSection: SettingsSection;
  /** Set the active section */
  setActiveSection: (section: SettingsSection) => void;
}

/**
 * Hook for managing Settings page state
 *
 * @example
 * const settings = useSettingsPage();
 *
 * <button onClick={settings.open}>Open Settings</button>
 * <SettingsPage isOpen={settings.isOpen} onClose={settings.close} />
 */
export function useSettingsPage(): UseSettingsPageResult {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  const open = useCallback(() => {
    setIsOpen(true);
    setActiveSection('general');
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setActiveSection('general');
    }
  }, [isOpen]);

  return {
    isOpen,
    open,
    close,
    toggle,
    activeSection,
    setActiveSection,
  };
}
