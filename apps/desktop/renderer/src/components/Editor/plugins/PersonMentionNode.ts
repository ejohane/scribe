import {
  DecoratorNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
  DOMExportOutput,
  LexicalEditor,
  LexicalNode,
} from 'lexical';
import type { NoteId } from '@scribe/shared';
import { createElement, MouseEvent } from 'react';
import { usePersonMentionContext } from './PersonMentionContext';

/**
 * Serialized form of PersonMentionNode for JSON export/import
 */
export type SerializedPersonMentionNode = Spread<
  {
    personName: string;
    personId: NoteId;
  },
  SerializedLexicalNode
>;

/**
 * Props for the PersonMentionComponent React component
 */
interface PersonMentionComponentProps {
  personName: string;
  personId: NoteId;
  nodeKey: NodeKey;
}

/**
 * React component that renders the person mention content.
 * Uses PersonMentionContext to handle click navigation.
 */
function PersonMentionComponent({
  personName,
  personId,
}: PersonMentionComponentProps): JSX.Element {
  const { currentNoteId, onMentionClick, onError } = usePersonMentionContext();

  const handleClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Self-link check - don't navigate to current note
    if (personId === currentNoteId) {
      return;
    }

    try {
      await onMentionClick(personId);
    } catch (error) {
      console.error('Failed to navigate via person mention:', error);
      onError(`Failed to navigate to "${personName}"`);
    }
  };

  return createElement('span', { onClick: handleClick }, `@${personName}`);
}

/**
 * Custom Lexical DecoratorNode for person mentions.
 *
 * Person mentions use the @name syntax to reference people.
 * This node stores:
 * - personName: The person's display name (e.g., "John Smith")
 * - personId: The resolved note ID of the person (always resolved at insertion time)
 *
 * The node renders as an inline span with the 'person-mention' class.
 */
export class PersonMentionNode extends DecoratorNode<JSX.Element> {
  __personName: string;
  __personId: NoteId;

  static getType(): string {
    return 'person-mention';
  }

  static clone(node: PersonMentionNode): PersonMentionNode {
    return new PersonMentionNode(node.__personName, node.__personId, node.__key);
  }

  constructor(personName: string, personId: NoteId, key?: NodeKey) {
    super(key);
    this.__personName = personName;
    this.__personId = personId;
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'person-mention';
    return span;
  }

  updateDOM(): boolean {
    // Returning false tells Lexical that the decorator component handles all updates
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span');
    element.className = 'person-mention';
    element.textContent = `@${this.__personName}`;
    return { element };
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return createElement(PersonMentionComponent, {
      personName: this.__personName,
      personId: this.__personId,
      nodeKey: this.__key,
    });
  }

  exportJSON(): SerializedPersonMentionNode {
    return {
      ...super.exportJSON(),
      type: 'person-mention',
      personName: this.__personName,
      personId: this.__personId,
      version: 1,
    };
  }

  static importJSON(json: SerializedPersonMentionNode): PersonMentionNode {
    return $createPersonMentionNode(json.personName, json.personId);
  }

  isInline(): boolean {
    return true;
  }

  getTextContent(): string {
    return `@${this.__personName}`;
  }
}

/**
 * Creates a new PersonMentionNode
 *
 * @param personName - The person's display name (e.g., 'John Smith')
 * @param personId - The resolved note ID of the person
 * @returns A new PersonMentionNode instance
 */
export function $createPersonMentionNode(personName: string, personId: NoteId): PersonMentionNode {
  return new PersonMentionNode(personName, personId);
}

/**
 * Type guard to check if a node is a PersonMentionNode
 *
 * @param node - The node to check
 * @returns True if the node is a PersonMentionNode
 */
export function $isPersonMentionNode(
  node: LexicalNode | null | undefined
): node is PersonMentionNode {
  return node instanceof PersonMentionNode;
}
