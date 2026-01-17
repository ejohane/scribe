/// <reference types="@testing-library/jest-dom/vitest" />
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test to prevent memory leaks and test pollution
afterEach(() => {
  cleanup();
});
