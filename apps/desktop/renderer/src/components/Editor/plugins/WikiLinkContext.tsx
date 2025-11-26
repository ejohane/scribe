import { createContext, useContext, ReactNode } from 'react';
import type { NoteId } from '@scribe/shared';

interface WikiLinkContextValue {
  currentNoteId: NoteId | null;
  onLinkClick: (noteTitle: string, targetId: NoteId | null) => Promise<void>;
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
}

export function WikiLinkProvider({
  children,
  currentNoteId,
  onLinkClick,
}: WikiLinkProviderProps): JSX.Element {
  return (
    <WikiLinkContext.Provider value={{ currentNoteId, onLinkClick }}>
      {children}
    </WikiLinkContext.Provider>
  );
}
