// Type definitions for the Scribe API exposed via contextBridge

export interface ScribeAPI {
  ping: () => Promise<{ message: string; timestamp: number }>;
  notes: {
    list: () => Promise<unknown[]>;
    read: (id: string) => Promise<unknown>;
    save: (note: unknown) => Promise<{ success: boolean }>;
    create: () => Promise<unknown>;
  };
  search: {
    query: (text: string) => Promise<unknown[]>;
  };
  graph: {
    forNote: (id: string) => Promise<unknown[]>;
    backlinks: (id: string) => Promise<unknown[]>;
  };
}

declare global {
  interface Window {
    scribe: ScribeAPI;
  }
}

export {};
