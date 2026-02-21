import { runScript } from "./python-runner"
import { logger } from "@/lib/logger"

interface ExtractChunkResult {
  success: boolean
  data: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number }
  provider?: string
  error?: string
}

interface TestTokenResult {
  valid: boolean
  error?: string
}

export async function extractChunk(
  content: string,
  provider: string = "auto",
  apiKey?: string,
  model?: string,
  strategy: string = "failover"
) {
  logger.debug('EBRExtractor', 'Starting chunk extraction', {
    provider,
    strategy,
    contentLength: content.length,
    hasApiKey: !!apiKey,
  })

  const result = await runScript<ExtractChunkResult>({
    scriptName: "extract_chunk.py",
    stdin: JSON.stringify({
      content,
      provider,
      api_key: apiKey || "",
      model: model || undefined,
      strategy,
    }),
    timeout: 180000, // 3 min for LLM calls
  })

  if (!result.success) {
    logger.error('EBRExtractor', 'Chunk extraction failed', {
      provider,
      strategy,
      error: result.error,
    })
  }

  return result
}

export async function testToken(provider: string, apiKey: string) {
  logger.debug('EBRExtractor', 'Testing token', { provider })

  const result = await runScript<TestTokenResult>({
    scriptName: "test_token.py",
    stdin: JSON.stringify({
      provider,
      api_key: apiKey,
    }),
    timeout: 60000,
  })

  if (!result.success) {
    logger.warn('EBRExtractor', 'Token test failed', {
      provider,
      error: result.error,
    })
  }

  return result
}
