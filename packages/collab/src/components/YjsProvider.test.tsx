/**
 * Tests for YjsProvider component
 */

import { describe, it, expect } from 'vitest';
import { render, screen, renderHook } from '@testing-library/react';
import { YjsProvider, useYjs } from './YjsProvider';

describe('YjsProvider', () => {
  it('renders children', () => {
    render(
      <YjsProvider>
        <div data-testid="child">Test content</div>
      </YjsProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toHaveTextContent('Test content');
  });

  it('renders with correct test id', () => {
    render(
      <YjsProvider>
        <span>Content</span>
      </YjsProvider>
    );

    expect(screen.getByTestId('yjs-provider')).toBeInTheDocument();
  });

  it('indicates disconnected state by default', () => {
    render(
      <YjsProvider>
        <span>Content</span>
      </YjsProvider>
    );

    expect(screen.getByTestId('yjs-provider')).toHaveAttribute('data-connected', 'false');
  });

  it('indicates connected state when connected', () => {
    render(
      <YjsProvider isConnected>
        <span>Content</span>
      </YjsProvider>
    );

    expect(screen.getByTestId('yjs-provider')).toHaveAttribute('data-connected', 'true');
  });

  describe('useYjs hook', () => {
    it('provides context values', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <YjsProvider documentId="doc-123" isConnected peerCount={3}>
          {children}
        </YjsProvider>
      );

      const { result } = renderHook(() => useYjs(), { wrapper });

      expect(result.current.documentId).toBe('doc-123');
      expect(result.current.isConnected).toBe(true);
      expect(result.current.peerCount).toBe(3);
    });

    it('throws error when used outside provider', () => {
      expect(() => {
        renderHook(() => useYjs());
      }).toThrow('useYjs must be used within a YjsProvider');
    });

    it('provides default values', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <YjsProvider>{children}</YjsProvider>
      );

      const { result } = renderHook(() => useYjs(), { wrapper });

      expect(result.current.documentId).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.peerCount).toBe(0);
    });
  });
});
