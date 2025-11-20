import { describe, test, expect } from 'bun:test';
import { App } from './App';

describe('App Component', () => {
  test('should export App component', () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
  });

  test('should be a valid React component', () => {
    expect(App.name).toBe('App');
  });
});
