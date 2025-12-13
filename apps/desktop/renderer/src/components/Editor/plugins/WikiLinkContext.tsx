import type { NoteId } from '@scribe/shared';
import { createLinkContext } from './createLinkContext';

export interface WikiLinkContextValue {
  currentNoteId: NoteId | null;
  onLinkClick: (noteTitle: string, targetId: NoteId | null) => Promise<void>;
  onError: (message: string) => void;
}

const { Provider, useContextValue } = createLinkContext<WikiLinkContextValue>('WikiLink');

export const WikiLinkProvider = Provider;
export const useWikiLinkContext = useContextValue;
