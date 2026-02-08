import { spawn } from "child_process"
import path from "path"
import fs from "fs"
import { logger } from "@/lib/logger"

// Determine Python command - prefer venv if available
function getPythonCmd(): string {
  const projectRoot = path.resolve(process.cwd(), "..")
  
  // Check for virtual environment
  const isWindows = process.platform === "win32"
  const venvPythonPath = isWindows
    ? path.join(projectRoot, "venv", "Scripts", "python.exe")
    : path.join(projectRoot, "venv", "bin", "python")
  
  if (fs.existsSync(venvPythonPath)) {
    logger.debug('PythonRunner', `Using virtual environment Python: ${venvPythonPath}`)
    return venvPythonPath
  }
  
  // Fall back to system Python
  const fallback = isWindows ? "python" : "python3"
  logger.debug('PythonRunner', `No venv found, using system Python: ${fallback}`)
  return fallback
}

const PYTHON_CMD = getPythonCmd()
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

  logger.debug('PythonRunner', `Starting script: ${scriptName}`, { scriptPath, args, timeout })

  return new Promise((resolve) => {
    const startTime = Date.now()
    const proc = spawn(PYTHON_CMD, [scriptPath, ...args], {
      cwd: path.resolve(process.cwd(), ".."),
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      timeout,
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    proc.stderr.on("data", (data) => {
      stderr += data.toString()
      if (stderr.length > 0) {
        logger.debug('PythonRunner', `Script stderr: ${stderr.slice(-500)}`)
      }
    })

    if (stdin) {
      proc.stdin.write(stdin)
      proc.stdin.end()
    }

    proc.on("close", (code) => {
      const duration = Date.now() - startTime

      if (code !== 0 && !stdout) {
        logger.error('PythonRunner', `Script failed`, {
          scriptName,
          exitCode: code,
          duration: `${duration}ms`,
          stderr: stderr.slice(0, 500),
        })

        resolve({
          success: false,
          data: null as T,
          error: stderr || `Process exited with code ${code}`,
        })
        return
      }

      try {
        // Try to extract JSON from output (handles cases where there's extra text)
        let jsonStr = stdout.trim()
        
        // Look for JSON object in output
        const jsonStartIdx = jsonStr.indexOf('{')
        const jsonEndIdx = jsonStr.lastIndexOf('}')
        
        if (jsonStartIdx >= 0 && jsonEndIdx > jsonStartIdx) {
          jsonStr = jsonStr.substring(jsonStartIdx, jsonEndIdx + 1)
        }

        const parsed = JSON.parse(jsonStr)
        const success = parsed.success !== false && parsed.valid !== false

        if (success) {
          logger.debug('PythonRunner', `Script completed successfully`, {
            scriptName,
            duration: `${duration}ms`,
            hasData: !!parsed,
          })
        } else {
          logger.warn('PythonRunner', `Script returned failure`, {
            scriptName,
            duration: `${duration}ms`,
            error: parsed.error || 'Unknown error',
          })
        }

        resolve({
          success,
          data: parsed as T,
        })
      } catch {
        logger.error('PythonRunner', `Failed to parse script output`, {
          scriptName,
          duration: `${duration}ms`,
          rawOutput: stdout.slice(0, 300),
        })

        resolve({
          success: false,
          data: null as T,
          error: `Failed to parse output: ${stdout.slice(0, 200)}`,
        })
      }
    })

    proc.on("error", (err) => {
      const duration = Date.now() - startTime

      logger.error('PythonRunner', `Failed to spawn process`, {
        scriptName,
        duration: `${duration}ms`,
        error: err.message,
      })

      resolve({
        success: false,
        data: null as T,
        error: `Failed to start process: ${err.message}`,
      })
    })
  })
}
