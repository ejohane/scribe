/**
 * AutoLinkPlugin wrapper
 *
 * Configures Lexical's AutoLinkPlugin with URL matchers for automatic
 * detection and conversion of typed/pasted URLs into clickable links.
 *
 * How it works:
 * - Plugin uses registerNodeTransform to watch text changes
 * - When text matches URL_REGEX, it's wrapped in AutoLinkNode
 * - Only matches http:// and https:// URLs (not mailto:, ftp:, etc.)
 *
 * Why not match other protocols:
 * - mailto: could be added but requires different UX (open email client)
 * - ftp://, file:// have security implications
 * - We want predictable, safe behavior
 */

import {
  AutoLinkPlugin as LexicalAutoLinkPlugin,
  createLinkMatcherWithRegExp,
} from '@lexical/react/LexicalAutoLinkPlugin';

// Regex for matching URLs (http:// and https://)
// Adapted from Lexical playground examples
const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/;

// Optional: Email regex for future enhancement
// const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

const MATCHERS = [
  createLinkMatcherWithRegExp(URL_REGEX, (text) => text),
  // Uncomment to enable email auto-linking:
  // createLinkMatcherWithRegExp(EMAIL_REGEX, (email) => `mailto:${email}`),
];

export function AutoLinkPlugin(): JSX.Element | null {
  return <LexicalAutoLinkPlugin matchers={MATCHERS} />;
}
