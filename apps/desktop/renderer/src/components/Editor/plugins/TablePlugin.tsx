/**
 * TablePlugin
 *
 * Wrapper around Lexical's TablePlugin that enables table functionality.
 * The actual INSERT_TABLE_COMMAND handling is done by @lexical/react's TablePlugin.
 * This file exists as a named export point and to configure table behavior.
 */

import { TablePlugin as LexicalTablePlugin } from '@lexical/react/LexicalTablePlugin';

/**
 * Plugin to enable table functionality in the editor.
 *
 * Features:
 * - Handles INSERT_TABLE_COMMAND to create tables
 * - Enables tab navigation between cells
 * - Supports cell merging and background colors
 */
export function TablePlugin(): JSX.Element | null {
  return (
    <LexicalTablePlugin hasCellMerge={true} hasCellBackgroundColor={true} hasTabHandler={true} />
  );
}
