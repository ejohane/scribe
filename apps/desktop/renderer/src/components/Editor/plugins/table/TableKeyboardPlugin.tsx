/**
 * TableKeyboardPlugin
 *
 * Handles table-specific keyboard behaviors:
 * - Tab/Shift+Tab navigation between cells (Tab at last cell adds new row)
 * - Enter behavior (always inserts line break in cells, allows list continuation)
 * - Escape to exit table
 * - Cmd/Ctrl+A to select entire table when cursor is in a table
 * - Backspace/Delete to delete table when entire table is selected or when empty
 * - Suppresses TabIndentationPlugin inside tables
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useTableTabNavigation } from './useTableTabNavigation';
import { useTableEnterBehavior } from './useTableEnterBehavior';
import { useTableEscape } from './useTableEscape';
import { useTableSelectAll } from './useTableSelectAll';
import { useTableDeletion } from './useTableDeletion';

export function TableKeyboardPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useTableTabNavigation(editor);
  useTableEnterBehavior(editor);
  useTableEscape(editor);
  useTableSelectAll(editor);
  useTableDeletion(editor);

  return null;
}
