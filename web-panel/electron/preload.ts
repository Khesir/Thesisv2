import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getSavedUri: (): Promise<string> => ipcRenderer.invoke("get-saved-uri"),
  testConnection: (uri: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("test-connection", uri),
  connect: (uri: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("connect", uri),
});
