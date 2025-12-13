/**
 * ReferencesWidget component
 *
 * Extracts and displays wiki-links and URLs from note content.
 * Wiki-links navigate to the referenced note, URLs open in external browser.
 * Person mentions (@person) are NOT included - they're just inline references.
 */

import { useMemo, useCallback } from 'react';
import clsx from 'clsx';
import type { Note, NoteId, LexicalState } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';
import { ExternalLinkIcon, LinkIcon } from '@scribe/design-system';
import * as styles from './ReferencesWidget.css';

export interface Reference {
  type: 'wiki-link' | 'url';
  displayText: string;
  targetId?: NoteId; // For wiki-links
  url?: string; // For URLs
}

export interface ReferencesWidgetProps {
  note: Note;
  onNavigate: (noteId: NoteId) => void;
}

/**
 * Recursively extract wiki-links and URLs from Lexical content.
 * - Wiki-links: nodes with type 'wiki-link'
 * - URLs: link nodes with http/https URLs
 * - Person mentions (@person) are NOT included
 */
export function extractReferences(content: LexicalState): Reference[] {
  const refs: Reference[] = [];
  const seen = new Set<string>(); // Dedupe by targetId or URL

  function traverse(node: Record<string, unknown>) {
    // Extract wiki-links
    if (node.type === 'wiki-link') {
      const targetId = node.targetId as string | undefined;
      const displayText = (node.displayText || node.noteTitle || 'Untitled') as string;

      if (targetId && !seen.has(targetId)) {
        seen.add(targetId);
        refs.push({ type: 'wiki-link', displayText, targetId: createNoteId(targetId) });
      }
    }

    // Extract URL links (but not person mentions)
    if (node.type === 'link' && typeof node.url === 'string') {
      const url = node.url as string;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        if (!seen.has(url)) {
          seen.add(url);
          const displayText = (node.title as string) || truncateUrl(url);
          refs.push({ type: 'url', displayText, url });
        }
      }
    }

    // Traverse children
    const children = node.children as Record<string, unknown>[] | undefined;
    if (Array.isArray(children)) {
      for (const child of children) {
        traverse(child);
      }
    }
  }

  traverse(content.root as Record<string, unknown>);
  return refs;
}

/**
 * Truncate URL to fit in widget (removes protocol, truncates path).
 */
export function truncateUrl(url: string, maxLength = 40): string {
  // Remove protocol
  let display = url.replace(/^https?:\/\//, '');
  // Remove trailing slash
  display = display.replace(/\/$/, '');
  // Truncate if too long
  if (display.length > maxLength) {
    display = display.substring(0, maxLength - 3) + '...';
  }
  return display;
}

export function ReferencesWidget({ note, onNavigate }: ReferencesWidgetProps) {
  const references = useMemo(() => extractReferences(note.content), [note.content]);

  const handleClick = useCallback(
    (ref: Reference) => {
      if (ref.type === 'wiki-link' && ref.targetId) {
        onNavigate(ref.targetId);
      } else if (ref.type === 'url' && ref.url) {
        window.open(ref.url, '_blank', 'noopener,noreferrer');
      }
    },
    [onNavigate]
  );

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <LinkIcon size={14} className={clsx(styles.cardIcon, styles.cardIconTertiary)} />
        <span className={styles.cardTitle}>References</span>
      </div>

      {references.length === 0 ? (
        <div className={styles.emptyState}>No references</div>
      ) : (
        <div className={styles.list}>
          {references.map((ref, index) => (
            <button
              key={`${ref.type}-${ref.targetId || ref.url}-${index}`}
              className={styles.referenceItem}
              onClick={() => handleClick(ref)}
              type="button"
            >
              {ref.type === 'url' && (
                <span className={styles.urlIcon}>
                  <ExternalLinkIcon size={12} />
                </span>
              )}
              <span className={styles.referenceText}>{ref.displayText}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
