import type { ScribeAPI } from './preload';

declare global {
  interface Window {
    scribe: ScribeAPI;
  }
}

export {};
