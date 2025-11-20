/**
 * Electron preload script.
 * Exposes safe IPC methods to the renderer process.
 */
/**
 * Exposed API for the renderer process.
 */
declare const api: {
    /**
     * Send an RPC request to the Core Engine.
     */
    sendRPCRequest: (message: unknown) => Promise<unknown>;
};
export type ScribeAPI = typeof api;
export {};
//# sourceMappingURL=index.d.ts.map