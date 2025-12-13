import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createTextNode, $getSelection, $isRangeSelection, $isTextNode, TextNode } from 'lexical';
import {
  $isListItemNode,
  $isListNode,
  ListItemNode,
  ListNode,
  $createListNode,
  $createListItemNode,
} from '@lexical/list';

/**
 * Plugin to convert bullet list items to check list items when typing "[ ] " or "[x] "
 *
 * This handles the case where users type "- [ ] task" to create a task:
 * 1. "- " triggers the unordered list transformer, creating a bullet list item
 * 2. User continues typing "[ ] task"
 * 3. This plugin detects the "[ ] " or "[x] " pattern and converts to a check list
 *
 * The pattern is detected on space after the closing bracket.
 */
export function CheckListShortcutPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Listen for text content changes
    const removeUpdateListener = editor.registerUpdateListener(({ editorState, tags }) => {
      // Skip if this is a collaboration update or history
      if (tags.has('collaboration') || tags.has('historic')) {
        return;
      }

      editorState.read(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return;
        }

        const anchorNode = selection.anchor.getNode();

        // Check if we're in a text node
        if (!$isTextNode(anchorNode)) {
          return;
        }

        const textContent = anchorNode.getTextContent();
        const anchorOffset = selection.anchor.offset;

        // Check for checkbox pattern at the start of the text
        // Match "[ ] " or "[x] " or "[X] " at the beginning
        const checkboxMatch = textContent.match(/^(\[[ xX]?\])\s/);

        if (!checkboxMatch) {
          return;
        }

        // Only trigger when cursor is right after the pattern (user just typed the space)
        const patternLength = checkboxMatch[0].length;
        if (anchorOffset !== patternLength) {
          return;
        }

        const listItemNode = anchorNode.getParent();

        // Must be inside a list item
        if (!$isListItemNode(listItemNode)) {
          return;
        }

        const listNode = listItemNode.getParent();

        // Must be inside a bullet list (not already a checklist or numbered list)
        if (!$isListNode(listNode) || listNode.getListType() !== 'bullet') {
          return;
        }

        // Determine if checked based on the bracket content
        const bracketContent = checkboxMatch[1];
        const isChecked = bracketContent.toLowerCase() === '[x]';

        // Schedule the conversion
        editor.update(() => {
          // Get the remaining text after the checkbox pattern
          const remainingText = textContent.slice(patternLength);

          // Convert the bullet list to a check list
          convertToCheckList(listNode, listItemNode, anchorNode, isChecked, remainingText);
        });
      });
    });

    return () => {
      removeUpdateListener();
    };
  }, [editor]);

  return null;
}

/**
 * Converts a bullet list item to a check list item.
 * If the list only has one item, converts the whole list.
 * Otherwise, creates a new check list and moves the item there.
 */
function convertToCheckList(
  listNode: ListNode,
  listItemNode: ListItemNode,
  textNode: TextNode,
  isChecked: boolean,
  remainingText: string
): void {
  const listChildren = listNode.getChildren();

  if (listChildren.length === 1) {
    // Only one item - convert the whole list to a checklist
    listNode.setListType('check');
    listItemNode.setChecked(isChecked);

    // Update the text node to remove the checkbox pattern
    textNode.setTextContent(remainingText);

    // Place cursor at the start of the remaining text
    textNode.select(0, 0);
  } else {
    // Multiple items - need to extract this item to a new checklist
    const itemIndex = listChildren.indexOf(listItemNode);
    const isFirst = itemIndex === 0;
    const isLast = itemIndex === listChildren.length - 1;

    // Create new checklist with the converted item
    const newCheckList = $createListNode('check');
    const newCheckItem = $createListItemNode(isChecked);

    // Create new text node with remaining content
    const newTextNode = $createTextNode(remainingText);
    newCheckItem.append(newTextNode);
    newCheckList.append(newCheckItem);

    if (isFirst) {
      // Insert checklist before the bullet list
      listNode.insertBefore(newCheckList);
    } else if (isLast) {
      // Insert checklist after the bullet list
      listNode.insertAfter(newCheckList);
    } else {
      // Item is in the middle - need to split the list
      // Create a new bullet list for items after this one
      const newBulletList = $createListNode('bullet');
      for (let i = itemIndex + 1; i < listChildren.length; i++) {
        newBulletList.append(listChildren[i]);
      }

      // Insert checklist after current list, then the new bullet list
      listNode.insertAfter(newCheckList);
      newCheckList.insertAfter(newBulletList);
    }

    // Remove the original list item
    listItemNode.remove();

    // If the original list is now empty, remove it
    if (listNode.getChildrenSize() === 0) {
      listNode.remove();
    }

    // Place cursor at the start of the new text
    newTextNode.select(0, 0);
  }
}
