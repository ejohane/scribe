/**
 * Electron preload script.
 * Exposes safe IPC methods to the renderer process.
 */
import { contextBridge, ipcRenderer } from 'electron';
/**
 * Exposed API for the renderer process.
 */
const api = {
    /**
     * Send an RPC request to the Core Engine.
     */
    sendRPCRequest: async (message) => {
        return await ipcRenderer.invoke('rpc-request', message);
    },
};
// Expose the API to the renderer process
contextBridge.exposeInMainWorld('scribeAPI', api);
