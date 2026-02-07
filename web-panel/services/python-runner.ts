import { spawn } from "child_process"
import path from "path"

const PYTHON_CMD = process.platform === "win32" ? "python" : "python3"
const SCRIPTS_DIR = path.resolve(process.cwd(), "..", "finder_system", "web_scripts")

interface RunScriptOptions {
  scriptName: string
  args?: string[]
  stdin?: string
  timeout?: number
}

interface ScriptResult<T = unknown> {
  success: boolean
  data: T
  error?: string
}

export async function runScript<T = unknown>({
  scriptName,
  args = [],
  stdin,
  timeout = 120000,
}: RunScriptOptions): Promise<ScriptResult<T>> {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName)

  return new Promise((resolve) => {
    const proc = spawn(PYTHON_CMD, [scriptPath, ...args], {
      cwd: path.resolve(process.cwd(), ".."),
      env: { ...process.env },
      timeout,
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    proc.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    if (stdin) {
      proc.stdin.write(stdin)
      proc.stdin.end()
    }

    proc.on("close", (code) => {
      if (code !== 0 && !stdout) {
        resolve({
          success: false,
          data: null as T,
          error: stderr || `Process exited with code ${code}`,
        })
        return
      }

      try {
        const parsed = JSON.parse(stdout)
        resolve({
          success: parsed.success !== false && parsed.valid !== false,
          data: parsed as T,
        })
      } catch {
        resolve({
          success: false,
          data: null as T,
          error: `Failed to parse output: ${stdout.slice(0, 200)}`,
        })
      }
    })

    proc.on("error", (err) => {
      resolve({
        success: false,
        data: null as T,
        error: `Failed to start process: ${err.message}`,
      })
    })
  })
}
