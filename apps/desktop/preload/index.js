"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// preload/index.ts
var index_exports = {};
module.exports = __toCommonJS(index_exports);
var import_electron = require("electron");
var api = {
  /**
   * Send an RPC request to the Core Engine.
   */
  sendRPCRequest: async (message) => {
    return await import_electron.ipcRenderer.invoke("rpc-request", message);
  }
};
import_electron.contextBridge.exposeInMainWorld("scribeAPI", api);
