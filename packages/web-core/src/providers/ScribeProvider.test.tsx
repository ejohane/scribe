import { describe, it, expect, vi } from 'vitest';
import { render, screen, renderHook } from '@testing-library/react';
import { ScribeProvider, useScribe, useTrpc } from './ScribeProvider';

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn().mockImplementation(() => ({})),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock @trpc/client
vi.mock('@trpc/client', () => ({
  createTRPCProxyClient: vi.fn().mockReturnValue({
    notes: { list: { query: vi.fn() } },
  }),
  httpBatchLink: vi.fn().mockReturnValue({}),
}));

describe('ScribeProvider', () => {
  it('renders children', () => {
    render(
      <ScribeProvider daemonUrl="http://localhost:3000">
        <div data-testid="child">Child content</div>
      </ScribeProvider>
    );

    expect(screen.getByTestId('child')).toHaveTextContent('Child content');
  });
});

describe('useScribe', () => {
  it('throws error when used outside ScribeProvider', () => {
    expect(() => {
      renderHook(() => useScribe());
    }).toThrow('useScribe must be used within ScribeProvider');
  });

  it('returns context value when used within ScribeProvider', () => {
    const { result } = renderHook(() => useScribe(), {
      wrapper: ({ children }) => (
        <ScribeProvider daemonUrl="http://localhost:3000">{children}</ScribeProvider>
      ),
    });

    expect(result.current).toHaveProperty('trpc');
  });
});

describe('useTrpc', () => {
  it('returns trpc client when used within ScribeProvider', () => {
    const { result } = renderHook(() => useTrpc(), {
      wrapper: ({ children }) => (
        <ScribeProvider daemonUrl="http://localhost:3000">{children}</ScribeProvider>
      ),
    });

    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty('notes');
  });
});
