import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createHorizontalRuleNode,
  HorizontalRuleNode,
} from '@lexical/react/LexicalHorizontalRuleNode';
import {
  $getSelection,
  $isRangeSelection,
  $isParagraphNode,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
} from 'lexical';
import { HR_PATTERN } from './constants';

/**
 * Plugin to handle horizontal rule creation when pressing Enter after typing ---, ***, or ___
 *
 * This complements the MarkdownShortcutPlugin which handles the space-triggered version.
 * With this plugin, users can either:
 * - Type "---" and press Space (handled by MarkdownShortcutPlugin)
 * - Type "---" and press Enter (handled by this plugin)
 */
export function HorizontalRulePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Verify the HorizontalRuleNode is registered
    if (!editor.hasNode(HorizontalRuleNode)) {
      console.error(
        'HorizontalRulePlugin: HorizontalRuleNode is not registered. Please add it to the editor config.'
      );
      return;
    }

    const removeCommand = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }

        const anchorNode = selection.anchor.getNode();

        // Check if we're in a text node
        if (!$isTextNode(anchorNode)) {
          return false;
        }

        const parentNode = anchorNode.getParent();

        // Only transform in paragraph nodes at the root level
        if (!$isParagraphNode(parentNode)) {
          return false;
        }

        // Check if this is the only/first child of the paragraph
        if (parentNode.getFirstChild() !== anchorNode) {
          return false;
        }

        const textContent = anchorNode.getTextContent();

        // Check if the text matches the HR pattern exactly
        if (!HR_PATTERN.exact.test(textContent)) {
          return false;
        }

        // Prevent default Enter behavior
        if (event) {
          event.preventDefault();
        }

        // Create and insert the horizontal rule
        const horizontalRuleNode = $createHorizontalRuleNode();

        // Replace the paragraph with the horizontal rule
        // selectNext() will handle cursor placement, creating a new paragraph if needed
        parentNode.replace(horizontalRuleNode);
        horizontalRuleNode.selectNext();

        return true;
      },
      COMMAND_PRIORITY_LOW
    );

    return () => {
      removeCommand();
    };
  }, [editor]);

  return null;
}
