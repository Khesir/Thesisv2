import { runScript } from "./python-runner"

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
  return runScript<ExtractChunkResult>({
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
}

export async function testToken(provider: string, apiKey: string) {
  return runScript<TestTokenResult>({
    scriptName: "test_token.py",
    stdin: JSON.stringify({
      provider,
      api_key: apiKey,
    }),
    timeout: 30000,
  })
}
