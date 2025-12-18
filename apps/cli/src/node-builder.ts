/**
 * Node builder for creating Lexical AST nodes from plain text.
 * Used by CLI write operations to generate valid note content.
 */

interface EditorNode {
  type: string;
  format?: string | number;
  indent?: number;
  direction?: 'ltr' | 'rtl' | null;
  children?: EditorNode[];
  [key: string]: unknown;
}

interface EditorContent {
  root: {
    type: 'root';
    format?: string | number;
    indent?: number;
    direction?: 'ltr' | 'rtl' | null;
    children: EditorNode[];
  };
}

// Deprecated aliases for backward compatibility
/** @deprecated Use EditorContent instead */
type LexicalState = EditorContent;
/** @deprecated Use EditorNode instead */
type LexicalNode = EditorNode;

/**
 * Create a text node with the given content.
 * Text nodes are leaf nodes that contain actual text content.
 */
function createTextNode(text: string): EditorNode {
  return {
    type: 'text',
    format: 0,
    style: '',
    mode: 'normal',
    detail: 0,
    text,
  };
}

/**
 * Create a paragraph node with text content.
 * Paragraphs are the basic block-level element in Lexical.
 */
export function createParagraphNode(text: string): EditorNode {
  return {
    type: 'paragraph',
    format: '',
    indent: 0,
    direction: null,
    children: text.length > 0 ? [createTextNode(text)] : [],
  };
}

/**
 * Create a checklist item (task) node.
 * Checklist items are list items with a checkbox.
 */
export function createChecklistItemNode(text: string, checked = false): EditorNode {
  return {
    type: 'listitem',
    format: '',
    indent: 0,
    direction: null,
    value: 1,
    listType: 'check',
    checked,
    children: text.length > 0 ? [createTextNode(text)] : [],
  };
}

/**
 * Create a heading node with the given level (1-6).
 */
export function createHeadingNode(text: string, level: 1 | 2 | 3 | 4 | 5 | 6 = 1): EditorNode {
  return {
    type: 'heading',
    format: '',
    indent: 0,
    direction: null,
    tag: `h${level}`,
    children: text.length > 0 ? [createTextNode(text)] : [],
  };
}

/**
 * Create a list node that wraps list items.
 * @param listType - 'bullet', 'number', or 'check'
 */
export function createListNode(
  items: EditorNode[],
  listType: 'bullet' | 'number' | 'check' = 'bullet'
): EditorNode {
  return {
    type: 'list',
    format: '',
    indent: 0,
    direction: null,
    listType,
    start: 1,
    tag: listType === 'number' ? 'ol' : 'ul',
    children: items,
  };
}

/**
 * Append a paragraph to existing content.
 * Deep clones the content to avoid mutating the original.
 */
export function appendParagraphToContent(content: EditorContent, text: string): EditorContent {
  const newNode = createParagraphNode(text);

  // Deep clone to avoid mutating original
  const updated = JSON.parse(JSON.stringify(content)) as EditorContent;

  if (!updated.root.children) {
    updated.root.children = [];
  }
  updated.root.children.push(newNode);

  return updated;
}

/**
 * Append a task (checklist item) to existing content.
 * Deep clones the content to avoid mutating the original.
 */
export function appendTaskToContent(content: EditorContent, text: string): EditorContent {
  const newNode = createChecklistItemNode(text, false);

  const updated = JSON.parse(JSON.stringify(content)) as EditorContent;

  if (!updated.root.children) {
    updated.root.children = [];
  }
  updated.root.children.push(newNode);

  return updated;
}

/**
 * Append a heading to existing content.
 * Deep clones the content to avoid mutating the original.
 */
export function appendHeadingToContent(
  content: EditorContent,
  text: string,
  level: 1 | 2 | 3 | 4 | 5 | 6 = 1
): EditorContent {
  const newNode = createHeadingNode(text, level);

  const updated = JSON.parse(JSON.stringify(content)) as EditorContent;

  if (!updated.root.children) {
    updated.root.children = [];
  }
  updated.root.children.push(newNode);

  return updated;
}

/**
 * Create empty note content.
 * Returns a valid Lexical state with an empty root.
 */
export function createEmptyContent(): EditorContent {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      direction: null,
      children: [],
    },
  };
}

/**
 * Create initial content with a single paragraph.
 * Use this when creating a new note with initial text.
 */
export function createInitialContent(text: string): EditorContent {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      direction: null,
      children: text.length > 0 ? [createParagraphNode(text)] : [],
    },
  };
}

/**
 * Create initial content with a heading and optional body text.
 * Useful for creating notes with a title.
 */
export function createContentWithHeading(
  heading: string,
  bodyText?: string,
  headingLevel: 1 | 2 | 3 | 4 | 5 | 6 = 1
): EditorContent {
  const children: EditorNode[] = [createHeadingNode(heading, headingLevel)];

  if (bodyText && bodyText.length > 0) {
    children.push(createParagraphNode(bodyText));
  }

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      direction: null,
      children,
    },
  };
}

// Re-export types for consumers
export type { LexicalNode, LexicalState };
