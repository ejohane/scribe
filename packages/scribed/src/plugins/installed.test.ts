/**
 * Tests for Installed Plugins Registry
 */

import { describe, it, expect } from 'vitest';
import { getInstalledPlugins, discoverPlugins } from './installed.js';

describe('installed', () => {
  describe('getInstalledPlugins', () => {
    it('returns an array', () => {
      const plugins = getInstalledPlugins();
      expect(Array.isArray(plugins)).toBe(true);
    });

    it('returns empty array when no plugins are installed', () => {
      // Currently, no plugins are installed by default
      const plugins = getInstalledPlugins();
      expect(plugins).toEqual([]);
    });

    it('returns consistent results on multiple calls', () => {
      const plugins1 = getInstalledPlugins();
      const plugins2 = getInstalledPlugins();

      expect(plugins1).toEqual(plugins2);
    });
  });

  describe('discoverPlugins', () => {
    it('returns an array', () => {
      const plugins = discoverPlugins();
      expect(Array.isArray(plugins)).toBe(true);
    });

    it('returns same result as getInstalledPlugins for now', () => {
      // In v1, discoverPlugins falls back to getInstalledPlugins
      const discovered = discoverPlugins();
      const installed = getInstalledPlugins();

      expect(discovered).toEqual(installed);
    });

    it('accepts config parameter without error', () => {
      // Config is currently ignored but should not cause errors
      expect(() => {
        discoverPlugins({});
      }).not.toThrow();

      expect(() => {
        discoverPlugins({
          patterns: ['@scribe/plugin-*'],
          packages: ['@scribe/plugin-todo'],
          scanNodeModules: true,
        });
      }).not.toThrow();
    });

    it('returns empty array with various config options', () => {
      // Since dynamic discovery is not implemented yet
      expect(discoverPlugins({ patterns: ['*'] })).toEqual([]);
      expect(discoverPlugins({ packages: ['some-package'] })).toEqual([]);
      expect(discoverPlugins({ scanNodeModules: true })).toEqual([]);
    });
  });
});
