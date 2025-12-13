/**
 * TableContentPlugin Tests
 *
 * Unit tests verifying content restrictions inside table cells.
 * TableContentPlugin blocks insertion of:
 * - Nested tables (INSERT_TABLE_COMMAND)
 *
 * While allowing:
 * - Bullet lists (INSERT_UNORDERED_LIST_COMMAND)
 * - Checklists (INSERT_CHECK_LIST_COMMAND)
 * - Bold, italic, and other inline formatting
 * - Wiki-links and person mentions
 * - Line breaks within cells
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  LexicalEditor,
  $isTextNode,
  $isParagraphNode,
} from 'lexical';
import {
  TableNode,
  TableRowNode,
  TableCellNode,
  $createTableNode,
  $createTableRowNode,
  $createTableCellNode,
  $isTableNode,
  $isTableRowNode,
  $isTableCellNode,
  TableCellHeaderStates,
  INSERT_TABLE_COMMAND,
} from '@lexical/table';
import {
  ListNode,
  ListItemNode,
  $isListNode,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
} from '@lexical/list';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { TablePlugin } from './TablePlugin';
import { TableContentPlugin } from './TableContentPlugin';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

// Component to capture editor reference
function EditorCapture({ editorRef }: { editorRef: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);
  return null;
}

// Test wrapper that provides Lexical context with table and list nodes
function TestEditor({
  children,
  editorRef,
}: {
  children?: ReactNode;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'test',
        nodes: [TableNode, TableRowNode, TableCellNode, ListNode, ListItemNode],
        onError: (error) => {
          throw error;
        },
      }}
    >
      <RichTextPlugin
        contentEditable={<ContentEditable data-testid="editor" />}
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <EditorCapture editorRef={editorRef} />
      <TablePlugin />
      <TableContentPlugin />
      <ListPlugin />
      <CheckListPlugin />
      {children}
    </LexicalComposer>
  );
}

/**
 * Helper to create a 2x2 table structure
 */
function $createTable2x2(): TableNode {
  const table = $createTableNode();

  // Row 1
  const row1 = $createTableRowNode();
  const cell1a = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  cell1a.append($createParagraphNode().append($createTextNode('A1')));
  const cell1b = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  cell1b.append($createParagraphNode().append($createTextNode('B1')));
  row1.append(cell1a, cell1b);

  // Row 2
  const row2 = $createTableRowNode();
  const cell2a = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  cell2a.append($createParagraphNode().append($createTextNode('A2')));
  const cell2b = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  cell2b.append($createParagraphNode().append($createTextNode('B2')));
  row2.append(cell2a, cell2b);

  table.append(row1, row2);
  return table;
}

/**
 * Helper to select text inside a table cell
 */
function $selectCellContent(table: TableNode): void {
  const rows = table.getChildren();
  if ($isTableRowNode(rows[0])) {
    const cells = rows[0].getChildren();
    if ($isTableCellNode(cells[0])) {
      const paragraph = cells[0].getFirstChild();
      if ($isParagraphNode(paragraph)) {
        const textNode = paragraph.getFirstChild();
        if (textNode && $isTextNode(textNode)) {
          textNode.select(0, textNode.getTextContentSize());
        }
      }
    }
  }
}

describe('TableContentPlugin - Blocked Content', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  describe('INSERT_TABLE_COMMAND (nested tables)', () => {
    it('blocks nested table insertion when selection is inside table cell', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create a table and position cursor inside
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const table = $createTable2x2();
          root.append(table);
          $selectCellContent(table);
        });
      });

      // Try to dispatch INSERT_TABLE_COMMAND
      await act(async () => {
        editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: '2', columns: '2' });
      });

      // Verify no nested table was created
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const children = root.getChildren();
        // Should still have only one table at the root level
        expect(children.length).toBe(1);
        expect($isTableNode(children[0])).toBe(true);

        // And the table should not contain another table
        const table = children[0];
        if ($isTableNode(table)) {
          const rows = table.getChildren();
          const row = rows[0];
          if ($isTableRowNode(row)) {
            const cell = row.getFirstChild();
            if ($isTableCellNode(cell)) {
              const cellChildren = cell.getChildren();
              const hasNestedTable = cellChildren.some((child) => $isTableNode(child));
              expect(hasNestedTable).toBe(false);
            }
          }
        }
      });
    });

    it('allows table insertion when selection is outside table', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create content outside table
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Insert table here');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(0, textNode.getTextContentSize());
        });
      });

      // Dispatch INSERT_TABLE_COMMAND
      await act(async () => {
        editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: '2', columns: '2' });
      });

      // Verify table was created
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const children = root.getChildren();
        const hasTable = children.some((child) => $isTableNode(child));
        expect(hasTable).toBe(true);
      });
    });
  });
});

