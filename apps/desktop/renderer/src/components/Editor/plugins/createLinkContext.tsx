import { createContext, useContext, useMemo, ReactNode } from 'react';

/**
 * Factory to create a typed React context, provider, and hook for link-type nodes.
 *
 * This reduces boilerplate for contexts that follow the pattern:
 * - A context value with `currentNoteId`, a click handler, and an error handler
 * - A provider that memoizes the value
 * - A hook that throws if used outside the provider
 *
 * @param displayName - Name used in error messages (e.g., "WikiLink", "PersonMention")
 * @returns An object containing the Provider component and useContext hook
 */
export function createLinkContext<TValue extends object>(
  displayName: string
): {
  Provider: React.FC<{ children: ReactNode } & TValue>;
  useContextValue: () => TValue;
} {
  const Context = createContext<TValue | null>(null);
  Context.displayName = `${displayName}Context`;

  function Provider({ children, ...value }: { children: ReactNode } & TValue): JSX.Element {
    // Extract all props except children as the context value
    // We use Object.values(value) as deps because TValue is a generic object type.
    // The linter can't statically analyze spread props, but Object.values correctly
    // captures all prop changes for memoization.
    const memoizedValue = useMemo(
      () => value as TValue,
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Dynamic deps from generic spread props; Object.values correctly tracks all changes
      Object.values(value)
    );
    return <Context.Provider value={memoizedValue}>{children}</Context.Provider>;
  }
  Provider.displayName = `${displayName}Provider`;

  function useContextValue(): TValue {
    const context = useContext(Context);
    if (!context) {
      throw new Error(`use${displayName}Context must be used within ${displayName}Provider`);
    }
    return context;
  }

  return { Provider, useContextValue };
}
