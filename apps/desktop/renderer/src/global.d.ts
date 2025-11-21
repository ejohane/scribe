/**
 * Global type definitions for the renderer process.
 */

import type { ScribeAPI } from '../../preload';

declare global {
  interface Window {
    scribeAPI: ScribeAPI;
  }
}

export {};
