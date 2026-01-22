/**
 * MarkdownAutoFormatPlugin
 *
 * Converts raw markdown syntax into formatted Lexical nodes when the cursor
 * leaves the markdown region. This complements MarkdownRevealPlugin by
 * ensuring markdown is transformed even when users don't type a trailing space.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
  type LexicalNode,
  type TextModeType,
  type TextNode,
} from 'lexical';
import { $isCodeHighlightNode, $isCodeNode } from '@lexical/code';
import { $createQuoteNode, type HeadingTagType } from '@lexical/rich-text';
import { $createLinkNode } from '@lexical/link';
import { $createCollapsibleHeadingNode } from './CollapsibleHeadingNode.js';
import { IS_BOLD, IS_CODE, IS_ITALIC, IS_STRIKETHROUGH } from './markdownReconstruction.js';

const AUTOFORMAT_TAG = 'markdown-autofmt';
const MARKDOWN_MARKER_REGEX = /[\*`~]/;
const LINK_MARKDOWN_REGEX = /(?<!!)\[([^\]]+)\]\(([^)\n]*)\)/g;

interface SelectionInfo {
  blockKey: string;
  nodeKey: string;
  offset: number;
}

interface InlineSegment {
  text: string;
  format: number;
  start: number;
}

interface ParseResult {
  segments: InlineSegment[];
  hasFormatting: boolean;
  newSelectionOffset: number | null;
}

const INLINE_DELIMITERS = [
  { delimiter: '`', format: IS_CODE },
  { delimiter: '~~', format: IS_STRIKETHROUGH },
  { delimiter: '**', format: IS_BOLD },
  { delimiter: '*', format: IS_ITALIC },
];

const HEADING_PREFIX_REGEX = /^(#{1,6})\s+(.*)$/;
const BLOCKQUOTE_PREFIX_REGEX = /^(>+)\s+(.*)$/;

interface BlockPrefixMatch {
  type: 'heading' | 'blockquote';
  content: string;
  headingTag?: HeadingTagType;
}

function parseBlockPrefix(text: string): BlockPrefixMatch | null {
  const headingMatch = text.match(HEADING_PREFIX_REGEX);
  if (headingMatch) {
    const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
    return {
      type: 'heading',
      content: headingMatch[2],
      headingTag: `h${level}`,
    };
  }

  const blockquoteMatch = text.match(BLOCKQUOTE_PREFIX_REGEX);
  if (blockquoteMatch) {
    return {
      type: 'blockquote',
      content: blockquoteMatch[2],
    };
  }

  return null;
}

function collectTextNodes(node: LexicalNode): TextNode[] {
  if ($isTextNode(node)) {
    return [node];
  }

  if ($isElementNode(node)) {
    return node.getChildren().flatMap((child) => collectTextNodes(child));
  }

  return [];
}

function isInsideCodeBlock(node: LexicalNode): boolean {
  if ($isCodeNode(node) || $isCodeHighlightNode(node)) {
    return true;
  }

  let parent = node.getParent();
  while (parent) {
    if ($isCodeNode(parent)) {
      return true;
    }
    parent = parent.getParent();
  }

  return false;
}

function mergeSegments(segments: InlineSegment[]): InlineSegment[] {
  const merged: InlineSegment[] = [];

  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }

    const last = merged[merged.length - 1];
    if (last && last.format === segment.format) {
      last.text += segment.text;
      continue;
    }

    merged.push({ ...segment });
  }

  return merged;
}

function applyDelimiter(
  segments: InlineSegment[],
  delimiter: string,
  format: number,
  selectionOffset: number | null,
  removedBeforeSelection: { value: number }
): InlineSegment[] {
  const nextSegments: InlineSegment[] = [];
  const delimiterLength = delimiter.length;

  for (const segment of segments) {
    if (segment.format & IS_CODE && format !== IS_CODE) {
      nextSegments.push(segment);
      continue;
    }

    let index = 0;
    while (index < segment.text.length) {
      const openIndex = segment.text.indexOf(delimiter, index);

      if (openIndex === -1) {
        if (index < segment.text.length) {
          nextSegments.push({
            text: segment.text.slice(index),
            format: segment.format,
            start: segment.start + index,
          });
        }
        break;
      }

      const closeIndex = segment.text.indexOf(delimiter, openIndex + delimiterLength);
      if (closeIndex === -1) {
        nextSegments.push({
          text: segment.text.slice(index),
          format: segment.format,
          start: segment.start + index,
        });
        break;
      }

      const matchStart = segment.start + openIndex;
      const matchEnd = segment.start + closeIndex + delimiterLength;
      const selectionInside =
        selectionOffset !== null && selectionOffset >= matchStart && selectionOffset <= matchEnd;

      if (selectionInside) {
        const literalEnd = closeIndex + delimiterLength;
        nextSegments.push({
          text: segment.text.slice(index, literalEnd),
          format: segment.format,
          start: segment.start + index,
        });
        index = literalEnd;
        continue;
      }

      if (openIndex > index) {
        nextSegments.push({
          text: segment.text.slice(index, openIndex),
          format: segment.format,
          start: segment.start + index,
        });
      }

      const innerText = segment.text.slice(openIndex + delimiterLength, closeIndex);
      if (innerText.length > 0) {
        nextSegments.push({
          text: innerText,
          format: segment.format | format,
          start: segment.start + openIndex + delimiterLength,
        });

        if (selectionOffset !== null && matchEnd <= selectionOffset) {
          removedBeforeSelection.value += delimiterLength * 2;
        }
      } else {
        nextSegments.push({
          text: segment.text.slice(openIndex, closeIndex + delimiterLength),
          format: segment.format,
          start: segment.start + openIndex,
        });
      }

      index = closeIndex + delimiterLength;
    }
  }

  return nextSegments;
}

function parseInlineMarkdown(text: string, selectionOffset: number | null): ParseResult {
  let segments: InlineSegment[] = [{ text, format: 0, start: 0 }];
  const removedBeforeSelection = { value: 0 };

  for (const { delimiter, format } of INLINE_DELIMITERS) {
    segments = applyDelimiter(segments, delimiter, format, selectionOffset, removedBeforeSelection);
  }

  segments = mergeSegments(segments);

  const hasFormatting = segments.some((segment) => segment.format !== 0);
  const newSelectionOffset =
    selectionOffset === null ? null : Math.max(0, selectionOffset - removedBeforeSelection.value);

  return { segments, hasFormatting, newSelectionOffset };
}

function createStyledTextNode(
  text: string,
  format: number,
  style: string,
  detail: number,
  mode: TextModeType
): TextNode {
  const node = $createTextNode(text);
  node.setFormat(format);
  node.setStyle(style);
  node.setDetail(detail);
  node.setMode(mode);
  return node;
}

function transformLinkTextNode(textNode: TextNode, selectionOffset: number | null): boolean {
  const text = textNode.getTextContent();

  if (!text.includes('](')) {
    return false;
  }

  LINK_MARKDOWN_REGEX.lastIndex = 0;
  const segments: Array<
    { type: 'text'; text: string } | { type: 'link'; text: string; url: string }
  > = [];
  let lastIndex = 0;
  let removedBeforeSelection = 0;

  for (const match of text.matchAll(LINK_MARKDOWN_REGEX)) {
    const matchStart = match.index ?? 0;
    const matchText = match[0];
    const linkText = match[1];
    const url = match[2];
    const matchEnd = matchStart + matchText.length;

    if (selectionOffset !== null && selectionOffset >= matchStart && selectionOffset <= matchEnd) {
      return false;
    }

    if (matchStart > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, matchStart) });
    }

    segments.push({ type: 'link', text: linkText, url });

    if (selectionOffset !== null && matchEnd <= selectionOffset) {
      removedBeforeSelection += matchText.length - linkText.length;
    }

    lastIndex = matchEnd;
  }

  if (segments.length === 0) {
    return false;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  const style = textNode.getStyle();
  const detail = textNode.getDetail();
  const mode = textNode.getMode() as TextModeType;

  let selectionTarget: { node: TextNode; offset: number } | null = null;
  let remainingOffset =
    selectionOffset === null ? null : Math.max(0, selectionOffset - removedBeforeSelection);
  let currentNode: LexicalNode | null = null;

  segments.forEach((segment, index) => {
    if (segment.type === 'text') {
      if (!segment.text) {
        return;
      }

      const nextNode = createStyledTextNode(segment.text, 0, style, detail, mode);

      if (index === 0) {
        textNode.replace(nextNode);
        currentNode = nextNode;
      } else if (currentNode) {
        currentNode.insertAfter(nextNode);
        currentNode = nextNode;
      }

      if (remainingOffset !== null && selectionTarget === null) {
        if (remainingOffset <= segment.text.length) {
          selectionTarget = { node: nextNode, offset: remainingOffset };
        }
        remainingOffset -= segment.text.length;
      }

      return;
    }

    const linkNode = $createLinkNode(segment.url);
    const linkParse = parseInlineMarkdown(segment.text, null);

    if (linkParse.hasFormatting) {
      linkParse.segments.forEach((linkSegment) => {
        const linkTextNode = createStyledTextNode(
          linkSegment.text,
          linkSegment.format,
          style,
          detail,
          mode
        );
        linkNode.append(linkTextNode);
      });
    } else {
      linkNode.append(createStyledTextNode(segment.text, 0, style, detail, mode));
    }

    if (index === 0) {
      textNode.replace(linkNode);
      currentNode = linkNode;
    } else if (currentNode) {
      currentNode.insertAfter(linkNode);
      currentNode = linkNode;
    }

    if (remainingOffset !== null && selectionTarget === null) {
      remainingOffset -= segment.text.length;
    }
  });

  if (selectionOffset !== null && selectionTarget) {
    const target = selectionTarget as { node: TextNode; offset: number };
    target.node.select(target.offset, target.offset);
  }

  return true;
}

function transformTextNode(
  textNode: TextNode,
  selectionOffset: number | null
): { node: TextNode; offset: number } | null {
  const text = textNode.getTextContent();

  if (!MARKDOWN_MARKER_REGEX.test(text)) {
    return null;
  }

  const { segments, hasFormatting, newSelectionOffset } = parseInlineMarkdown(
    text,
    selectionOffset
  );
  if (!hasFormatting) {
    return null;
  }

  const style = textNode.getStyle();
  const detail = textNode.getDetail();
  const mode = textNode.getMode() as TextModeType;

  let selectionTarget: { node: TextNode; offset: number } | null = null;
  let remainingOffset = newSelectionOffset;
  let currentNode: TextNode | null = null;

  segments.forEach((segment, index) => {
    const nextNode = $createTextNode(segment.text);
    nextNode.setFormat(segment.format);
    nextNode.setStyle(style);
    nextNode.setDetail(detail);
    nextNode.setMode(mode);

    if (index === 0) {
      textNode.replace(nextNode);
      currentNode = nextNode;
    } else if (currentNode) {
      currentNode.insertAfter(nextNode);
      currentNode = nextNode;
    }

    if (remainingOffset !== null && selectionTarget === null) {
      if (remainingOffset <= segment.text.length) {
        selectionTarget = { node: nextNode, offset: remainingOffset };
      }
      remainingOffset -= segment.text.length;
    }
  });

  if (selectionOffset !== null && selectionTarget) {
    const target = selectionTarget as { node: TextNode; offset: number };
    target.node.select(target.offset, target.offset);
  }

  return selectionTarget;
}

function shouldSkipTextNode(textNode: TextNode): boolean {
  if (textNode.getFormat() !== 0) {
    return true;
  }

  if (isInsideCodeBlock(textNode)) {
    return true;
  }

  return false;
}

export function MarkdownAutoFormatPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const lastSelectionRef = useRef<SelectionInfo | null>(null);
  const isProcessingRef = useRef(false);

  const applyFormattingToBlock = useCallback(
    (blockKey: string, selectionInfo: SelectionInfo | null) => {
      if (isProcessingRef.current) {
        return;
      }

      isProcessingRef.current = true;
      editor.update(
        () => {
          const block = $getNodeByKey(blockKey);
          if (!block || !$isElementNode(block)) {
            return;
          }

          let targetBlock = block;

          if (!selectionInfo && $isParagraphNode(block)) {
            const prefixMatch = parseBlockPrefix(block.getTextContent());

            if (prefixMatch?.type === 'heading' && prefixMatch.headingTag) {
              const headingNode = $createCollapsibleHeadingNode(prefixMatch.headingTag);
              headingNode.append($createTextNode(prefixMatch.content));
              block.replace(headingNode);
              targetBlock = headingNode;
            } else if (prefixMatch?.type === 'blockquote') {
              const quoteNode = $createQuoteNode();
              const paragraphNode = $createParagraphNode();
              paragraphNode.append($createTextNode(prefixMatch.content));
              quoteNode.append(paragraphNode);
              block.replace(quoteNode);
              targetBlock = quoteNode;
            }
          }

          const textNodes = collectTextNodes(targetBlock);

          for (const textNode of textNodes) {
            if (shouldSkipTextNode(textNode)) {
              continue;
            }

            const selectionOffset =
              selectionInfo && selectionInfo.nodeKey === textNode.getKey()
                ? selectionInfo.offset
                : null;

            if (transformLinkTextNode(textNode, selectionOffset)) {
              continue;
            }

            transformTextNode(textNode, selectionOffset);
          }
        },
        { discrete: true, tag: AUTOFORMAT_TAG }
      );

      queueMicrotask(() => {
        isProcessingRef.current = false;
      });
    },
    [editor]
  );

  const handleSelectionChange = useCallback(() => {
    if (isProcessingRef.current) {
      return;
    }

    const prevSelection = lastSelectionRef.current;
    let nextSelection: SelectionInfo | null = null;

    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        return;
      }

      const anchor = selection.anchor;
      const anchorNode = anchor.getNode();
      const block = anchorNode.getTopLevelElementOrThrow();

      nextSelection = {
        blockKey: block.getKey(),
        nodeKey: anchorNode.getKey(),
        offset: anchor.offset,
      };
    });

    if (!nextSelection) {
      return;
    }

    const currentSelection = nextSelection as SelectionInfo;

    if (
      prevSelection &&
      prevSelection.nodeKey === currentSelection.nodeKey &&
      prevSelection.offset === currentSelection.offset
    ) {
      return;
    }

    if (prevSelection && prevSelection.blockKey !== currentSelection.blockKey) {
      applyFormattingToBlock(prevSelection.blockKey, null);
    }

    applyFormattingToBlock(currentSelection.blockKey, currentSelection);
    lastSelectionRef.current = currentSelection;
  }, [applyFormattingToBlock, editor]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        handleSelectionChange();
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, handleSelectionChange]);

  useEffect(() => {
    return editor.registerCommand(
      BLUR_COMMAND,
      () => {
        const lastSelection = lastSelectionRef.current;
        if (lastSelection) {
          applyFormattingToBlock(lastSelection.blockKey, null);
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [applyFormattingToBlock, editor]);

  return null;
}
