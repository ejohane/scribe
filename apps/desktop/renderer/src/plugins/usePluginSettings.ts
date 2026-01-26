/**
 * Plugin Settings Hook
 *
 * Provides persistent enable/disable state for installed plugins.
 *
 * @module
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PluginModule } from '@scribe/plugin-core';
import { getInstalledPlugins } from './installed';

const STORAGE_KEY = 'scribe:plugin-settings';
const SETTINGS_EVENT = 'scribe:plugin-settings-changed';

interface PluginSettingsStorage {
  enabled: Record<string, boolean>;
}

interface StoredSettingsResult {
  settings: PluginSettingsStorage;
  shouldPersist: boolean;
}

export interface PluginSettingsResult {
  enabledPluginIds: Set<string>;
  isPluginEnabled: (pluginId: string) => boolean;
  setPluginEnabled: (pluginId: string, enabled: boolean) => void;
  togglePlugin: (pluginId: string) => void;
}

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isValidSettings(value: unknown): value is PluginSettingsStorage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const enabled = (value as { enabled?: unknown }).enabled;
  if (!enabled || typeof enabled !== 'object' || Array.isArray(enabled)) {
    return false;
  }

  return Object.values(enabled as Record<string, unknown>).every(
    (entry) => typeof entry === 'boolean'
  );
}

function createDefaultSettings(): PluginSettingsStorage {
  return { enabled: {} };
}

function loadStoredSettings(): StoredSettingsResult {
  const defaults = createDefaultSettings();
  if (!hasLocalStorage()) {
    return { settings: defaults, shouldPersist: false };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { settings: defaults, shouldPersist: false };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isValidSettings(parsed)) {
      return { settings: parsed, shouldPersist: false };
    }
  } catch (error) {
    // fall through to reset
  }

  return { settings: defaults, shouldPersist: true };
}

function readStoredSettings(): PluginSettingsStorage {
  return loadStoredSettings().settings;
}

function buildInstalledPluginIds(modules: PluginModule[]): string[] {
  return modules.map((module) => module.manifest.id);
}

export function usePluginSettings(): PluginSettingsResult {
  const installedPlugins = useMemo(() => getInstalledPlugins(), []);
  const installedPluginIds = useMemo(
    () => buildInstalledPluginIds(installedPlugins),
    [installedPlugins]
  );

  const [settings, setSettings] = useState<PluginSettingsStorage>(() => {
    const { settings: initialSettings, shouldPersist } = loadStoredSettings();
    if (shouldPersist && hasLocalStorage()) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialSettings));
    }
    return initialSettings;
  });

  useEffect(() => {
    if (!hasLocalStorage()) {
      return undefined;
    }

    const handleSettingsUpdate = () => {
      setSettings(readStoredSettings());
    };

    window.addEventListener('storage', handleSettingsUpdate);
    window.addEventListener(SETTINGS_EVENT, handleSettingsUpdate as EventListener);

    return () => {
      window.removeEventListener('storage', handleSettingsUpdate);
      window.removeEventListener(SETTINGS_EVENT, handleSettingsUpdate as EventListener);
    };
  }, []);

  const updateSettings = useCallback(
    (updater: (current: PluginSettingsStorage) => PluginSettingsStorage) => {
      setSettings((current) => {
        const next = updater(current);
        if (hasLocalStorage()) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          window.dispatchEvent(new Event(SETTINGS_EVENT));
        }
        return next;
      });
    },
    []
  );

  const isPluginEnabled = useCallback(
    (pluginId: string) => settings.enabled[pluginId] ?? true,
    [settings.enabled]
  );

  const enabledPluginIds = useMemo(() => {
    const enabled = new Set<string>();
    for (const pluginId of installedPluginIds) {
      if (isPluginEnabled(pluginId)) {
        enabled.add(pluginId);
      }
    }
    return enabled;
  }, [installedPluginIds, isPluginEnabled]);

  const setPluginEnabled = useCallback(
    (pluginId: string, enabled: boolean) => {
      updateSettings((current) => ({
        ...current,
        enabled: {
          ...current.enabled,
          [pluginId]: enabled,
        },
      }));
    },
    [updateSettings]
  );

  const togglePlugin = useCallback(
    (pluginId: string) => {
      updateSettings((current) => {
        const nextValue = (current.enabled[pluginId] ?? true) ? false : true;
        return {
          ...current,
          enabled: {
            ...current.enabled,
            [pluginId]: nextValue,
          },
        };
      });
    },
    [updateSettings]
  );

  return useMemo(
    () => ({
      enabledPluginIds,
      isPluginEnabled,
      setPluginEnabled,
      togglePlugin,
    }),
    [enabledPluginIds, isPluginEnabled, setPluginEnabled, togglePlugin]
  );
}
