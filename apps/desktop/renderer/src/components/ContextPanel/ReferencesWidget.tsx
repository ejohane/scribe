/**
 * ReferencesWidget component
 *
 * Extracts and displays wiki-links and URLs from note content.
 * Wiki-links navigate to the referenced note, URLs open in external browser.
 * Person mentions (@person) are NOT included - they're just inline references.
 */

import { useState, useMemo, useCallback } from 'react';
import clsx from 'clsx';
import type { Note, NoteId, EditorContent } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';
import { ExternalLinkIcon, LinkIcon, ChevronDownIcon, ChevronUpIcon } from '@scribe/design-system';
import * as styles from './ReferencesWidget.css';

/** Number of references to show in collapsed state */
const COLLAPSED_LIMIT = 5;
/** Maximum number of references to show in expanded state */
const EXPANDED_LIMIT = 15;

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
 * Extract text content from a node's children recursively.
 * Handles nested structures like formatted text within links:
 * - [**bold** and plain](url) → "bold and plain"
 * - [Part 1 Part 2](url) → "Part 1 Part 2"
 *
 * @param node - A Lexical node with optional children array
 * @returns Concatenated text from all text nodes, or empty string
 */
export function extractChildrenText(node: Record<string, unknown>): string {
  const textParts: string[] = [];

  function traverse(n: Record<string, unknown>) {
    // Extract text from text nodes
    if (n.type === 'text' && typeof n.text === 'string') {
      textParts.push(n.text);
    }
    // Recursively process children
    if (Array.isArray(n.children)) {
      for (const child of n.children as Record<string, unknown>[]) {
        traverse(child);
      }
    }
  }

  // Start traversal from node's children
  if (Array.isArray(node.children)) {
    for (const child of node.children as Record<string, unknown>[]) {
      traverse(child);
    }
  }

  return textParts.join('');
}

/**
 * Recursively extract wiki-links and URLs from Lexical content.
 * - Wiki-links: nodes with type 'wiki-link'
 * - URLs: link nodes with http/https URLs
 * - Person mentions (@person) are NOT included
 */
export function extractReferences(content: EditorContent): Reference[] {
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

    // Extract URL links (both regular links and auto-detected URLs, but not person mentions)
    if ((node.type === 'link' || node.type === 'autolink') && typeof node.url === 'string') {
      const url = node.url as string;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        if (!seen.has(url)) {
          seen.add(url);
          // Extract text from children first (link alias), then fall back to title attr, then truncated URL
          const childrenText = extractChildrenText(node);
          const displayText = childrenText || (node.title as string) || truncateUrl(url);
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
  const [isExpanded, setIsExpanded] = useState(false);

  const references = useMemo(() => extractReferences(note.content), [note.content]);

  // Determine which references to display based on expanded state
  const visibleReferences = useMemo(() => {
    const limit = isExpanded ? EXPANDED_LIMIT : COLLAPSED_LIMIT;
    return references.slice(0, limit);
  }, [references, isExpanded]);

  // Show expand button if there are more than COLLAPSED_LIMIT references
  const showExpandButton = references.length > COLLAPSED_LIMIT;

  // Calculate remaining references count for the button label
  const remainingCount = Math.min(
    references.length - COLLAPSED_LIMIT,
    EXPANDED_LIMIT - COLLAPSED_LIMIT
  );

  const handleExpandToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

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
        <>
          <div className={clsx(styles.list, isExpanded && styles.referenceListScrollable)}>
            {visibleReferences.map((ref, index) => (
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
          {showExpandButton && (
            <button
              className={styles.expandButton}
              onClick={handleExpandToggle}
              type="button"
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <>
                  <ChevronUpIcon size={12} />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDownIcon size={12} />
                  Show {remainingCount} more
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
