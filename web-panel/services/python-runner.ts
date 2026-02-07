import { spawn } from "child_process"
import path from "path"
import { logger } from "@/lib/logger"

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
        const parsed = JSON.parse(stdout)
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
