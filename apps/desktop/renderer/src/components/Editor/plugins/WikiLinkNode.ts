import {
  DecoratorNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
  DOMExportOutput,
  LexicalEditor,
} from 'lexical';
import type { NoteId } from '@scribe/shared';
import { createElement, MouseEvent } from 'react';
import { useWikiLinkContext } from './WikiLinkContext';

/**
 * Serialized form of WikiLinkNode for JSON export/import
 */
export type SerializedWikiLinkNode = Spread<
  {
    noteTitle: string;
    displayText: string;
    targetId: NoteId | null;
  },
  SerializedLexicalNode
>;

/**
 * Props for the WikiLinkComponent React component
 */
interface WikiLinkComponentProps {
  noteTitle: string;
  displayText: string;
  targetId: NoteId | null;
  nodeKey: NodeKey;
}

/**
 * React component that renders the wiki-link content.
 * Uses WikiLinkContext to handle click navigation.
 */
function WikiLinkComponent({
  noteTitle,
  displayText,
  targetId,
}: WikiLinkComponentProps): JSX.Element {
  const { currentNoteId, onLinkClick, onError } = useWikiLinkContext();

  const handleClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Self-link check - don't navigate to current note
    if (targetId === currentNoteId) {
      return;
    }

    try {
      await onLinkClick(noteTitle, targetId);
    } catch (error) {
      console.error('Failed to navigate via wiki-link:', error);
      onError(`Failed to navigate to "${noteTitle}"`);
    }
  };

  return createElement('span', { onClick: handleClick }, displayText);
}

/**
 * Custom Lexical DecoratorNode for wiki-links.
 *
 * Wiki-links use the [[note title]] or [[note title|display text]] syntax
 * to create internal links between notes. This node stores:
 * - noteTitle: The target note's title (used for resolution)
 * - displayText: What to display (alias or title)
 * - targetId: Resolved note ID (null if unresolved)
 *
 * The node renders as an inline span with the 'wiki-link' class.
 */
export class WikiLinkNode extends DecoratorNode<JSX.Element> {
  __noteTitle: string;
  __displayText: string;
  __targetId: NoteId | null;

  static getType(): string {
    return 'wiki-link';
  }

  static clone(node: WikiLinkNode): WikiLinkNode {
    return new WikiLinkNode(node.__noteTitle, node.__displayText, node.__targetId, node.__key);
  }

  constructor(noteTitle: string, displayText: string, targetId: NoteId | null, key?: NodeKey) {
    super(key);
    this.__noteTitle = noteTitle;
    this.__displayText = displayText;
    this.__targetId = targetId;
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'wiki-link';
    return span;
  }

  updateDOM(): boolean {
    // Returning false tells Lexical that the decorator component handles all updates
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span');
    element.className = 'wiki-link';
    element.textContent = this.__displayText;
    return { element };
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return createElement(WikiLinkComponent, {
      noteTitle: this.__noteTitle,
      displayText: this.__displayText,
      targetId: this.__targetId,
      nodeKey: this.__key,
    });
  }

  exportJSON(): SerializedWikiLinkNode {
    return {
      ...super.exportJSON(),
      type: 'wiki-link',
      noteTitle: this.__noteTitle,
      displayText: this.__displayText,
      targetId: this.__targetId,
      version: 1,
    };
  }

  static importJSON(json: SerializedWikiLinkNode): WikiLinkNode {
    return $createWikiLinkNode(json.noteTitle, json.displayText, json.targetId);
  }

  isInline(): boolean {
    return true;
  }

  getTextContent(): string {
    return this.__displayText;
  }
}

/**
 * Creates a new WikiLinkNode
 *
 * @param noteTitle - The target note's title (e.g., 'Meeting Notes')
 * @param displayText - What to display (alias or title)
 * @param targetId - Resolved note ID, or null if unresolved
 * @returns A new WikiLinkNode instance
 */
export function $createWikiLinkNode(
  noteTitle: string,
  displayText: string,
  targetId: NoteId | null
): WikiLinkNode {
  return new WikiLinkNode(noteTitle, displayText, targetId);
}

/**
 * Type guard to check if a node is a WikiLinkNode
 *
 * @param node - The node to check
 * @returns True if the node is a WikiLinkNode
 */
export function $isWikiLinkNode(node: unknown): node is WikiLinkNode {
  return node instanceof WikiLinkNode;
}
