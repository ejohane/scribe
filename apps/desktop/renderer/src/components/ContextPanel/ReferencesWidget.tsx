/**
 * ReferencesWidget component
 *
 * Extracts and displays wiki-links and URLs from note content.
 * Wiki-links navigate to the referenced note, URLs open in external browser.
 * Person mentions (@person) are NOT included - they're just inline references.
 */

import { useMemo, useCallback } from 'react';
import type { Note, NoteId, LexicalState } from '@scribe/shared';
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
        refs.push({ type: 'wiki-link', displayText, targetId });
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

/**
 * External link icon for URLs
 */
function ExternalLinkIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/**
 * Reference/link icon for the card header
 */
function ReferenceIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.cardIcon}
      style={{ color: '#8b5cf6' }}
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
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
        <ReferenceIcon size={14} />
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
