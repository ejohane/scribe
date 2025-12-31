/**
 * Deep Link Handlers
 *
 * Handles scribe:// protocol URLs for opening notes, daily notes, and search.
 *
 * Supported URL patterns:
 * - scribe://note/{noteId} - Open specific note
 * - scribe://daily - Open today's daily note
 * - scribe://daily/{YYYY-MM-DD} - Open daily note for specific date
 * - scribe://search?q={query} - Open search with query (future)
 *
 * @module handlers/deepLinkHandlers
 */

import { app } from 'electron';
import type { DeepLinkAction, DeepLinkParseResult } from '@scribe/shared';
import { mainLogger } from '../logger';

/** Protocol scheme for Scribe deep links */
export const DEEP_LINK_PROTOCOL = 'scribe';

/**
 * Parse a scribe:// URL into a DeepLinkAction.
 *
 * @param url - The full URL string (e.g., "scribe://note/abc123")
 * @returns Parsed result with action and validity
 *
 * @example
 * ```typescript
 * parseDeepLink('scribe://note/abc123')
 * // => { valid: true, action: { type: 'note', noteId: 'abc123' }, originalUrl: '...' }
 *
 * parseDeepLink('scribe://daily/2025-01-15')
 * // => { valid: true, action: { type: 'daily', date: '2025-01-15' }, originalUrl: '...' }
 *
 * parseDeepLink('scribe://daily')
 * // => { valid: true, action: { type: 'daily' }, originalUrl: '...' }
 * ```
 */
export function parseDeepLink(url: string): DeepLinkParseResult {
  const result: DeepLinkParseResult = {
    valid: false,
    action: { type: 'unknown', url },
    originalUrl: url,
  };

  try {
    // Handle URL parsing - URL class expects proper scheme format
    const parsed = new URL(url);

    // Verify it's our protocol
    if (parsed.protocol !== `${DEEP_LINK_PROTOCOL}:`) {
      mainLogger.warn('Deep link received with unexpected protocol', {
        url,
        protocol: parsed.protocol,
      });
      return result;
    }

    // Parse the host/path - URL parsing treats "scribe://note/abc" as:
    // - host: "note"
    // - pathname: "/abc"
    const host = parsed.host.toLowerCase();
    const pathSegments = parsed.pathname.split('/').filter(Boolean);

    switch (host) {
      case 'note': {
        // scribe://note/{noteId}
        const noteId = pathSegments[0];
        if (noteId) {
          result.valid = true;
          result.action = { type: 'note', noteId };
        } else {
          mainLogger.warn('Deep link note URL missing noteId', { url });
        }
        break;
      }

      case 'daily': {
        // scribe://daily or scribe://daily/{YYYY-MM-DD}
        const date = pathSegments[0];
        result.valid = true;
        if (date) {
          // Validate date format (basic check for YYYY-MM-DD pattern)
          if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            result.action = { type: 'daily', date };
          } else {
            mainLogger.warn('Deep link daily URL has invalid date format', { url, date });
            result.action = { type: 'daily' }; // Fall back to today
          }
        } else {
          result.action = { type: 'daily' };
        }
        break;
      }

      case 'search': {
        // scribe://search?q={query}
        const query = parsed.searchParams.get('q');
        if (query) {
          result.valid = true;
          result.action = { type: 'search', query };
        } else {
          mainLogger.warn('Deep link search URL missing query parameter', { url });
        }
        break;
      }

      default:
        mainLogger.warn('Deep link received with unknown action', { url, host });
    }
  } catch (error) {
    mainLogger.error('Failed to parse deep link URL', { url, error });
  }

  return result;
}

/**
 * Extract deep link URL from command line arguments.
 * Used on Windows/Linux where URLs are passed as arguments.
 *
 * @param argv - Command line arguments array
 * @returns The scribe:// URL if found, undefined otherwise
 */
export function extractDeepLinkFromArgv(argv: string[]): string | undefined {
  // Look for an argument that starts with our protocol
  const deepLink = argv.find((arg) => arg.startsWith(`${DEEP_LINK_PROTOCOL}://`));
  return deepLink;
}

/**
 * Register the app as the default handler for the scribe:// protocol.
 * This should be called during app initialization.
 *
 * Note: On macOS, the protocol is registered via Info.plist (electron-builder config).
 * This call is mainly for Windows/Linux where runtime registration is needed.
 */
export function registerProtocolHandler(): void {
  // Check if already set as default (avoid unnecessary operations)
  if (app.isDefaultProtocolClient(DEEP_LINK_PROTOCOL)) {
    mainLogger.debug('Already registered as default protocol client for scribe://');
    return;
  }

  // Register as the default protocol handler
  const success = app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL);
  if (success) {
    mainLogger.info('Registered as default protocol client for scribe://');
  } else {
    mainLogger.error('Failed to register as default protocol client for scribe://');
  }
}
