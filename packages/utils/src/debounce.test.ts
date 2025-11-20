import { describe, test, expect, mock } from 'bun:test';
import { debounce } from './debounce';

describe('debounce', () => {
  test('should delay function execution', async () => {
    const fn = mock(() => {});
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('should cancel previous calls', async () => {
    const fn = mock(() => {});
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('should pass arguments to the function', async () => {
    const fn = mock(() => {}) as any;
    const debounced = debounce(fn, 100);

    debounced(42, 'test');

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(fn).toHaveBeenCalledWith(42, 'test');
  });

  test('should respect delay timing', async () => {
    const fn = mock(() => {});
    const debounced = debounce(fn, 200);

    debounced();

    // After 100ms, should not have been called
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fn).not.toHaveBeenCalled();

    // After 250ms total, should have been called
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
