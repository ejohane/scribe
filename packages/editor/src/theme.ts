/**
 * Lexical editor theme configuration.
 *
 * Provides CSS class names for Lexical node types.
 * These classes are applied to rendered DOM elements.
 *
 * @module
 */

import type { EditorThemeClasses } from 'lexical';

/**
 * Scribe editor theme - CSS class mappings for Lexical.
 *
 * Each property maps a Lexical node type to a CSS class name.
 * The actual styles are defined in styles.css.
 */
export const editorTheme: EditorThemeClasses = {
  paragraph: 'scribe-p',
  heading: {
    h1: 'scribe-h1',
    h2: 'scribe-h2',
    h3: 'scribe-h3',
    h4: 'scribe-h4',
    h5: 'scribe-h5',
    h6: 'scribe-h6',
  },
  text: {
    bold: 'scribe-bold',
    italic: 'scribe-italic',
    underline: 'scribe-underline',
    strikethrough: 'scribe-strikethrough',
    code: 'scribe-code-inline',
    subscript: 'scribe-subscript',
    superscript: 'scribe-superscript',
  },
  list: {
    ol: 'scribe-list-ol',
    ul: 'scribe-list-ul',
    listitem: 'scribe-list-item',
    listitemChecked: 'scribe-list-item-checked',
    listitemUnchecked: 'scribe-list-item-unchecked',
    nested: {
      listitem: 'scribe-nested-list-item',
    },
  },
  link: 'scribe-link',
  quote: 'scribe-quote',
  code: 'scribe-code-block',
  codeHighlight: {
    atrule: 'scribe-code-atrule',
    attr: 'scribe-code-attr',
    boolean: 'scribe-code-boolean',
    builtin: 'scribe-code-builtin',
    cdata: 'scribe-code-cdata',
    char: 'scribe-code-char',
    class: 'scribe-code-class',
    'class-name': 'scribe-code-class-name',
    comment: 'scribe-code-comment',
    constant: 'scribe-code-constant',
    deleted: 'scribe-code-deleted',
    doctype: 'scribe-code-doctype',
    entity: 'scribe-code-entity',
    function: 'scribe-code-function',
    important: 'scribe-code-important',
    inserted: 'scribe-code-inserted',
    keyword: 'scribe-code-keyword',
    namespace: 'scribe-code-namespace',
    number: 'scribe-code-number',
    operator: 'scribe-code-operator',
    prolog: 'scribe-code-prolog',
    property: 'scribe-code-property',
    punctuation: 'scribe-code-punctuation',
    regex: 'scribe-code-regex',
    selector: 'scribe-code-selector',
    string: 'scribe-code-string',
    symbol: 'scribe-code-symbol',
    tag: 'scribe-code-tag',
    url: 'scribe-code-url',
    variable: 'scribe-code-variable',
  },
};
