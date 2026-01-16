/**
 * Tests for editor theme configuration
 */

import { describe, it, expect } from 'vitest';
import { editorTheme } from './theme';

describe('editorTheme', () => {
  it('exports a valid theme object', () => {
    expect(editorTheme).toBeDefined();
    expect(typeof editorTheme).toBe('object');
  });

  it('has paragraph class', () => {
    expect(editorTheme.paragraph).toBe('scribe-p');
  });

  describe('heading classes', () => {
    it('has h1-h6 heading classes', () => {
      expect(editorTheme.heading).toBeDefined();
      expect(editorTheme.heading?.h1).toBe('scribe-h1');
      expect(editorTheme.heading?.h2).toBe('scribe-h2');
      expect(editorTheme.heading?.h3).toBe('scribe-h3');
      expect(editorTheme.heading?.h4).toBe('scribe-h4');
      expect(editorTheme.heading?.h5).toBe('scribe-h5');
      expect(editorTheme.heading?.h6).toBe('scribe-h6');
    });
  });

  describe('text formatting classes', () => {
    it('has bold class', () => {
      expect(editorTheme.text?.bold).toBe('scribe-bold');
    });

    it('has italic class', () => {
      expect(editorTheme.text?.italic).toBe('scribe-italic');
    });

    it('has underline class', () => {
      expect(editorTheme.text?.underline).toBe('scribe-underline');
    });

    it('has strikethrough class', () => {
      expect(editorTheme.text?.strikethrough).toBe('scribe-strikethrough');
    });

    it('has inline code class', () => {
      expect(editorTheme.text?.code).toBe('scribe-code-inline');
    });

    it('has subscript class', () => {
      expect(editorTheme.text?.subscript).toBe('scribe-subscript');
    });

    it('has superscript class', () => {
      expect(editorTheme.text?.superscript).toBe('scribe-superscript');
    });
  });

  describe('list classes', () => {
    it('has ordered list class', () => {
      expect(editorTheme.list?.ol).toBe('scribe-list-ol');
    });

    it('has unordered list class', () => {
      expect(editorTheme.list?.ul).toBe('scribe-list-ul');
    });

    it('has list item class', () => {
      expect(editorTheme.list?.listitem).toBe('scribe-list-item');
    });

    it('has nested list item class', () => {
      expect(editorTheme.list?.nested?.listitem).toBe('scribe-nested-list-item');
    });

    it('has checked list item class', () => {
      expect(editorTheme.list?.listitemChecked).toBe('scribe-list-item-checked');
    });

    it('has unchecked list item class', () => {
      expect(editorTheme.list?.listitemUnchecked).toBe('scribe-list-item-unchecked');
    });
  });

  it('has link class', () => {
    expect(editorTheme.link).toBe('scribe-link');
  });

  it('has quote class', () => {
    expect(editorTheme.quote).toBe('scribe-quote');
  });

  it('has code block class', () => {
    expect(editorTheme.code).toBe('scribe-code-block');
  });

  describe('code highlight classes', () => {
    it('has comment class', () => {
      expect(editorTheme.codeHighlight?.comment).toBe('scribe-code-comment');
    });

    it('has keyword class', () => {
      expect(editorTheme.codeHighlight?.keyword).toBe('scribe-code-keyword');
    });

    it('has string class', () => {
      expect(editorTheme.codeHighlight?.string).toBe('scribe-code-string');
    });

    it('has function class', () => {
      expect(editorTheme.codeHighlight?.function).toBe('scribe-code-function');
    });

    it('has number class', () => {
      expect(editorTheme.codeHighlight?.number).toBe('scribe-code-number');
    });

    it('has operator class', () => {
      expect(editorTheme.codeHighlight?.operator).toBe('scribe-code-operator');
    });
  });
});
