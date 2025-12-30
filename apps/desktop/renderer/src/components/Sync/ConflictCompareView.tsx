import {
  Overlay,
  Surface,
  Button,
  Text,
  ChevronLeftIcon,
  CheckIcon,
  CopyIcon,
} from '@scribe/design-system';
import type { SyncConflict } from '@scribe/shared';
import { formatRelativeTime } from '../../hooks/useSyncStatus';
import * as styles from './ConflictCompareView.css';

/** Maximum characters to display in preview before truncating */
const MAX_PREVIEW_LENGTH = 5000;

/**
 * Extract plain text from Lexical JSON content for preview display.
 * Handles nested paragraph and text nodes.
 *
 * @param content - Note content (Lexical JSON or string)
 * @returns Plain text string
 */
function extractPlainText(content: unknown): string {
  if (typeof content === 'string') {
    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(content);
      return extractPlainText(parsed);
    } catch {
      // Not JSON, return as-is
      return content;
    }
  }

  if (!content || typeof content !== 'object') {
    return '';
  }

  const obj = content as Record<string, unknown>;

  // Handle Lexical root structure
  if (obj.root && typeof obj.root === 'object') {
    return extractPlainText(obj.root);
  }

  // Handle children array
  if (Array.isArray(obj.children)) {
    return obj.children
      .map((child) => extractPlainText(child))
      .filter(Boolean)
      .join('\n');
  }

  // Handle text node
  if (obj.type === 'text' && typeof obj.text === 'string') {
    return obj.text;
  }

  // Handle paragraph or other container nodes
  if (obj.type && Array.isArray(obj.children)) {
    const text = obj.children
      .map((child) => extractPlainText(child))
      .filter(Boolean)
      .join('');
    return text;
  }

  return '';
}

/**
 * Get a display title from a note object.
 */
function getNoteTitle(note: unknown): string {
  if (!note || typeof note !== 'object') return 'Untitled Note';
  const n = note as { metadata?: { title?: string }; title?: string };
  return n?.metadata?.title ?? n?.title ?? 'Untitled Note';
}

/**
 * Get content from a note object.
 */
function getNoteContent(note: unknown): unknown {
  if (!note || typeof note !== 'object') return null;
  const n = note as { content?: unknown };
  return n?.content ?? null;
}

/**
 * Get timestamp from a note object.
 */
function getNoteTimestamp(note: unknown, fallback: number): number {
  if (!note || typeof note !== 'object') return fallback;
  const n = note as { updatedAt?: number; metadata?: { updatedAt?: number } };
  return n?.updatedAt ?? n?.metadata?.updatedAt ?? fallback;
}

export interface ConflictCompareViewProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The conflict to display (null when not viewing a conflict) */
  conflict: SyncConflict | null;
  /** Callback when user clicks back button */
  onBack: () => void;
  /** Callback when user resolves the conflict */
  onResolve: (noteId: string, resolution: 'local' | 'remote' | 'keepBoth') => void;
}

/**
 * Side-by-side comparison view for sync conflicts.
 *
 * Displays local and remote versions of a conflicting note,
 * allowing users to see exactly what changed and choose which
 * version to keep.
 *
 * @example
 * ```tsx
 * <ConflictCompareView
 *   isOpen={showCompare}
 *   conflict={selectedConflict}
 *   onBack={() => setShowCompare(false)}
 *   onResolve={handleResolve}
 * />
 * ```
 */
export function ConflictCompareView({
  isOpen,
  conflict,
  onBack,
  onResolve,
}: ConflictCompareViewProps) {
  if (!isOpen || !conflict) return null;

  const title = getNoteTitle(conflict.localNote);
  const localContent = extractPlainText(getNoteContent(conflict.localNote));
  const remoteContent = extractPlainText(getNoteContent(conflict.remoteNote));

  const localTimestamp = getNoteTimestamp(conflict.localNote, conflict.detectedAt);
  const remoteTimestamp = getNoteTimestamp(conflict.remoteNote, conflict.detectedAt);

  const localTruncated = localContent.length > MAX_PREVIEW_LENGTH;
  const remoteTruncated = remoteContent.length > MAX_PREVIEW_LENGTH;

  const displayLocalContent = localTruncated
    ? localContent.slice(0, MAX_PREVIEW_LENGTH)
    : localContent;
  const displayRemoteContent = remoteTruncated
    ? remoteContent.slice(0, MAX_PREVIEW_LENGTH)
    : remoteContent;

  const handleKeepLocal = () => {
    onResolve(conflict.noteId, 'local');
  };

  const handleKeepRemote = () => {
    onResolve(conflict.noteId, 'remote');
  };

  const handleKeepBoth = () => {
    onResolve(conflict.noteId, 'keepBoth');
  };

  return (
    <Overlay
      open={isOpen}
      onClose={onBack}
      backdrop="blur"
      closeOnEscape
      ariaLabelledby="compare-view-title"
      ariaDescribedby="compare-view-description"
    >
      <Surface className={styles.container} elevation="lg" radius="lg">
        {/* Header */}
        <header className={styles.header}>
          <Button variant="ghost" size="sm" onClick={onBack} className={styles.backButton}>
            <ChevronLeftIcon size={16} />
            Back to conflicts
          </Button>
          <div className={styles.headerTitle}>
            <Text as="span" weight="bold" size="lg" id="compare-view-title">
              {title}
            </Text>
          </div>
        </header>

        {/* Side-by-side content */}
        <div className={styles.content} id="compare-view-description">
          {/* Local Version Panel */}
          <div className={styles.versionPanel}>
            <div className={styles.versionHeader}>
              <span className={styles.versionLabel}>
                <span className={styles.localIndicator} />
                Local Version
              </span>
              <span className={styles.timestamp}>{formatRelativeTime(localTimestamp)}</span>
            </div>
            <div className={styles.versionContent}>
              {displayLocalContent ? (
                displayLocalContent
              ) : (
                <span className={styles.emptyContent}>No content</span>
              )}
            </div>
            {localTruncated && (
              <div className={styles.truncationNotice}>
                Content truncated ({localContent.length.toLocaleString()} characters total)
              </div>
            )}
            <Button variant="subtle" className={styles.keepButton} onClick={handleKeepLocal}>
              <CheckIcon size={16} />
              Keep This Version
            </Button>
          </div>

          {/* Remote Version Panel */}
          <div className={styles.versionPanel}>
            <div className={styles.versionHeader}>
              <span className={styles.versionLabel}>
                <span className={styles.remoteIndicator} />
                Remote Version
              </span>
              <span className={styles.timestamp}>{formatRelativeTime(remoteTimestamp)}</span>
            </div>
            <div className={styles.versionContent}>
              {displayRemoteContent ? (
                displayRemoteContent
              ) : (
                <span className={styles.emptyContent}>No content</span>
              )}
            </div>
            {remoteTruncated && (
              <div className={styles.truncationNotice}>
                Content truncated ({remoteContent.length.toLocaleString()} characters total)
              </div>
            )}
            <Button variant="subtle" className={styles.keepButton} onClick={handleKeepRemote}>
              <CheckIcon size={16} />
              Keep This Version
            </Button>
          </div>
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          <Button variant="ghost" onClick={onBack}>
            Cancel
          </Button>
          <div className={styles.footerActions}>
            <Button variant="subtle" onClick={handleKeepBoth}>
              <CopyIcon size={16} />
              Keep Both (create copy)
            </Button>
          </div>
        </footer>
      </Surface>
    </Overlay>
  );
}
