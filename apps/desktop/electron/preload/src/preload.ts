import { contextBridge, ipcRenderer } from 'electron';

// Define the API surface exposed to the renderer
const scribeAPI = {
  // Ping test API
  ping: () => ipcRenderer.invoke('ping'),

  // Notes API (to be implemented)
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    read: (id: string) => ipcRenderer.invoke('notes:read', id),
    save: (note: unknown) => ipcRenderer.invoke('notes:save', note),
    create: () => ipcRenderer.invoke('notes:create'),
  },

  // Search API (to be implemented)
  search: {
    query: (text: string) => ipcRenderer.invoke('search:query', text),
  },

  // Graph API (to be implemented)
  graph: {
    forNote: (id: string) => ipcRenderer.invoke('graph:forNote', id),
    backlinks: (id: string) => ipcRenderer.invoke('graph:backlinks', id),
  },
};

// Expose the API to the renderer via contextBridge
contextBridge.exposeInMainWorld('scribe', scribeAPI);

// Type declaration for TypeScript support in renderer
export type ScribeAPI = typeof scribeAPI;
