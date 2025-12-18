/**
 * Tests for theme configuration
 *
 * Validates that light and dark themes are properly exported
 * and contain distinct values for theme-aware styling.
 */

import { describe, it, expect } from 'vitest';
import { lightTheme, darkTheme } from './index';

describe('Theme Configuration', () => {
  describe('theme exports', () => {
    it('should export lightTheme as a string (class name)', () => {
      expect(lightTheme).toBeDefined();
      expect(typeof lightTheme).toBe('string');
    });

    it('should export darkTheme as a string (class name)', () => {
      expect(darkTheme).toBeDefined();
      expect(typeof darkTheme).toBe('string');
    });

    it('should have distinct class names for light and dark themes', () => {
      expect(lightTheme).not.toBe(darkTheme);
    });
  });

  describe('theme structure validation', () => {
    it('should export non-empty theme class names', () => {
      expect(lightTheme.length).toBeGreaterThan(0);
      expect(darkTheme.length).toBeGreaterThan(0);
    });
  });
});
