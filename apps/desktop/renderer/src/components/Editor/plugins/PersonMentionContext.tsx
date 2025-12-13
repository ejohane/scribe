import type { NoteId } from '@scribe/shared';
import { createLinkContext } from './createLinkContext';

export interface PersonMentionContextValue {
  currentNoteId: NoteId | null;
  onMentionClick: (personId: NoteId) => Promise<void>;
  onError: (message: string) => void;
}

const { Provider, useContextValue } = createLinkContext<PersonMentionContextValue>('PersonMention');

export const PersonMentionProvider = Provider;
export const usePersonMentionContext = useContextValue;
