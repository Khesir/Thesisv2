/**
 * Simple logging utility for server-side operations
 * Logs to console with timestamps for debugging and monitoring
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

function formatTime(): string {
  return new Date().toISOString().split('T')[1].split('.')[0]
}

function log(level: LogLevel, context: string, message: string, data?: unknown) {
  const timestamp = formatTime()
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`

  if (data !== undefined) {
    if (typeof data === 'object' && data !== null) {
      console.log(`${prefix}`, message)
      console.log(JSON.stringify(data, null, 2))
    } else {
      console.log(`${prefix}`, message, data)
    }
  } else {
    console.log(`${prefix}`, message)
  }
}

export const logger = {
  info: (context: string, message: string, data?: unknown) => log('info', context, message, data),
  warn: (context: string, message: string, data?: unknown) => log('warn', context, message, data),
  error: (context: string, message: string, data?: unknown) => log('error', context, message, data),
  debug: (context: string, message: string, data?: unknown) => log('debug', context, message, data),
}
