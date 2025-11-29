/**
 * Slash Command Definitions
 *
 * Defines all available slash commands for the editor.
 * Commands are organized into sections: formatting and AI.
 */

import type { LexicalEditor } from 'lexical';
import { $getSelection, $isRangeSelection, $createParagraphNode } from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_CHECK_LIST_COMMAND } from '@lexical/list';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  section: 'formatting' | 'ai';
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
    execute: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode('h1'));
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
    execute: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode('h2'));
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
    execute: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode('h3'));
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
    execute: (editor) => {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    },
  },
  {
    id: 'todo',
    label: 'To-do',
    description: 'Track tasks with checkboxes',
    keywords: ['todo', 'checkbox', 'task', '[]', 'check', 'checklist'],
    section: 'formatting',
    execute: (editor) => {
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
    },
  },
  {
    id: 'quote',
    label: 'Quote',
    description: 'Capture a quote',
    keywords: ['quote', 'blockquote', '>', 'citation'],
    section: 'formatting',
    execute: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      });
    },
  },
  // AI commands (placeholders)
  {
    id: 'ai-continue',
    label: 'Continue writing',
    description: 'AI continues your text',
    keywords: ['ai', 'continue', 'generate', 'write', 'complete'],
    section: 'ai',
    execute: () => {
      // Placeholder - AI functionality not yet implemented
      console.log('AI Continue: Not yet implemented');
    },
  },
  {
    id: 'ai-summarize',
    label: 'Summarize',
    description: 'AI summarizes content',
    keywords: ['ai', 'summarize', 'summary', 'tldr'],
    section: 'ai',
    execute: () => {
      // Placeholder - AI functionality not yet implemented
      console.log('AI Summarize: Not yet implemented');
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
