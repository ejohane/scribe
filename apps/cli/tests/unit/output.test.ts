/**
 * Unit tests for output.ts
 *
 * Tests the CLI output formatting functions for JSON and text modes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  output,
  verbose,
  debug,
  timed,
  timedAsync,
  formatDate,
  type OutputOptions,
} from '../../src/output';

describe('output', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('JSON output', () => {
    const jsonOptions: OutputOptions = {
      format: 'json',
    };

    it('should output valid JSON for objects', () => {
      const data = { foo: 'bar', count: 42 };
      output(data, jsonOptions);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const outputStr = consoleLogSpy.mock.calls[0][0] as string;

      // Should be valid JSON
      expect(() => JSON.parse(outputStr)).not.toThrow();
      expect(JSON.parse(outputStr)).toEqual(data);
    });

    it('should output valid JSON for arrays', () => {
      const data = [{ id: 1 }, { id: 2 }];
      output(data, jsonOptions);

      const outputStr = consoleLogSpy.mock.calls[0][0] as string;
      expect(JSON.parse(outputStr)).toEqual(data);
    });

    it('should output valid JSON for strings', () => {
      output('hello', jsonOptions);

      const outputStr = consoleLogSpy.mock.calls[0][0] as string;
      expect(JSON.parse(outputStr)).toBe('hello');
    });

    it('should output valid JSON for numbers', () => {
      output(42, jsonOptions);

      const outputStr = consoleLogSpy.mock.calls[0][0] as string;
      expect(JSON.parse(outputStr)).toBe(42);
    });

    it('should output valid JSON for null', () => {
      output(null, jsonOptions);

      const outputStr = consoleLogSpy.mock.calls[0][0] as string;
      expect(JSON.parse(outputStr)).toBeNull();
    });

    it('should pretty-print JSON with 2-space indent', () => {
      const data = { nested: { value: 1 } };
      output(data, jsonOptions);

      const outputStr = consoleLogSpy.mock.calls[0][0] as string;
      expect(outputStr).toContain('\n');
      expect(outputStr).toContain('  '); // 2-space indent
    });
  });

  describe('text output', () => {
    const textOptions: OutputOptions = {
      format: 'text',
    };

    it('should output strings directly', () => {
      output('hello world', textOptions);

      expect(consoleLogSpy).toHaveBeenCalledWith('hello world');
    });

    it('should format note-like objects with title and id', () => {
      const note = {
        id: 'abc-123',
        title: 'My Note',
      };
      output(note, textOptions);

      const outputStr = consoleLogSpy.mock.calls[0][0];
      expect(outputStr).toContain('My Note');
      expect(outputStr).toContain('abc-123');
    });

    it('should include tags for note-like objects', () => {
      const note = {
        id: 'abc-123',
        title: 'My Note',
        tags: ['#work', '#important'],
      };
      output(note, textOptions);

      const outputStr = consoleLogSpy.mock.calls[0][0];
      expect(outputStr).toContain('#work');
      expect(outputStr).toContain('#important');
    });

    it('should format arrays by outputting each item', () => {
      const items = [
        { id: '1', title: 'Note 1' },
        { id: '2', title: 'Note 2' },
      ];
      output(items, textOptions);

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it('should convert numbers to strings', () => {
      output(42, textOptions);

      expect(consoleLogSpy).toHaveBeenCalledWith('42');
    });

    it('should convert booleans to strings', () => {
      output(true, textOptions);

      expect(consoleLogSpy).toHaveBeenCalledWith('true');
    });

    it('should fall back to JSON for complex objects', () => {
      const complexObj = { nested: { deep: { value: 1 } } };
      output(complexObj, textOptions);

      const outputStr = consoleLogSpy.mock.calls[0][0];
      // Should be JSON formatted
      expect(outputStr).toContain('"nested"');
    });
  });

  describe('verbose', () => {
    it('should output to stderr when verbose is enabled', () => {
      const options: OutputOptions = { format: 'json', verbose: true };
      verbose('Test message', options);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[verbose] Test message');
    });

    it('should not output when verbose is disabled', () => {
      const options: OutputOptions = { format: 'json', verbose: false };
      verbose('Test message', options);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should not output when verbose is undefined', () => {
      const options: OutputOptions = { format: 'json' };
      verbose('Test message', options);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('debug', () => {
    it('should output to stderr when debug is enabled', () => {
      const options: OutputOptions = { format: 'json', debug: true };
      debug('Debug info', options);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[debug] Debug info');
    });

    it('should not output when debug is disabled', () => {
      const options: OutputOptions = { format: 'json', debug: false };
      debug('Debug info', options);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should not output when debug is undefined', () => {
      const options: OutputOptions = { format: 'json' };
      debug('Debug info', options);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('timed', () => {
    it('should execute function and return result', () => {
      const options: OutputOptions = { format: 'json', debug: true };
      const result = timed('test', () => 42, options);

      expect(result).toBe(42);
    });

    it('should log timing when debug is enabled', () => {
      const options: OutputOptions = { format: 'json', debug: true };
      timed('my-operation', () => 'result', options);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('[timing]');
      expect(call).toContain('my-operation');
      expect(call).toContain('ms');
    });

    it('should not log timing when debug is disabled', () => {
      const options: OutputOptions = { format: 'json', debug: false };
      const result = timed('test', () => 42, options);

      expect(result).toBe(42);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('timedAsync', () => {
    it('should execute async function and return result', async () => {
      const options: OutputOptions = { format: 'json', debug: true };
      const result = await timedAsync('test', async () => 'async-result', options);

      expect(result).toBe('async-result');
    });

    it('should log timing for async operations', async () => {
      const options: OutputOptions = { format: 'json', debug: true };
      await timedAsync(
        'async-op',
        async () => {
          // Simulate some async work
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'done';
        },
        options
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('[timing]');
      expect(call).toContain('async-op');
    });

    it('should not log timing when debug is disabled', async () => {
      const options: OutputOptions = { format: 'json', debug: false };
      const result = await timedAsync('test', async () => 'result', options);

      expect(result).toBe('result');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('formatDate', () => {
    it('should format ISO date string to human-readable format', () => {
      const result = formatDate('2025-12-15T10:30:00Z');

      // Should contain date components
      expect(result).toMatch(/Dec/);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2025/);
    });

    it('should include time in formatted output', () => {
      const result = formatDate('2025-12-15T14:30:00Z');

      // Should contain time (exact format depends on locale)
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should handle different timezones in input', () => {
      // Same moment, different representations
      const utc = formatDate('2025-12-15T10:30:00Z');
      const offset = formatDate('2025-12-15T05:30:00-05:00');

      // Both should represent the same time
      // (exact comparison depends on local timezone, so just check format)
      expect(utc).toMatch(/Dec.*15.*2025/);
      expect(offset).toMatch(/Dec.*15.*2025/);
    });
  });
});
