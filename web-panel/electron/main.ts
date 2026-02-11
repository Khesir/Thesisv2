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
      env.RESOURCES_PATH = process.resourcesPath;
    }

    nextProcess = spawn(serverCmd, serverArgs, {
      cwd: serverCwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32" && isDev,
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

// Run migrations using the existing migration-runner.ts script
async function runMigrations(
  uri: string,
  sendProgress: (msg: string) => Promise<void>
): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd: string;
    let args: string[];
    let cwd: string;

    if (isDev) {
      cmd = process.platform === "win32" ? "npx.cmd" : "npx";
      args = ["tsx", "scripts/migration-runner.ts"];
      cwd = path.join(__dirname, "..");
    } else {
      // In packaged mode, migration-runner is pre-compiled to JS
      cmd = "node";
      args = [path.join(process.resourcesPath, "app", "scripts", "migration-runner.js")];
      cwd = path.join(process.resourcesPath, "app");
    }

    const env: NodeJS.ProcessEnv = { ...process.env, MONGODB_URI: uri };

    // In production, set NODE_PATH so the migration runner can find mongoose
    // from the standalone Next.js output's node_modules
    if (!isDev) {
      const standaloneNodeModules = path.join(process.resourcesPath, "app", "standalone", "node_modules");
      env.NODE_PATH = standaloneNodeModules;
    }

    const proc = spawn(cmd, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32" && isDev,
    });

    let stderr = "";

    proc.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        console.log("[Migration]", line);

        // Parse migration-runner output for progress messages
        if (line.includes("No pending migrations")) {
          sendProgress("Database is up to date");
        } else if (line.startsWith("Running:")) {
          sendProgress(`Running migration: ${line.replace("Running:", "").trim()}`);
        } else if (line.includes("pending migration")) {
          sendProgress(line.trim());
        } else if (line.includes("All migrations completed")) {
          sendProgress("Migrations complete");
        }
      }
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`Migration process failed to start: ${err.message}`));
    });

    proc.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Migration failed (exit code ${code}): ${stderr.slice(0, 500)}`));
      }
    });
  });
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

  ipcMain.handle("connect", async (event, uri: string) => {
    const MIN_STEP_MS = 800;
    let lastStepTime = Date.now();

    const sendProgress = async (message: string) => {
      // Ensure previous message was visible for at least MIN_STEP_MS
      const elapsed = Date.now() - lastStepTime;
      if (elapsed < MIN_STEP_MS) {
        await new Promise((r) => setTimeout(r, MIN_STEP_MS - elapsed));
      }
      try {
        event.sender.send("startup-progress", message);
      } catch {
        // Window may be closed
      }
      lastStepTime = Date.now();
    };

    try {
      // Step 1: Test connection
      await sendProgress("Connecting to database...");
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      await conn.disconnect();

      // Step 2: Run migrations
      await sendProgress("Checking database migrations...");
      await runMigrations(uri, sendProgress);

      // Step 3: Save URI
      await sendProgress("Saving configuration...");
      storeSet("mongodbUri", uri);

      // Step 4: Start Next.js server
      await sendProgress("Starting web server...");
      await startNextServer(uri);

      await sendProgress("Almost ready...");

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
