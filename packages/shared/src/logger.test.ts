/**
 * Logger Tests
 *
 * Comprehensive tests for the logger abstraction covering:
 * - Log level filtering
 * - Child logger prefix chaining
 * - Context serialization
 * - Environment-based configuration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLogger, logger, type LogLevel } from './logger.js';

describe('logger', () => {
  // Capture console output
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('creates a logger with default settings', () => {
      const log = createLogger();
      expect(log).toBeDefined();
      expect(log.debug).toBeInstanceOf(Function);
      expect(log.info).toBeInstanceOf(Function);
      expect(log.warn).toBeInstanceOf(Function);
      expect(log.error).toBeInstanceOf(Function);
      expect(log.child).toBeInstanceOf(Function);
    });

    it('creates a logger with explicit level', () => {
      const log = createLogger({ level: 'debug' });
      expect(log.getLevel()).toBe('debug');
    });

    it('creates a logger with prefix', () => {
      const log = createLogger({ level: 'debug', prefix: 'TestComponent' });
      log.info('test message');

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain('[TestComponent]');
      expect(output).toContain('test message');
    });
  });

  describe('log level filtering', () => {
    it('outputs all levels when level is debug', () => {
      const log = createLogger({ level: 'debug' });

      log.debug('debug message');
      log.info('info message');
      log.warn('warn message');
      log.error('error message');

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('suppresses debug when level is info', () => {
      const log = createLogger({ level: 'info' });

      log.debug('debug message');
      log.info('info message');
      log.warn('warn message');
      log.error('error message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('suppresses debug and info when level is warn', () => {
      const log = createLogger({ level: 'warn' });

      log.debug('debug message');
      log.info('info message');
      log.warn('warn message');
      log.error('error message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('only outputs error when level is error', () => {
      const log = createLogger({ level: 'error' });

      log.debug('debug message');
      log.info('info message');
      log.warn('warn message');
      log.error('error message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('output format', () => {
    it('includes timestamp in ISO format', () => {
      const log = createLogger({ level: 'info' });
      log.info('test');

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      // Check for ISO timestamp format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    it('includes log level in uppercase', () => {
      const log = createLogger({ level: 'debug' });

      log.debug('debug test');
      log.info('info test');
      log.warn('warn test');
      log.error('error test');

      expect(consoleDebugSpy.mock.calls[0][0] as string).toContain(' DEBUG ');
      expect(consoleInfoSpy.mock.calls[0][0] as string).toContain(' INFO ');
      expect(consoleWarnSpy.mock.calls[0][0] as string).toContain(' WARN ');
      expect(consoleErrorSpy.mock.calls[0][0] as string).toContain(' ERROR ');
    });

    it('includes message text', () => {
      const log = createLogger({ level: 'info' });
      log.info('my specific message');

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain('my specific message');
    });
  });

  describe('context serialization', () => {
    it('serializes context as JSON', () => {
      const log = createLogger({ level: 'info' });
      log.info('test', { count: 42, name: 'test' });

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain('{"count":42,"name":"test"}');
    });

    it('omits context when empty object', () => {
      const log = createLogger({ level: 'info' });
      log.info('test', {});

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).not.toContain('{}');
      expect(output).toMatch(/test$/);
    });

    it('omits context when undefined', () => {
      const log = createLogger({ level: 'info' });
      log.info('test');

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toMatch(/test$/);
    });

    it('handles nested objects in context', () => {
      const log = createLogger({ level: 'info' });
      log.info('test', { user: { id: 1, name: 'test' }, items: [1, 2, 3] });

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain('"user":{"id":1,"name":"test"}');
      expect(output).toContain('"items":[1,2,3]');
    });

    it('handles error objects in context', () => {
      const log = createLogger({ level: 'info' });
      const error = new Error('test error');
      log.info('test', { error: error.message });

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain('"error":"test error"');
    });

    it('handles null and undefined values in context', () => {
      const log = createLogger({ level: 'info' });
      log.info('test', { nullVal: null, undefVal: undefined });

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain('"nullVal":null');
      // undefined values are omitted by JSON.stringify
    });

    it('handles circular reference gracefully', () => {
      const log = createLogger({ level: 'info' });
      const circular: Record<string, unknown> = { name: 'test' };
      circular['self'] = circular;

      // Should not throw
      expect(() => log.info('test', circular)).not.toThrow();

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain('[context serialization failed]');
    });
  });

  describe('child loggers', () => {
    it('creates child logger with prefix', () => {
      const log = createLogger({ level: 'debug' });
      const child = log.child('MyComponent');

      child.info('test');

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain('[MyComponent]');
    });

    it('chains prefixes for nested children', () => {
      const log = createLogger({ level: 'debug' });
      const child = log.child('Component');
      const grandchild = child.child('Method');

      grandchild.info('test');

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain('[Component:Method]');
    });

    it('child inherits parent log level', () => {
      const log = createLogger({ level: 'warn' });
      const child = log.child('Child');

      child.debug('should not appear');
      child.info('should not appear');
      child.warn('should appear');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it('deeply nested children maintain prefix chain', () => {
      const log = createLogger({ level: 'info' });
      const l1 = log.child('A');
      const l2 = l1.child('B');
      const l3 = l2.child('C');

      l3.info('test');

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain('[A:B:C]');
    });
  });

  describe('getLevel', () => {
    it('returns configured level', () => {
      const debugLog = createLogger({ level: 'debug' });
      const infoLog = createLogger({ level: 'info' });
      const warnLog = createLogger({ level: 'warn' });
      const errorLog = createLogger({ level: 'error' });

      expect(debugLog.getLevel()).toBe('debug');
      expect(infoLog.getLevel()).toBe('info');
      expect(warnLog.getLevel()).toBe('warn');
      expect(errorLog.getLevel()).toBe('error');
    });

    it('child logger returns same level as parent', () => {
      const parent = createLogger({ level: 'warn' });
      const child = parent.child('Child');

      expect(child.getLevel()).toBe('warn');
    });
  });

  describe('isLevelEnabled', () => {
    it('returns true for enabled levels', () => {
      const log = createLogger({ level: 'info' });

      expect(log.isLevelEnabled('info')).toBe(true);
      expect(log.isLevelEnabled('warn')).toBe(true);
      expect(log.isLevelEnabled('error')).toBe(true);
    });

    it('returns false for disabled levels', () => {
      const log = createLogger({ level: 'info' });

      expect(log.isLevelEnabled('debug')).toBe(false);
    });

    it('works for all level combinations', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

      for (const minLevel of levels) {
        const log = createLogger({ level: minLevel });

        for (const checkLevel of levels) {
          const minPriority = levels.indexOf(minLevel);
          const checkPriority = levels.indexOf(checkLevel);
          const expected = checkPriority >= minPriority;

          expect(log.isLevelEnabled(checkLevel)).toBe(expected);
        }
      }
    });
  });

  describe('default logger', () => {
    it('is available as named export', () => {
      expect(logger).toBeDefined();
      expect(logger.info).toBeInstanceOf(Function);
    });

    it('can be used directly', () => {
      // Just verify it doesn't throw
      expect(() => logger.info('test')).not.toThrow();
    });

    it('supports child creation', () => {
      const child = logger.child('Test');
      expect(child).toBeDefined();
      expect(child.info).toBeInstanceOf(Function);
    });
  });

  describe('console method mapping', () => {
    it('uses console.debug for debug level', () => {
      const log = createLogger({ level: 'debug' });
      log.debug('test');

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
    });

    it('uses console.info for info level', () => {
      const log = createLogger({ level: 'info' });
      log.info('test');

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    });

    it('uses console.warn for warn level', () => {
      const log = createLogger({ level: 'info' });
      log.warn('test');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it('uses console.error for error level', () => {
      const log = createLogger({ level: 'info' });
      log.error('test');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('handles empty message', () => {
      const log = createLogger({ level: 'info' });
      expect(() => log.info('')).not.toThrow();
    });

    it('handles very long messages', () => {
      const log = createLogger({ level: 'info' });
      const longMessage = 'x'.repeat(10000);
      expect(() => log.info(longMessage)).not.toThrow();

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain(longMessage);
    });

    it('handles special characters in message', () => {
      const log = createLogger({ level: 'info' });
      log.info('test with\nnewlines\tand\ttabs');

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain('test with\nnewlines\tand\ttabs');
    });

    it('handles unicode in message and context', () => {
      const log = createLogger({ level: 'info' });
      log.info('Hello 世界 🌍', { emoji: '👍', chinese: '测试' });

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain('Hello 世界 🌍');
      expect(output).toContain('"emoji":"👍"');
      expect(output).toContain('"chinese":"测试"');
    });

    it('handles rapid sequential logging', () => {
      const log = createLogger({ level: 'debug' });

      for (let i = 0; i < 100; i++) {
        log.info(`message ${i}`, { index: i });
      }

      expect(consoleInfoSpy).toHaveBeenCalledTimes(100);
    });

    it('handles special characters in child name', () => {
      const log = createLogger({ level: 'info' });
      const child = log.child('Component/SubComponent');

      child.info('test');

      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain('[Component/SubComponent]');
    });
  });
});
