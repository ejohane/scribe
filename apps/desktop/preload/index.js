"use strict";
/**
 * Electron preload script.
 * Exposes safe IPC methods to the renderer process.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * Exposed API for the renderer process.
 */
const api = {
    /**
     * Send an RPC request to the Core Engine.
     */
    sendRPCRequest: async (message) => {
        return await electron_1.ipcRenderer.invoke('rpc-request', message);
    },
};
// Expose the API to the renderer process
electron_1.contextBridge.exposeInMainWorld('scribeAPI', api);
//# sourceMappingURL=index.js.map