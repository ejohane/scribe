/**
 * TableContentPlugin
 *
 * Blocks insertion of certain block-level content inside table cells.
 * Table cells support rich inline formatting (bold, italic, code, links, etc.)
 * and lists (bullet, checklist) but should not contain:
 * - Nested tables
 * - Images (out of scope for now)
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_HIGH } from 'lexical';
import { INSERT_TABLE_COMMAND, $getTableCellNodeFromLexicalNode } from '@lexical/table';

/**
 * Check if the current selection is inside a table cell
 */
function $isSelectionInTable(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;

  const anchorNode = selection.anchor.getNode();
  const tableCell = $getTableCellNodeFromLexicalNode(anchorNode);
  return tableCell !== null;
}

export function TableContentPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Block INSERT_TABLE_COMMAND when inside table (no nested tables)
    const removeTableCommand = editor.registerCommand(
      INSERT_TABLE_COMMAND,
      () => {
        if ($isSelectionInTable()) {
          // Block the command by returning true (handled)
          return true;
        }
        // Allow default behavior outside tables
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );

    return () => {
      removeTableCommand();
    };
  }, [editor]);

  return null;
}
