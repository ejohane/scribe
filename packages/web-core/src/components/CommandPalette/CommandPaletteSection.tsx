/**
 * CommandPaletteSection
 *
 * A section header in the command palette for grouping items.
 *
 * @module
 */

import type { ReactNode } from 'react';
import clsx from 'clsx';
import * as styles from './CommandPalette.css';

export interface CommandPaletteSectionProps {
  /** Section label */
  label: string;
  /** Section contents (items) */
  children: ReactNode;
  /** Optional className */
  className?: string;
}

/**
 * A labeled section in the command palette.
 */
export function CommandPaletteSection({ label, children, className }: CommandPaletteSectionProps) {
  return (
    <div className={clsx(styles.section, className)} role="group" aria-label={label}>
      <div className={styles.sectionLabel}>{label}</div>
      {children}
    </div>
  );
}
