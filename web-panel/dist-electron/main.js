"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const mongoose_1 = __importDefault(require("mongoose"));
// Simple JSON file store (avoids electron-store ESM issues)
const storeFilePath = path_1.default.join(electron_1.app.getPath("userData"), "config.json");
function storeGet(key, defaultValue = "") {
    try {
        if (!fs_1.default.existsSync(storeFilePath))
            return defaultValue;
        const data = JSON.parse(fs_1.default.readFileSync(storeFilePath, "utf-8"));
        return data[key] ?? defaultValue;
    }
    catch {
        return defaultValue;
    }
}
function storeSet(key, value) {
    try {
        let data = {};
        if (fs_1.default.existsSync(storeFilePath)) {
            data = JSON.parse(fs_1.default.readFileSync(storeFilePath, "utf-8"));
        }
        data[key] = value;
        fs_1.default.writeFileSync(storeFilePath, JSON.stringify(data, null, 2), "utf-8");
    }
    catch {
        // ignore write errors
    }
}
const isDev = !electron_1.app.isPackaged;
let connectWindow = null;
let mainWindow = null;
let nextProcess = null;
let nextPort = 3000;
function createConnectWindow() {
    connectWindow = new electron_1.BrowserWindow({
        width: 600,
        height: 520,
        resizable: false,
        maximizable: false,
        title: "Thesis Againn",
        icon: isDev
            ? path_1.default.join(__dirname, "..", "build_resources", "icon.ico")
            : path_1.default.join(process.resourcesPath, "icon.ico"),
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    const connectHtmlPath = isDev
        ? path_1.default.join(__dirname, "..", "electron", "connect.html")
        : path_1.default.join(process.resourcesPath, "app", "electron", "connect.html");
    connectWindow.loadFile(connectHtmlPath);
    connectWindow.setMenuBarVisibility(false);
    connectWindow.on("closed", () => {
        connectWindow = null;
    });
}
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        title: "Thesis Againn",
        icon: isDev
            ? path_1.default.join(__dirname, "..", "build_resources", "icon.ico")
            : path_1.default.join(process.resourcesPath, "icon.ico"),
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
async function startNextServer(uri) {
    return new Promise((resolve, reject) => {
        let serverCmd;
        let serverArgs;
        let serverCwd;
        if (isDev) {
            serverCmd = process.platform === "win32" ? "npx.cmd" : "npx";
            serverArgs = ["next", "dev", "--port", String(nextPort)];
            serverCwd = path_1.default.join(__dirname, "..");
        }
        else {
            serverCmd = "node";
            serverArgs = [path_1.default.join(process.resourcesPath, "app", "standalone", "server.js")];
            serverCwd = path_1.default.join(process.resourcesPath, "app", "standalone");
        }
        const env = {
            ...process.env,
            MONGODB_URI: uri,
            PORT: String(nextPort),
            HOSTNAME: "localhost",
        };
        if (!isDev) {
            env.ELECTRON_PACKAGED = "true";
        }
        nextProcess = (0, child_process_1.spawn)(serverCmd, serverArgs, {
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
        const onData = (data) => {
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
            (0, child_process_1.spawn)("taskkill", ["/pid", String(nextProcess.pid), "/f", "/t"], { shell: true });
        }
        else {
            nextProcess.kill("SIGTERM");
        }
        nextProcess = null;
    }
}
// IPC Handlers
function setupIPC() {
    electron_1.ipcMain.handle("get-saved-uri", async () => {
        return storeGet("mongodbUri", "");
    });
    electron_1.ipcMain.handle("test-connection", async (_event, uri) => {
        try {
            const conn = await mongoose_1.default.connect(uri, {
                serverSelectionTimeoutMS: 5000,
            });
            await conn.disconnect();
            return { success: true };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, error: message };
        }
    });
    electron_1.ipcMain.handle("connect", async (_event, uri) => {
        try {
            // Test connection first
            const conn = await mongoose_1.default.connect(uri, {
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, error: message };
        }
    });
}
// App lifecycle
electron_1.app.whenReady().then(async () => {
    setupIPC();
    createConnectWindow();
});
electron_1.app.on("window-all-closed", () => {
    killNextProcess();
    electron_1.app.quit();
});
electron_1.app.on("before-quit", () => {
    killNextProcess();
});
//# sourceMappingURL=main.js.map