/**
 * Slash Command Definitions
 *
 * Defines all available slash commands for the editor.
 * Commands are organized into sections: formatting and AI.
 */

import type { LexicalEditor } from 'lexical';
import type { ReactNode } from 'react';
import { $getSelection, $isRangeSelection, $createParagraphNode } from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $createQuoteNode } from '@lexical/rich-text';
import { $createCollapsibleHeadingNode } from '../plugins/CollapsibleHeadingNode';
import { INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { INSERT_IMAGE_COMMAND } from '../plugins/ImagePlugin';
import {
  TextIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  QuoteIcon,
} from '@scribe/design-system';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  section: 'formatting' | 'ai';
  icon?: ReactNode;
  execute: (editor: LexicalEditor) => void;
}

/**
 * All available slash commands
 */
export const slashCommands: SlashCommand[] = [
  // Formatting commands
  {
    id: 'text',
    label: 'Text',
    description: 'Just start writing with plain text',
    keywords: ['text', 'paragraph', 'plain', 'p'],
    section: 'formatting',
    icon: <TextIcon />,
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
    icon: <Heading1Icon />,
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
    icon: <Heading2Icon />,
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
    icon: <Heading3Icon />,
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
    icon: <ListIcon />,
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
    icon: <QuoteIcon />,
    execute: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      });
    },
  },
  {
    id: 'table',
    label: 'Table',
    description: 'Insert a table',
    keywords: ['table', 'grid', 'rows', 'columns'],
    section: 'formatting',
    icon: <TextIcon />,
    execute: (editor) => {
      // Insert a 2x2 table with header row
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        rows: '2',
        columns: '2',
        includeHeaders: { rows: true, columns: false },
      });
    },
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Insert an image from file',
    keywords: ['image', 'picture', 'photo', 'screenshot', 'img'],
    section: 'formatting',
    icon: <TextIcon />,
    execute: (editor) => {
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, undefined);
    },
  },
];

/**
 * Filter commands by search query
 * Matches against label, description, and keywords
 */
export function filterCommands(query: string): SlashCommand[] {
  if (!query.trim()) {
    return slashCommands;
  }

  const lowerQuery = query.toLowerCase();

  return slashCommands.filter((cmd) => {
    // Match label
    if (cmd.label.toLowerCase().includes(lowerQuery)) return true;
    // Match description
    if (cmd.description.toLowerCase().includes(lowerQuery)) return true;
    // Match keywords
    if (cmd.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery))) return true;
    return false;
  });
}

/**
 * Get commands grouped by section
 */
export function getCommandsBySection(commands: SlashCommand[]): {
  formatting: SlashCommand[];
  ai: SlashCommand[];
} {
  return {
    formatting: commands.filter((cmd) => cmd.section === 'formatting'),
    ai: commands.filter((cmd) => cmd.section === 'ai'),
  };
}
