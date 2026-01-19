/**
 * useDebouncedValue Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('does not update value before delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'initial' },
    });

    rerender({ value: 'updated' });

    // Before delay, value should still be initial
    expect(result.current).toBe('initial');
  });

  it('updates value after delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'initial' },
    });

    rerender({ value: 'updated' });

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('updated');
  });

  it('resets timer when value changes rapidly', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'initial' },
    });

    rerender({ value: 'first' });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: 'second' });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: 'third' });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Not enough time has passed since last change
    expect(result.current).toBe('initial');

    // Now wait the full delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should have the last value
    expect(result.current).toBe('third');
  });

  it('works with different data types', () => {
    // Number
    const { result: numResult } = renderHook(() => useDebouncedValue(42, 100));
    expect(numResult.current).toBe(42);

    // Object
    const obj = { foo: 'bar' };
    const { result: objResult } = renderHook(() => useDebouncedValue(obj, 100));
    expect(objResult.current).toBe(obj);

    // Array
    const arr = [1, 2, 3];
    const { result: arrResult } = renderHook(() => useDebouncedValue(arr, 100));
    expect(arrResult.current).toBe(arr);
  });

  it('handles zero delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 0), {
      initialProps: { value: 'initial' },
    });

    rerender({ value: 'updated' });

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current).toBe('updated');
  });
});
