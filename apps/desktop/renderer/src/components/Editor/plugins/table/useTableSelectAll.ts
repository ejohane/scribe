/**
 * useTableSelectAll
 *
 * Handles Cmd/Ctrl+A in tables:
 * - Selects entire table when cursor is in a table
 */

import { useEffect } from 'react';
import { KEY_DOWN_COMMAND, COMMAND_PRIORITY_HIGH, LexicalEditor } from 'lexical';
import {
  $isSelectionInTable,
  $getTableCellFromSelection,
  $getTableFromCell,
  $selectEntireTable,
  $isTableSelection,
} from './tableUtils';
import { $getSelection } from 'lexical';

export function useTableSelectAll(editor: LexicalEditor): void {
  useEffect(() => {
    const removeSelectAllCommand = editor.registerCommand<KeyboardEvent>(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        // Check for Cmd+A (Mac) or Ctrl+A (Windows/Linux)
        const isSelectAll = event.key === 'a' && (event.metaKey || event.ctrlKey);
        if (!isSelectAll) {
          return false;
        }

        const selection = $getSelection();

        // If already a table selection, let default behavior handle it
        if ($isTableSelection(selection)) {
          return false;
        }

        // Only handle if in a table with a range selection
        if (!$isSelectionInTable()) {
          return false;
        }

        const cell = $getTableCellFromSelection();
        if (!cell) return false;

        const table = $getTableFromCell(cell);
        if (!table) return false;

        // Select the entire table
        event.preventDefault();
        $selectEntireTable(table);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    return removeSelectAllCommand;
  }, [editor]);
}