describe('TableContentPlugin - Allowed Content', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  describe('Text Formatting', () => {
    it('allows bold formatting inside table cells', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create a table with bold text directly inside cell
      // This tests that bold text is preserved in table cells (not stripped)
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const table = $createTableNode();
          const row = $createTableRowNode();
          const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Bold text');
          textNode.toggleFormat('bold');
          paragraph.append(textNode);
          cell.append(paragraph);
          row.append(cell);
          table.append(row);
          root.append(table);
        });
      });

      // Verify bold was preserved
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const table = root.getFirstChild();
        expect($isTableNode(table)).toBe(true);

        if ($isTableNode(table)) {
          const rows = table.getChildren();
          const row = rows[0];
          if ($isTableRowNode(row)) {
            const cell = row.getFirstChild();
            if ($isTableCellNode(cell)) {
              const paragraph = cell.getFirstChild();
              if ($isParagraphNode(paragraph)) {
                const textNode = paragraph.getFirstChild();
                if ($isTextNode(textNode)) {
                  expect(textNode.hasFormat('bold')).toBe(true);
                }
              }
            }
          }
        }
      });
    });

    it('allows italic formatting inside table cells', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create a table with italic text directly inside cell
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const table = $createTableNode();
          const row = $createTableRowNode();
          const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Italic text');
          textNode.toggleFormat('italic');
          paragraph.append(textNode);
          cell.append(paragraph);
          row.append(cell);
          table.append(row);
          root.append(table);
        });
      });

      // Verify italic was preserved
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const table = root.getFirstChild();
        expect($isTableNode(table)).toBe(true);

        if ($isTableNode(table)) {
          const rows = table.getChildren();
          const row = rows[0];
          if ($isTableRowNode(row)) {
            const cell = row.getFirstChild();
            if ($isTableCellNode(cell)) {
              const paragraph = cell.getFirstChild();
              if ($isParagraphNode(paragraph)) {
                const textNode = paragraph.getFirstChild();
                if ($isTextNode(textNode)) {
                  expect(textNode.hasFormat('italic')).toBe(true);
                }
              }
            }
          }
        }
      });
    });

    it('allows code formatting inside table cells', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create a table with inline code text directly inside cell
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const table = $createTableNode();
          const row = $createTableRowNode();
          const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('code snippet');
          textNode.toggleFormat('code');
          paragraph.append(textNode);
          cell.append(paragraph);
          row.append(cell);
          table.append(row);
          root.append(table);
        });
      });

      // Verify code was preserved
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const table = root.getFirstChild();
        expect($isTableNode(table)).toBe(true);

        if ($isTableNode(table)) {
          const rows = table.getChildren();
          const row = rows[0];
          if ($isTableRowNode(row)) {
            const cell = row.getFirstChild();
            if ($isTableCellNode(cell)) {
              const paragraph = cell.getFirstChild();
              if ($isParagraphNode(paragraph)) {
                const textNode = paragraph.getFirstChild();
                if ($isTextNode(textNode)) {
                  expect(textNode.hasFormat('code')).toBe(true);
                }
              }
            }
          }
        }
      });
    });

    it('allows combining multiple formats (bold + italic)', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create a table with bold+italic text directly inside cell
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const table = $createTableNode();
          const row = $createTableRowNode();
          const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Bold italic text');
          textNode.toggleFormat('bold');
          textNode.toggleFormat('italic');
          paragraph.append(textNode);
          cell.append(paragraph);
          row.append(cell);
          table.append(row);
          root.append(table);
        });
      });

      // Verify both formats were preserved
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const table = root.getFirstChild();
        expect($isTableNode(table)).toBe(true);

        if ($isTableNode(table)) {
          const rows = table.getChildren();
          const row = rows[0];
          if ($isTableRowNode(row)) {
            const cell = row.getFirstChild();
            if ($isTableCellNode(cell)) {
              const paragraph = cell.getFirstChild();
              if ($isParagraphNode(paragraph)) {
                const textNode = paragraph.getFirstChild();
                if ($isTextNode(textNode)) {
                  expect(textNode.hasFormat('bold')).toBe(true);
                  expect(textNode.hasFormat('italic')).toBe(true);
                }
              }
            }
          }
        }
      });
    });
  });

  describe('Cell Content Operations', () => {
    it('allows text editing inside table cells', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create a table
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const table = $createTable2x2();
          root.append(table);
        });
      });

      // Edit text in a cell
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const table = root.getFirstChild();
          if ($isTableNode(table)) {
            const rows = table.getChildren();
            const row = rows[0];
            if ($isTableRowNode(row)) {
              const cell = row.getFirstChild();
              if ($isTableCellNode(cell)) {
                const paragraph = cell.getFirstChild();
                if ($isParagraphNode(paragraph)) {
                  const textNode = paragraph.getFirstChild();
                  if ($isTextNode(textNode)) {
                    textNode.setTextContent('Updated content');
                  }
                }
              }
            }
          }
        });
      });

      // Verify text was changed
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const table = root.getFirstChild();
        if ($isTableNode(table)) {
          const rows = table.getChildren();
          const row = rows[0];
          if ($isTableRowNode(row)) {
            const cell = row.getFirstChild();
            if ($isTableCellNode(cell)) {
              expect(cell.getTextContent()).toBe('Updated content');
            }
          }
        }
      });
    });

    it('allows adding multiple paragraphs (line breaks) inside table cells', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create a table
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const table = $createTable2x2();
          root.append(table);
        });
      });

      // Add multiple paragraphs to a cell
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const table = root.getFirstChild();
          if ($isTableNode(table)) {
            const rows = table.getChildren();
            const row = rows[0];
            if ($isTableRowNode(row)) {
              const cell = row.getFirstChild();
              if ($isTableCellNode(cell)) {
                // Add a second paragraph
                const newParagraph = $createParagraphNode();
                newParagraph.append($createTextNode('Second line'));
                cell.append(newParagraph);
              }
            }
          }
        });
      });

      // Verify multiple paragraphs exist
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const table = root.getFirstChild();
        if ($isTableNode(table)) {
          const rows = table.getChildren();
          const row = rows[0];
          if ($isTableRowNode(row)) {
            const cell = row.getFirstChild();
            if ($isTableCellNode(cell)) {
              const children = cell.getChildren();
              expect(children.length).toBe(2); // Two paragraphs
              expect(cell.getTextContent()).toContain('A1');
              expect(cell.getTextContent()).toContain('Second line');
            }
          }
        }
      });
    });
  });
});

