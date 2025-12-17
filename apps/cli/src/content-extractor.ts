import type { Note } from '@scribe/shared';

interface LexicalNode {
  type: string;
  text?: string;
  tag?: string;
  children?: LexicalNode[];
  checked?: boolean;
  listType?: string;
  format?: number;
  [key: string]: unknown;
}

export function extractPlainText(note: Note): string {
  const content = note.content;
  if (!content?.root?.children) {
    return '';
  }

  const lines: string[] = [];

  for (const node of content.root.children) {
    const line = extractBlock(node);
    if (line !== null) {
      lines.push(line);
    }
  }

  return lines.join('\n\n');
}

function extractBlock(node: LexicalNode): string | null {
  switch (node.type) {
    case 'heading': {
      const level = node.tag ? parseInt(node.tag[1]) : 1;
      const hashes = '#'.repeat(level);
      return `${hashes} ${extractInline(node)}`;
    }

    case 'paragraph': {
      const text = extractInline(node);
      return text || null;
    }

    case 'listitem': {
      if (node.checked !== undefined) {
        // Checklist item (task)
        const checkbox = node.checked ? '[x]' : '[ ]';
        return `- ${checkbox} ${extractInline(node)}`;
      }
      return `- ${extractInline(node)}`;
    }

    case 'quote':
      return `> ${extractInline(node)}`;

    case 'code': {
      const code = (node as { code?: string }).code || extractInline(node);
      return '```\n' + code + '\n```';
    }

    case 'list': {
      // Handle list containers
      if (node.children) {
        return node.children
          .map((child) => extractBlock(child))
          .filter(Boolean)
          .join('\n');
      }
      return null;
    }

    default:
      // Try to extract text from unknown block types
      if (node.children) {
        return extractInline(node);
      }
      return null;
  }
}

function extractInline(node: LexicalNode): string {
  if (!node.children) {
    return node.text || '';
  }

  return node.children
    .map((child) => {
      switch (child.type) {
        case 'text':
          return child.text || '';
        case 'wiki-link': {
          const title =
            (child as { targetTitle?: string }).targetTitle ||
            (child as { targetId?: string }).targetId ||
            '';
          return `[[${title}]]`;
        }
        case 'person-mention': {
          const name =
            (child as { personName?: string }).personName ||
            (child as { personId?: string }).personId ||
            '';
          return `@${name}`;
        }
        case 'linebreak':
          return '\n';
        default:
          // Recursively handle other inline nodes
          return extractInline(child);
      }
    })
    .join('');
}
