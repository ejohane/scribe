/**
 * Tests for Plugin Logger Factory
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPluginLogger, createNoopLogger } from './logger.js';

describe('logger', () => {
  // Store original console methods
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

  describe('createPluginLogger', () => {
    it('creates a logger with all log methods', () => {
      const logger = createPluginLogger('@scribe/plugin-test');

      expect(logger.debug).toBeTypeOf('function');
      expect(logger.info).toBeTypeOf('function');
      expect(logger.warn).toBeTypeOf('function');
      expect(logger.error).toBeTypeOf('function');
    });

    it('prefixes debug messages with plugin ID', () => {
      const logger = createPluginLogger('@scribe/plugin-todo');
      logger.debug('Test debug message');

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[plugin:@scribe/plugin-todo]',
        'Test debug message'
      );
    });

    it('prefixes info messages with plugin ID', () => {
      const logger = createPluginLogger('@scribe/plugin-todo');
      logger.info('Test info message');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[plugin:@scribe/plugin-todo]',
        'Test info message'
      );
    });

    it('prefixes warn messages with plugin ID', () => {
      const logger = createPluginLogger('@scribe/plugin-todo');
      logger.warn('Test warning message');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[plugin:@scribe/plugin-todo]',
        'Test warning message'
      );
    });

    it('prefixes error messages with plugin ID', () => {
      const logger = createPluginLogger('@scribe/plugin-todo');
      logger.error('Test error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[plugin:@scribe/plugin-todo]',
        'Test error message'
      );
    });

    it('passes data object to console when provided', () => {
      const logger = createPluginLogger('@scribe/plugin-test');
      const data = { key: 'value', count: 42 };

      logger.info('Message with data', data);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[plugin:@scribe/plugin-test]',
        'Message with data',
        data
      );
    });

    it('handles different plugin ID formats', () => {
      const logger1 = createPluginLogger('simple-id');
      logger1.info('test');
      expect(consoleInfoSpy).toHaveBeenCalledWith('[plugin:simple-id]', 'test');

      const logger2 = createPluginLogger('@org/package-name');
      logger2.info('test');
      expect(consoleInfoSpy).toHaveBeenCalledWith('[plugin:@org/package-name]', 'test');
    });

    it('handles empty plugin ID', () => {
      const logger = createPluginLogger('');
      logger.info('test');
      expect(consoleInfoSpy).toHaveBeenCalledWith('[plugin:]', 'test');
    });
  });

  describe('createNoopLogger', () => {
    it('creates a logger with all log methods', () => {
      const logger = createNoopLogger();

      expect(logger.debug).toBeTypeOf('function');
      expect(logger.info).toBeTypeOf('function');
      expect(logger.warn).toBeTypeOf('function');
      expect(logger.error).toBeTypeOf('function');
    });

    it('does not call console methods', () => {
      const logger = createNoopLogger();

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('accepts data argument without error', () => {
      const logger = createNoopLogger();

      // Should not throw
      expect(() => {
        logger.info('message', { key: 'value' });
      }).not.toThrow();
    });
  });
});
