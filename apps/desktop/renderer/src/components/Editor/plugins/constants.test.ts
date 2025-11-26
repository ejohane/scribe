import { describe, it, expect } from 'vitest';
import { HR_PATTERN } from './constants';

describe('HR_PATTERN', () => {
  describe('exact pattern', () => {
    it('matches --- exactly', () => {
      expect(HR_PATTERN.exact.test('---')).toBe(true);
    });

    it('matches *** exactly', () => {
      expect(HR_PATTERN.exact.test('***')).toBe(true);
    });

    it('matches ___ exactly', () => {
      expect(HR_PATTERN.exact.test('___')).toBe(true);
    });

    it('does not match with trailing space', () => {
      expect(HR_PATTERN.exact.test('--- ')).toBe(false);
    });

    it('does not match with leading space', () => {
      expect(HR_PATTERN.exact.test(' ---')).toBe(false);
    });

    it('does not match partial patterns', () => {
      expect(HR_PATTERN.exact.test('--')).toBe(false);
      expect(HR_PATTERN.exact.test('**')).toBe(false);
      expect(HR_PATTERN.exact.test('__')).toBe(false);
    });

    it('does not match longer patterns', () => {
      expect(HR_PATTERN.exact.test('----')).toBe(false);
      expect(HR_PATTERN.exact.test('****')).toBe(false);
      expect(HR_PATTERN.exact.test('____')).toBe(false);
    });

    it('does not match mixed patterns', () => {
      expect(HR_PATTERN.exact.test('-*-')).toBe(false);
      expect(HR_PATTERN.exact.test('*-*')).toBe(false);
      expect(HR_PATTERN.exact.test('_-_')).toBe(false);
    });

    it('does not match text before pattern', () => {
      expect(HR_PATTERN.exact.test('text---')).toBe(false);
    });

    it('does not match text after pattern', () => {
      expect(HR_PATTERN.exact.test('---text')).toBe(false);
    });
  });

  describe('withTrailingSpace pattern', () => {
    it('matches --- exactly', () => {
      expect(HR_PATTERN.withTrailingSpace.test('---')).toBe(true);
    });

    it('matches *** exactly', () => {
      expect(HR_PATTERN.withTrailingSpace.test('***')).toBe(true);
    });

    it('matches ___ exactly', () => {
      expect(HR_PATTERN.withTrailingSpace.test('___')).toBe(true);
    });

    it('matches --- with trailing space', () => {
      expect(HR_PATTERN.withTrailingSpace.test('--- ')).toBe(true);
    });

    it('matches *** with trailing space', () => {
      expect(HR_PATTERN.withTrailingSpace.test('*** ')).toBe(true);
    });

    it('matches ___ with trailing space', () => {
      expect(HR_PATTERN.withTrailingSpace.test('___ ')).toBe(true);
    });

    it('does not match with leading space', () => {
      expect(HR_PATTERN.withTrailingSpace.test(' ---')).toBe(false);
    });

    it('does not match with multiple trailing spaces', () => {
      expect(HR_PATTERN.withTrailingSpace.test('---  ')).toBe(false);
    });

    it('does not match partial patterns', () => {
      expect(HR_PATTERN.withTrailingSpace.test('--')).toBe(false);
      expect(HR_PATTERN.withTrailingSpace.test('-- ')).toBe(false);
    });

    it('does not match text after pattern', () => {
      expect(HR_PATTERN.withTrailingSpace.test('--- text')).toBe(false);
    });
  });
});