describe('TableContentPlugin - Lists in Tables (Allowed)', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  it('allows bullet list in empty table cell', async () => {
    render(<TestEditor editorRef={editorRef} />);

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create a table with empty cell
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTableNode();
        const row = $createTableRowNode();
        const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
        const paragraph = $createParagraphNode();
        cell.append(paragraph);
        row.append(cell);
        table.append(row);
        root.append(table);

        // Select empty paragraph
        paragraph.select(0, 0);
      });
    });

    // Dispatch INSERT_UNORDERED_LIST_COMMAND
    await act(async () => {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    });

    // Verify list was created inside the table cell
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getFirstChild();
      expect($isTableNode(table)).toBe(true);

      if ($isTableNode(table)) {
        const rows = table.getChildren();
        const row = rows[0];
        if ($isTableRowNode(row)) {
          const cell = row.getFirstChild();
          if ($isTableCellNode(cell)) {
            const children = cell.getChildren();
            expect($isListNode(children[0])).toBe(true);
          }
        }
      }
    });
  });

  it('allows bullet list with existing content in table cell', async () => {
    render(<TestEditor editorRef={editorRef} />);

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create a table
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);

        // Select first cell's content
        $selectCellContent(table);
      });
    });

    // Dispatch INSERT_UNORDERED_LIST_COMMAND
    await act(async () => {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    });

    // Verify list was created inside the table cell
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getFirstChild();
      if ($isTableNode(table)) {
        const rows = table.getChildren();
        const row = rows[0];
        if ($isTableRowNode(row)) {
          const cell = row.getFirstChild();
          if ($isTableCellNode(cell)) {
            const children = cell.getChildren();
            expect($isListNode(children[0])).toBe(true);
          }
        }
      }
    });
  });

  it('allows checklist in table cell', async () => {
    render(<TestEditor editorRef={editorRef} />);

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create a table with empty cell
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTableNode();
        const row = $createTableRowNode();
        const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
        const paragraph = $createParagraphNode();
        cell.append(paragraph);
        row.append(cell);
        table.append(row);
        root.append(table);

        // Select empty paragraph
        paragraph.select(0, 0);
      });
    });

    // Dispatch INSERT_CHECK_LIST_COMMAND
    await act(async () => {
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
    });

    // Verify checklist was created inside the table cell
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getFirstChild();
      expect($isTableNode(table)).toBe(true);

      if ($isTableNode(table)) {
        const rows = table.getChildren();
        const row = rows[0];
        if ($isTableRowNode(row)) {
          const cell = row.getFirstChild();
          if ($isTableCellNode(cell)) {
            const children = cell.getChildren();
            expect($isListNode(children[0])).toBe(true);
          }
        }
      }
    });
  });

  it('allows list command outside table', async () => {
    render(<TestEditor editorRef={editorRef} />);

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create a table and then a paragraph outside
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('Outside text'));
        root.append(table, paragraph);
        // Select the outside paragraph text
        const textNode = paragraph.getFirstChild();
        if ($isTextNode(textNode)) {
          textNode.select(0, textNode.getTextContentSize());
        }
      });
    });

    // Should allow command outside table
    await act(async () => {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    });

    // Verify list was created in the paragraph outside the table
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      // Should have table and list
      expect(children.length).toBe(2);
      expect($isTableNode(children[0])).toBe(true);
      expect($isListNode(children[1])).toBe(true);
    });
  });
});
