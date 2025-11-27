import { createContext, useContext, useMemo, ReactNode } from 'react';
import type { NoteId } from '@scribe/shared';

interface PersonMentionContextValue {
  currentNoteId: NoteId | null;
  onMentionClick: (personId: NoteId) => Promise<void>;
  onError: (message: string) => void;
}

const PersonMentionContext = createContext<PersonMentionContextValue | null>(null);

interface PersonMentionProviderProps {
  currentNoteId: NoteId | null;
  onMentionClick: (personId: NoteId) => Promise<void>;
  onError: (message: string) => void;
  children: ReactNode;
}

export function PersonMentionProvider({
  currentNoteId,
  onMentionClick,
  onError,
  children,
}: PersonMentionProviderProps): JSX.Element {
  const value = useMemo(
    () => ({ currentNoteId, onMentionClick, onError }),
    [currentNoteId, onMentionClick, onError]
  );
  return <PersonMentionContext.Provider value={value}>{children}</PersonMentionContext.Provider>;
}

export function usePersonMentionContext(): PersonMentionContextValue {
  const context = useContext(PersonMentionContext);
  if (!context) {
    throw new Error('usePersonMentionContext must be used within PersonMentionProvider');
  }
  return context;
}
