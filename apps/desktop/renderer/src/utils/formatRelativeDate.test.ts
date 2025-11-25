import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeDate } from './formatRelativeDate';

describe('formatRelativeDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('invalid inputs', () => {
    it('returns empty string for null', () => {
      expect(formatRelativeDate(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(formatRelativeDate(undefined)).toBe('');
    });
  });

  describe('relative dates', () => {
    it('returns "Just now" for timestamps less than 60 seconds ago', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      expect(formatRelativeDate(now)).toBe('Just now');
      expect(formatRelativeDate(now - 1000)).toBe('Just now'); // 1 second ago
      expect(formatRelativeDate(now - 30 * 1000)).toBe('Just now'); // 30 seconds ago
      expect(formatRelativeDate(now - 59 * 1000)).toBe('Just now'); // 59 seconds ago
    });

    it('returns "1 minute ago" for exactly 60 seconds ago', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      expect(formatRelativeDate(now - 60 * 1000)).toBe('1 minute ago');
    });

    it('returns "X minutes ago" for timestamps less than 60 minutes ago', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      expect(formatRelativeDate(now - 2 * 60 * 1000)).toBe('2 minutes ago');
      expect(formatRelativeDate(now - 5 * 60 * 1000)).toBe('5 minutes ago');
      expect(formatRelativeDate(now - 30 * 60 * 1000)).toBe('30 minutes ago');
      expect(formatRelativeDate(now - 59 * 60 * 1000)).toBe('59 minutes ago');
    });

    it('returns "1 hour ago" for exactly 60 minutes ago', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      expect(formatRelativeDate(now - 60 * 60 * 1000)).toBe('1 hour ago');
    });

    it('returns "X hours ago" for timestamps less than 24 hours ago', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      expect(formatRelativeDate(now - 2 * 60 * 60 * 1000)).toBe('2 hours ago');
      expect(formatRelativeDate(now - 3 * 60 * 60 * 1000)).toBe('3 hours ago');
      expect(formatRelativeDate(now - 12 * 60 * 60 * 1000)).toBe('12 hours ago');
      expect(formatRelativeDate(now - 23 * 60 * 60 * 1000)).toBe('23 hours ago');
    });

    it('returns "1 day ago" for exactly 24 hours ago', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      expect(formatRelativeDate(now - 24 * 60 * 60 * 1000)).toBe('1 day ago');
    });

    it('returns "X days ago" for timestamps less than 7 days ago', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      expect(formatRelativeDate(now - 2 * 24 * 60 * 60 * 1000)).toBe('2 days ago');
      expect(formatRelativeDate(now - 3 * 24 * 60 * 60 * 1000)).toBe('3 days ago');
      expect(formatRelativeDate(now - 6 * 24 * 60 * 60 * 1000)).toBe('6 days ago');
    });
  });

  describe('absolute dates (>= 7 days)', () => {
    it('returns absolute date format for timestamps 7 days or more ago', () => {
      vi.useFakeTimers();
      // Set a fixed "now" date: Nov 24, 2025
      const now = new Date('2025-11-24T12:00:00.000Z').getTime();
      vi.setSystemTime(now);

      // 7 days ago = Nov 17, 2025
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      expect(formatRelativeDate(sevenDaysAgo)).toBe('Nov 17, 2025');

      // 10 days ago = Nov 14, 2025
      const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;
      expect(formatRelativeDate(tenDaysAgo)).toBe('Nov 14, 2025');

      // 30 days ago = Oct 25, 2025
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      expect(formatRelativeDate(thirtyDaysAgo)).toBe('Oct 25, 2025');
    });

    it('handles dates from different months and years', () => {
      vi.useFakeTimers();
      // Set "now" to Jan 15, 2025
      const now = new Date('2025-01-15T12:00:00.000Z').getTime();
      vi.setSystemTime(now);

      // 30 days ago = Dec 16, 2024
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      expect(formatRelativeDate(thirtyDaysAgo)).toBe('Dec 16, 2024');
    });
  });

  describe('future timestamps', () => {
    it('returns absolute date for timestamps in the future (clock skew)', () => {
      vi.useFakeTimers();
      const now = new Date('2025-11-24T12:00:00.000Z').getTime();
      vi.setSystemTime(now);

      // 1 second in the future
      const oneSecondFuture = now + 1000;
      expect(formatRelativeDate(oneSecondFuture)).toBe('Nov 24, 2025');

      // 1 minute in the future
      const oneMinuteFuture = now + 60 * 1000;
      expect(formatRelativeDate(oneMinuteFuture)).toBe('Nov 24, 2025');
    });

    it('returns absolute date for timestamps days in the future', () => {
      vi.useFakeTimers();
      const now = new Date('2025-11-24T12:00:00.000Z').getTime();
      vi.setSystemTime(now);

      // 1 day in the future = Nov 25, 2025
      const oneDayFuture = now + 24 * 60 * 60 * 1000;
      expect(formatRelativeDate(oneDayFuture)).toBe('Nov 25, 2025');

      // 7 days in the future = Dec 1, 2025
      const sevenDaysFuture = now + 7 * 24 * 60 * 60 * 1000;
      expect(formatRelativeDate(sevenDaysFuture)).toBe('Dec 1, 2025');
    });

    it('handles future dates across month and year boundaries', () => {
      vi.useFakeTimers();
      const now = new Date('2025-12-30T12:00:00.000Z').getTime();
      vi.setSystemTime(now);

      // 5 days in the future = Jan 4, 2026
      const fiveDaysFuture = now + 5 * 24 * 60 * 60 * 1000;
      expect(formatRelativeDate(fiveDaysFuture)).toBe('Jan 4, 2026');
    });
  });

  describe('boundary conditions', () => {
    it('boundary: 59 seconds ago returns "Just now"', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      expect(formatRelativeDate(now - 59 * 1000)).toBe('Just now');
    });

    it('boundary: 60 seconds ago returns "1 minute ago"', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      expect(formatRelativeDate(now - 60 * 1000)).toBe('1 minute ago');
    });

    it('boundary: 59 minutes ago returns "59 minutes ago"', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      expect(formatRelativeDate(now - 59 * 60 * 1000)).toBe('59 minutes ago');
    });

    it('boundary: 60 minutes ago returns "1 hour ago"', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      expect(formatRelativeDate(now - 60 * 60 * 1000)).toBe('1 hour ago');
    });

    it('boundary: 23 hours ago returns "23 hours ago"', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      expect(formatRelativeDate(now - 23 * 60 * 60 * 1000)).toBe('23 hours ago');
    });

    it('boundary: 24 hours ago returns "1 day ago"', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      expect(formatRelativeDate(now - 24 * 60 * 60 * 1000)).toBe('1 day ago');
    });

    it('boundary: 6 days ago returns "6 days ago"', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      expect(formatRelativeDate(now - 6 * 24 * 60 * 60 * 1000)).toBe('6 days ago');
    });

    it('boundary: 7 days ago returns absolute date', () => {
      vi.useFakeTimers();
      const now = new Date('2025-11-24T12:00:00.000Z').getTime();
      vi.setSystemTime(now);

      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      expect(formatRelativeDate(sevenDaysAgo)).toBe('Nov 17, 2025');
    });
  });
});
