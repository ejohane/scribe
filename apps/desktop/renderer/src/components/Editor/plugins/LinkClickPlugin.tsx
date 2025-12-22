/**
 * LinkClickPlugin
 *
 * Handles clicks on hyperlinks (anchor elements) in the Lexical editor.
 * Opens external URLs in the system's default browser using Electron's shell API.
 *
 * This is necessary because standard anchor click behavior doesn't work
 * properly in Electron - we need to explicitly handle the navigation.
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { createLogger } from '@scribe/shared';

const log = createLogger({ prefix: 'LinkClickPlugin' });

export function LinkClickPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Find the closest anchor element (handles clicks on nested elements within links)
      const anchor = target.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Only handle http/https URLs (external links)
      if (href.startsWith('http://') || href.startsWith('https://')) {
        event.preventDefault();
        event.stopPropagation();
        // Use Electron's shell API to open in system default browser
        window.scribe.shell.openExternal(href).catch((err: unknown) => {
          log.error('Failed to open external URL', { href, error: err });
        });
      }
    };

    rootElement.addEventListener('click', handleClick);

    return () => {
      rootElement.removeEventListener('click', handleClick);
    };
  }, [editor]);

  return null;
}
