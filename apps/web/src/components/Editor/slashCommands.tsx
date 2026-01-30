/**
 * Slash Command Definitions - Web
 */

import type { SlashMenuCommandDefinition } from '@scribe/editor';
import { $getSelection, $isRangeSelection, $createParagraphNode } from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $createQuoteNode } from '@lexical/rich-text';
import { INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { $createCollapsibleHeadingNode } from '@scribe/editor';
import { Type, Heading1, Heading2, Heading3, List, Quote } from 'lucide-react';

export const slashCommands: SlashMenuCommandDefinition[] = [
  {
    id: 'text',
    label: 'Text',
    description: 'Just start writing with plain text',
    keywords: ['text', 'paragraph', 'plain', 'p'],
    section: 'formatting',
    icon: <Type size={16} />,
    execute: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      });
    },
  },
  {
    id: 'heading1',
    label: 'Heading 1',
    description: 'Big section heading',
    keywords: ['heading', 'h1', 'title', '#', 'large'],
    section: 'formatting',
    icon: <Heading1 size={16} />,
    execute: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createCollapsibleHeadingNode('h1'));
        }
      });
    },
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    description: 'Medium section heading',
    keywords: ['heading', 'h2', 'subtitle', '##', 'medium'],
    section: 'formatting',
    icon: <Heading2 size={16} />,
    execute: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createCollapsibleHeadingNode('h2'));
        }
      });
    },
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    description: 'Small section heading',
    keywords: ['heading', 'h3', '###', 'small'],
    section: 'formatting',
    icon: <Heading3 size={16} />,
    execute: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createCollapsibleHeadingNode('h3'));
        }
      });
    },
  },
  {
    id: 'bullet',
    label: 'Bullet List',
    description: 'Create a bulleted list',
    keywords: ['bullet', 'list', 'unordered', '-', 'ul'],
    section: 'formatting',
    icon: <List size={16} />,
    execute: (editor) => {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    },
  },
  {
    id: 'quote',
    label: 'Quote',
    description: 'Capture a quote',
    keywords: ['quote', 'blockquote', '>', 'citation'],
    section: 'formatting',
    icon: <Quote size={16} />,
    execute: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      });
    },
  },
];
