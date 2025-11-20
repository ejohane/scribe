/// <reference types="vite/client" />

import type { ScribeAPI } from '../../preload/index';

declare global {
  interface Window {
    scribeAPI: ScribeAPI;
  }
}
