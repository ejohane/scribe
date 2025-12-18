/**
 * useTableTabNavigation
 *
 * Handles Tab/Shift+Tab navigation in tables:
 * - Tab at last cell adds a new row
 * - Shift+Tab at first cell exits table before
 * - Suppresses TabIndentationPlugin inside tables
 */

import { useEffect } from 'react';
import { KEY_TAB_COMMAND, COMMAND_PRIORITY_CRITICAL, LexicalEditor } from 'lexical';
import { $insertTableRow__EXPERIMENTAL } from '@lexical/table';
import {
  $isSelectionInTable,
  $getTableCellFromSelection,
  $getTableFromCell,
  $isFirstCellInTable,
  $isLastCellInTable,
  $exitTableBefore,
} from './tableUtils';

export function useTableTabNavigation(editor: LexicalEditor): void {
  useEffect(() => {
    const removeTabCommand = editor.registerCommand(
      KEY_TAB_COMMAND,
      (event: KeyboardEvent) => {
        if (!$isSelectionInTable()) {
          return false;
        }

        const cell = $getTableCellFromSelection();
        if (!cell) return false;

        const table = $getTableFromCell(cell);
        if (!table) return false;

        // Shift+Tab at first cell - exit table before
        if (event.shiftKey && $isFirstCellInTable(cell)) {
          event.preventDefault();
          $exitTableBefore(table);
          return true;
        }

        // Tab at last cell - add new row
        if (!event.shiftKey && $isLastCellInTable(cell)) {
          event.preventDefault();
          $insertTableRow__EXPERIMENTAL(true);
          return true;
        }

        // Let TablePlugin handle normal tab navigation
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );

    return removeTabCommand;
  }, [editor]);
}
