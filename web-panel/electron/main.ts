import { app, BrowserWindow, ipcMain } from "electron";
import { ChildProcess, spawn } from "child_process";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";

// Simple JSON file store (avoids electron-store ESM issues)
const storeFilePath = path.join(app.getPath("userData"), "config.json");

function storeGet(key: string, defaultValue: string = ""): string {
  try {
    if (!fs.existsSync(storeFilePath)) return defaultValue;
    const data = JSON.parse(fs.readFileSync(storeFilePath, "utf-8"));
    return data[key] ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

function storeSet(key: string, value: unknown): void {
  try {
    let data: Record<string, unknown> = {};
    if (fs.existsSync(storeFilePath)) {
      data = JSON.parse(fs.readFileSync(storeFilePath, "utf-8"));
    }
    data[key] = value;
    fs.writeFileSync(storeFilePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // ignore write errors
  }
}

const isDev = !app.isPackaged;

let connectWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let nextProcess: ChildProcess | null = null;
let nextPort = 3000;

function createConnectWindow() {
  connectWindow = new BrowserWindow({
    width: 600,
    height: 520,
    resizable: false,
    maximizable: false,
    title: "Thesis Againn",
    icon: isDev
      ? path.join(__dirname, "..", "build_resources", "icon.ico")
      : path.join(process.resourcesPath, "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const connectHtmlPath = isDev
    ? path.join(__dirname, "..", "electron", "connect.html")
    : path.join(process.resourcesPath, "app", "electron", "connect.html");

  connectWindow.loadFile(connectHtmlPath);
  connectWindow.setMenuBarVisibility(false);

  connectWindow.on("closed", () => {
    connectWindow = null;
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Thesis Againn",
    icon: isDev
      ? path.join(__dirname, "..", "build_resources", "icon.ico")
      : path.join(process.resourcesPath, "icon.ico"),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(`http://localhost:${nextPort}`);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function startNextServer(uri: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let serverCmd: string;
    let serverArgs: string[];
    let serverCwd: string;

    if (isDev) {
      serverCmd = process.platform === "win32" ? "npx.cmd" : "npx";
      serverArgs = ["next", "dev", "--port", String(nextPort)];
      serverCwd = path.join(__dirname, "..");
    } else {
      serverCmd = "node";
      serverArgs = [path.join(process.resourcesPath, "app", "standalone", "server.js")];
      serverCwd = path.join(process.resourcesPath, "app", "standalone");
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      MONGODB_URI: uri,
      PORT: String(nextPort),
      HOSTNAME: "localhost",
    };

    if (!isDev) {
      env.ELECTRON_PACKAGED = "true";
    }

    nextProcess = spawn(serverCmd, serverArgs, {
      cwd: serverCwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    let started = false;
    const timeoutId = setTimeout(() => {
      if (!started) {
        reject(new Error("Next.js server did not start within 30 seconds"));
      }
    }, 30000);

    const onData = (data: Buffer) => {
      const output = data.toString();
      console.log("[Next.js]", output);

      // Detect if Next.js picked a different port (e.g. "using available port 3001")
      const portMatch = output.match(/using available port (\d+)/i);
      if (portMatch) {
        nextPort = parseInt(portMatch[1], 10);
        console.log(`[Electron] Next.js switched to port ${nextPort}`);
      }

      if (!started && (output.includes("Ready") || output.includes("ready") || output.includes(`localhost:${nextPort}`) || output.includes("started server"))) {
        started = true;
        clearTimeout(timeoutId);
        resolve();
      }
    };

    nextProcess.stdout?.on("data", onData);
    nextProcess.stderr?.on("data", onData);

    nextProcess.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    nextProcess.on("exit", (code) => {
      if (!started) {
        clearTimeout(timeoutId);
        reject(new Error(`Next.js process exited with code ${code}`));
      }
    });
  });
}

function killNextProcess() {
  if (nextProcess && !nextProcess.killed) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(nextProcess.pid), "/f", "/t"], { shell: true });
    } else {
      nextProcess.kill("SIGTERM");
    }
    nextProcess = null;
  }
}

// IPC Handlers
function setupIPC() {
  ipcMain.handle("get-saved-uri", async () => {
    return storeGet("mongodbUri", "");
  });

  ipcMain.handle("test-connection", async (_event, uri: string) => {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      await conn.disconnect();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle("connect", async (_event, uri: string) => {
    try {
      // Test connection first
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      await conn.disconnect();

      // Save URI
      storeSet("mongodbUri", uri);

      // Start Next.js server
      await startNextServer(uri);

      // Close connect window, open main window
      if (connectWindow) {
        connectWindow.close();
      }
      createMainWindow();

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });
}

// App lifecycle
app.whenReady().then(async () => {
  setupIPC();
  createConnectWindow();
});

app.on("window-all-closed", () => {
  killNextProcess();
  app.quit();
});

app.on("before-quit", () => {
  killNextProcess();
});
