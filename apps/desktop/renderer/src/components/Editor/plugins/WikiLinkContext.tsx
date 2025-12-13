import { createContext, useContext, useMemo, ReactNode } from 'react';
import type { NoteId } from '@scribe/shared';

interface WikiLinkContextValue {
  currentNoteId: NoteId | null;
  onLinkClick: (noteTitle: string, targetId: NoteId | null) => Promise<void>;
  onError: (message: string) => void;
}

const WikiLinkContext = createContext<WikiLinkContextValue | null>(null);

export function useWikiLinkContext(): WikiLinkContextValue {
  const context = useContext(WikiLinkContext);
  if (!context) {
    throw new Error('useWikiLinkContext must be used within WikiLinkProvider');
  }
  return context;
}

interface WikiLinkProviderProps {
  children: ReactNode;
  currentNoteId: NoteId | null;
  onLinkClick: (noteTitle: string, targetId: NoteId | null) => Promise<void>;
  onError: (message: string) => void;
}

export function WikiLinkProvider({
  children,
  currentNoteId,
  onLinkClick,
  onError,
}: WikiLinkProviderProps): JSX.Element {
  const value = useMemo(
    () => ({ currentNoteId, onLinkClick, onError }),
    [currentNoteId, onLinkClick, onError]
  );
  return <WikiLinkContext.Provider value={value}>{children}</WikiLinkContext.Provider>;
}
