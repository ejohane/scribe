/**
 * useTableEscape
 *
 * Handles Escape key in tables:
 * - Exits table, cursor after table
 */

import { useEffect } from 'react';
import { KEY_ESCAPE_COMMAND, COMMAND_PRIORITY_HIGH, LexicalEditor } from 'lexical';
import {
  $isSelectionInTable,
  $getTableCellFromSelection,
  $getTableFromCell,
  $exitTableAfter,
} from './tableUtils';

export function useTableEscape(editor: LexicalEditor): void {
  useEffect(() => {
    const removeEscapeCommand = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        if (!$isSelectionInTable()) {
          return false;
        }

        const cell = $getTableCellFromSelection();
        if (!cell) return false;

        const table = $getTableFromCell(cell);
        if (!table) return false;

        $exitTableAfter(table);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    return removeEscapeCommand;
  }, [editor]);
}
