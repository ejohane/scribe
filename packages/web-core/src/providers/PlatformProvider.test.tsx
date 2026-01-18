import { describe, it, expect, vi } from 'vitest';
import { render, screen, renderHook } from '@testing-library/react';
import {
  PlatformProvider,
  usePlatform,
  useIsElectron,
  useWindowCapabilities,
  useDialogCapabilities,
  useShellCapabilities,
  useUpdateCapabilities,
  type PlatformCapabilities,
} from './PlatformProvider';

describe('PlatformProvider', () => {
  it('renders children', () => {
    render(
      <PlatformProvider platform="web" capabilities={{}}>
        <div data-testid="child">Child content</div>
      </PlatformProvider>
    );

    expect(screen.getByTestId('child')).toHaveTextContent('Child content');
  });
});

describe('usePlatform', () => {
  it('throws error when used outside PlatformProvider', () => {
    expect(() => {
      renderHook(() => usePlatform());
    }).toThrow('usePlatform must be used within PlatformProvider');
  });

  it('returns web platform info when platform is web', () => {
    const { result } = renderHook(() => usePlatform(), {
      wrapper: ({ children }) => (
        <PlatformProvider platform="web" capabilities={{}}>
          {children}
        </PlatformProvider>
      ),
    });

    expect(result.current.platform).toBe('web');
    expect(result.current.capabilities).toEqual({});
  });

  it('returns electron platform info with capabilities', () => {
    const mockCapabilities: PlatformCapabilities = {
      window: {
        openNewWindow: vi.fn(),
        openNoteInWindow: vi.fn(),
        close: vi.fn(),
      },
      dialog: {
        selectFolder: vi.fn().mockResolvedValue('/path/to/folder'),
        saveFile: vi.fn().mockResolvedValue(true),
      },
      shell: {
        openExternal: vi.fn(),
      },
      update: {
        check: vi.fn(),
        install: vi.fn(),
        onAvailable: vi.fn().mockReturnValue(() => {}),
      },
    };

    const { result } = renderHook(() => usePlatform(), {
      wrapper: ({ children }) => (
        <PlatformProvider platform="electron" capabilities={mockCapabilities}>
          {children}
        </PlatformProvider>
      ),
    });

    expect(result.current.platform).toBe('electron');
    expect(result.current.capabilities.window).toBeDefined();
    expect(result.current.capabilities.dialog).toBeDefined();
    expect(result.current.capabilities.shell).toBeDefined();
    expect(result.current.capabilities.update).toBeDefined();
  });
});

describe('useIsElectron', () => {
  it('returns false for web platform', () => {
    const { result } = renderHook(() => useIsElectron(), {
      wrapper: ({ children }) => (
        <PlatformProvider platform="web" capabilities={{}}>
          {children}
        </PlatformProvider>
      ),
    });

    expect(result.current).toBe(false);
  });

  it('returns true for electron platform', () => {
    const { result } = renderHook(() => useIsElectron(), {
      wrapper: ({ children }) => (
        <PlatformProvider platform="electron" capabilities={{}}>
          {children}
        </PlatformProvider>
      ),
    });

    expect(result.current).toBe(true);
  });
});

describe('useWindowCapabilities', () => {
  it('returns undefined when window capabilities not available', () => {
    const { result } = renderHook(() => useWindowCapabilities(), {
      wrapper: ({ children }) => (
        <PlatformProvider platform="web" capabilities={{}}>
          {children}
        </PlatformProvider>
      ),
    });

    expect(result.current).toBeUndefined();
  });

  it('returns window capabilities when available', () => {
    const mockWindow = {
      openNewWindow: vi.fn(),
      openNoteInWindow: vi.fn(),
      close: vi.fn(),
    };

    const { result } = renderHook(() => useWindowCapabilities(), {
      wrapper: ({ children }) => (
        <PlatformProvider platform="electron" capabilities={{ window: mockWindow }}>
          {children}
        </PlatformProvider>
      ),
    });

    expect(result.current).toBe(mockWindow);
  });
});

describe('useDialogCapabilities', () => {
  it('returns undefined when dialog capabilities not available', () => {
    const { result } = renderHook(() => useDialogCapabilities(), {
      wrapper: ({ children }) => (
        <PlatformProvider platform="web" capabilities={{}}>
          {children}
        </PlatformProvider>
      ),
    });

    expect(result.current).toBeUndefined();
  });

  it('returns dialog capabilities when available', () => {
    const mockDialog = {
      selectFolder: vi.fn().mockResolvedValue('/path'),
      saveFile: vi.fn().mockResolvedValue(true),
    };

    const { result } = renderHook(() => useDialogCapabilities(), {
      wrapper: ({ children }) => (
        <PlatformProvider platform="electron" capabilities={{ dialog: mockDialog }}>
          {children}
        </PlatformProvider>
      ),
    });

    expect(result.current).toBe(mockDialog);
  });
});

describe('useShellCapabilities', () => {
  it('returns undefined when shell capabilities not available', () => {
    const { result } = renderHook(() => useShellCapabilities(), {
      wrapper: ({ children }) => (
        <PlatformProvider platform="web" capabilities={{}}>
          {children}
        </PlatformProvider>
      ),
    });

    expect(result.current).toBeUndefined();
  });

  it('returns shell capabilities when available', () => {
    const mockShell = {
      openExternal: vi.fn(),
    };

    const { result } = renderHook(() => useShellCapabilities(), {
      wrapper: ({ children }) => (
        <PlatformProvider platform="electron" capabilities={{ shell: mockShell }}>
          {children}
        </PlatformProvider>
      ),
    });

    expect(result.current).toBe(mockShell);
  });
});

describe('useUpdateCapabilities', () => {
  it('returns undefined when update capabilities not available', () => {
    const { result } = renderHook(() => useUpdateCapabilities(), {
      wrapper: ({ children }) => (
        <PlatformProvider platform="web" capabilities={{}}>
          {children}
        </PlatformProvider>
      ),
    });

    expect(result.current).toBeUndefined();
  });

  it('returns update capabilities when available', () => {
    const mockUpdate = {
      check: vi.fn(),
      install: vi.fn(),
      onAvailable: vi.fn().mockReturnValue(() => {}),
    };

    const { result } = renderHook(() => useUpdateCapabilities(), {
      wrapper: ({ children }) => (
        <PlatformProvider platform="electron" capabilities={{ update: mockUpdate }}>
          {children}
        </PlatformProvider>
      ),
    });

    expect(result.current).toBe(mockUpdate);
  });
});
