/**
 * Tests for WebSocket protocol message types and utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeBytes,
  decodeBytes,
  encodeServerMessage,
  parseClientMessage,
  isClientMessage,
  isServerMessage,
  type ServerMessage,
  type ClientMessage,
} from './protocol.js';

describe('protocol', () => {
  describe('encodeBytes', () => {
    it('should encode Uint8Array to base64 string', () => {
      const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const encoded = encodeBytes(data);

      expect(encoded).toBe('SGVsbG8=');
    });

    it('should handle empty array', () => {
      const data = new Uint8Array([]);
      const encoded = encodeBytes(data);

      expect(encoded).toBe('');
    });

    it('should handle binary data', () => {
      const data = new Uint8Array([0, 255, 128, 64]);
      const encoded = encodeBytes(data);

      expect(encoded).toBe('AP+AQA==');
    });
  });

  describe('decodeBytes', () => {
    it('should decode base64 string to Uint8Array', () => {
      const decoded = decodeBytes('SGVsbG8=');

      expect(decoded).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it('should handle empty string', () => {
      const decoded = decodeBytes('');

      expect(decoded).toEqual(new Uint8Array([]));
    });

    it('should handle binary data', () => {
      const decoded = decodeBytes('AP+AQA==');

      expect(decoded).toEqual(new Uint8Array([0, 255, 128, 64]));
    });

    it('should roundtrip with encodeBytes', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 255, 128, 0]);
      const roundtripped = decodeBytes(encodeBytes(original));

      expect(roundtripped).toEqual(original);
    });
  });

  describe('encodeServerMessage', () => {
    it('should encode joined message', () => {
      const message: ServerMessage = {
        type: 'joined',
        noteId: 'note-123',
        stateVector: 'base64state',
      };
      const encoded = encodeServerMessage(message);

      expect(JSON.parse(encoded)).toEqual(message);
    });

    it('should encode sync-state message', () => {
      const message: ServerMessage = {
        type: 'sync-state',
        noteId: 'note-123',
        state: 'base64state',
      };
      const encoded = encodeServerMessage(message);

      expect(JSON.parse(encoded)).toEqual(message);
    });

    it('should encode sync-update message', () => {
      const message: ServerMessage = {
        type: 'sync-update',
        noteId: 'note-123',
        update: 'base64update',
      };
      const encoded = encodeServerMessage(message);

      expect(JSON.parse(encoded)).toEqual(message);
    });

    it('should encode error message', () => {
      const message: ServerMessage = {
        type: 'error',
        message: 'Something went wrong',
        code: 'ERR_123',
      };
      const encoded = encodeServerMessage(message);

      expect(JSON.parse(encoded)).toEqual(message);
    });

    it('should encode error message without code', () => {
      const message: ServerMessage = {
        type: 'error',
        message: 'Something went wrong',
      };
      const encoded = encodeServerMessage(message);

      expect(JSON.parse(encoded)).toEqual(message);
    });
  });

  describe('parseClientMessage', () => {
    it('should parse join message', () => {
      const input = JSON.stringify({ type: 'join', noteId: 'note-123' });
      const parsed = parseClientMessage(input);

      expect(parsed).toEqual({ type: 'join', noteId: 'note-123' });
    });

    it('should parse leave message', () => {
      const input = JSON.stringify({ type: 'leave', noteId: 'note-123' });
      const parsed = parseClientMessage(input);

      expect(parsed).toEqual({ type: 'leave', noteId: 'note-123' });
    });

    it('should parse sync-update message', () => {
      const input = JSON.stringify({
        type: 'sync-update',
        noteId: 'note-123',
        update: 'base64update',
      });
      const parsed = parseClientMessage(input);

      expect(parsed).toEqual({
        type: 'sync-update',
        noteId: 'note-123',
        update: 'base64update',
      });
    });

    it('should accept Buffer input', () => {
      const input = Buffer.from(JSON.stringify({ type: 'join', noteId: 'note-123' }));
      const parsed = parseClientMessage(input);

      expect(parsed).toEqual({ type: 'join', noteId: 'note-123' });
    });

    it('should throw on invalid JSON', () => {
      expect(() => parseClientMessage('not json')).toThrow();
    });

    it('should throw on non-object', () => {
      expect(() => parseClientMessage('"string"')).toThrow('not an object');
    });

    it('should throw on missing type', () => {
      expect(() => parseClientMessage(JSON.stringify({ noteId: '123' }))).toThrow('missing type');
    });

    it('should throw on unknown type', () => {
      expect(() => parseClientMessage(JSON.stringify({ type: 'unknown', noteId: '123' }))).toThrow(
        'unknown type'
      );
    });

    it('should throw on join with missing noteId', () => {
      expect(() => parseClientMessage(JSON.stringify({ type: 'join' }))).toThrow('missing noteId');
    });

    it('should throw on leave with missing noteId', () => {
      expect(() => parseClientMessage(JSON.stringify({ type: 'leave' }))).toThrow('missing noteId');
    });

    it('should throw on sync-update with missing noteId', () => {
      expect(() =>
        parseClientMessage(JSON.stringify({ type: 'sync-update', update: 'base64' }))
      ).toThrow('missing noteId');
    });

    it('should throw on sync-update with missing update', () => {
      expect(() =>
        parseClientMessage(JSON.stringify({ type: 'sync-update', noteId: '123' }))
      ).toThrow('missing update');
    });
  });

  describe('isClientMessage', () => {
    it('should return true for join message', () => {
      const msg: ClientMessage = { type: 'join', noteId: '123' };
      expect(isClientMessage(msg)).toBe(true);
    });

    it('should return true for leave message', () => {
      const msg: ClientMessage = { type: 'leave', noteId: '123' };
      expect(isClientMessage(msg)).toBe(true);
    });

    it('should return true for sync-update message', () => {
      const msg: ClientMessage = {
        type: 'sync-update',
        noteId: '123',
        update: 'base64',
      };
      expect(isClientMessage(msg)).toBe(true);
    });

    it('should return false for server messages', () => {
      expect(isClientMessage({ type: 'joined', noteId: '123', stateVector: '' })).toBe(false);
      expect(isClientMessage({ type: 'sync-state', noteId: '123', state: '' })).toBe(false);
      expect(isClientMessage({ type: 'error', message: 'err' })).toBe(false);
    });

    it('should return false for invalid inputs', () => {
      expect(isClientMessage(null)).toBe(false);
      expect(isClientMessage(undefined)).toBe(false);
      expect(isClientMessage('string')).toBe(false);
      expect(isClientMessage(123)).toBe(false);
      expect(isClientMessage({})).toBe(false);
    });
  });

  describe('isServerMessage', () => {
    it('should return true for joined message', () => {
      const msg: ServerMessage = {
        type: 'joined',
        noteId: '123',
        stateVector: '',
      };
      expect(isServerMessage(msg)).toBe(true);
    });

    it('should return true for sync-state message', () => {
      const msg: ServerMessage = {
        type: 'sync-state',
        noteId: '123',
        state: '',
      };
      expect(isServerMessage(msg)).toBe(true);
    });

    it('should return true for sync-update message', () => {
      const msg: ServerMessage = {
        type: 'sync-update',
        noteId: '123',
        update: '',
      };
      expect(isServerMessage(msg)).toBe(true);
    });

    it('should return true for error message', () => {
      const msg: ServerMessage = { type: 'error', message: 'err' };
      expect(isServerMessage(msg)).toBe(true);
    });

    it('should return false for client messages', () => {
      expect(isServerMessage({ type: 'join', noteId: '123' })).toBe(false);
      expect(isServerMessage({ type: 'leave', noteId: '123' })).toBe(false);
    });

    it('should return false for invalid inputs', () => {
      expect(isServerMessage(null)).toBe(false);
      expect(isServerMessage(undefined)).toBe(false);
      expect(isServerMessage('string')).toBe(false);
      expect(isServerMessage(123)).toBe(false);
      expect(isServerMessage({})).toBe(false);
    });
  });
});
