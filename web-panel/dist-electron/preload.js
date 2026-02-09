"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    getSavedUri: () => electron_1.ipcRenderer.invoke("get-saved-uri"),
    testConnection: (uri) => electron_1.ipcRenderer.invoke("test-connection", uri),
    connect: (uri) => electron_1.ipcRenderer.invoke("connect", uri),
});
//# sourceMappingURL=preload.js.map