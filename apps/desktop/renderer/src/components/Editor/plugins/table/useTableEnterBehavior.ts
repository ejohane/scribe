/**
 * useTableEnterBehavior
 *
 * Handles Enter key in tables:
 * - Always inserts line break in cells (not paragraph)
 * - Allows list continuation when inside a list
 */

import { useEffect } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  $createLineBreakNode,
  KEY_ENTER_COMMAND,
  COMMAND_PRIORITY_HIGH,
  LexicalEditor,
} from 'lexical';
import {
  $isSelectionInTable,
  $isSelectionInList,
  $getTableCellFromSelection,
  $getTableFromCell,
} from './tableUtils';

export function useTableEnterBehavior(editor: LexicalEditor): void {
  useEffect(() => {
    const removeEnterCommand = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (!$isSelectionInTable()) {
          return false;
        }

        // If inside a list, let the list plugin handle Enter
        if ($isSelectionInList()) {
          return false;
        }

        const cell = $getTableCellFromSelection();
        if (!cell) return false;

        const table = $getTableFromCell(cell);
        if (!table) return false;

        // Insert line break (not paragraph)
        if (event) event.preventDefault();
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertNodes([$createLineBreakNode()]);
        }
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    return removeEnterCommand;
  }, [editor]);
}
