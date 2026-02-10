import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getSavedUri: (): Promise<string> => ipcRenderer.invoke("get-saved-uri"),
  testConnection: (uri: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("test-connection", uri),
  connect: (uri: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("connect", uri),
  onStartupProgress: (callback: (message: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, message: string) => callback(message);
    ipcRenderer.on("startup-progress", handler);
    return () => ipcRenderer.removeListener("startup-progress", handler);
  },
});
