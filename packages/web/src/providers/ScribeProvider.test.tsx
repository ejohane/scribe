/**
 * Tests for ScribeProvider
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, renderHook } from '@testing-library/react';
import { ScribeProvider, useScribe } from './ScribeProvider';

describe('ScribeProvider', () => {
  it('renders children', () => {
    render(
      <ScribeProvider>
        <div data-testid="child">Test Child</div>
      </ScribeProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('provides context value', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ScribeProvider>{children}</ScribeProvider>
    );

    const { result } = renderHook(() => useScribe(), { wrapper });

    expect(result.current).toHaveProperty('isConnected');
    expect(result.current.isConnected).toBe(false);
  });
});

describe('useScribe', () => {
  it('throws error when used outside provider', () => {
    // Suppress console.error for this test since we expect an error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useScribe());
    }).toThrow('useScribe must be used within a ScribeProvider');

    consoleSpy.mockRestore();
  });

  it('returns context value when used within provider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ScribeProvider>{children}</ScribeProvider>
    );

    const { result } = renderHook(() => useScribe(), { wrapper });

    expect(result.current).toBeDefined();
    expect(result.current.isConnected).toBe(false);
  });
});
