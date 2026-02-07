import { APIToken, TokenProvider } from "@/lib/types/api-token"
import { extractChunk } from "./ebr-extractor"

interface TokenPoolEntry {
  token: APIToken
  inFlight: number
}

class TokenRotationService {
  private pool: Map<string, TokenPoolEntry> = new Map()

  loadTokens(tokens: APIToken[]) {
    this.pool.clear()
    for (const token of tokens) {
      if (token.isActive) {
        this.pool.set(token._id, { token, inFlight: 0 })
      }
    }
  }

  getNextToken(provider?: TokenProvider): TokenPoolEntry | null {
    let candidates = [...this.pool.values()]

    if (provider) {
      candidates = candidates.filter((e) => e.token.provider === provider)
    }

    // Filter out exhausted tokens
    candidates = candidates.filter((e) => {
      if (e.token.usageLimit === null) return true
      return e.token.usageCount < e.token.usageLimit
    })

    if (candidates.length === 0) return null

    // Pick least-used token (usage count + in-flight)
    candidates.sort(
      (a, b) =>
        a.token.usageCount + a.inFlight - (b.token.usageCount + b.inFlight)
    )

    return candidates[0]
  }

  recordUsage(tokenId: string, requestCount: number = 1) {
    const entry = this.pool.get(tokenId)
    if (entry) {
      entry.token.usageCount += requestCount
      entry.inFlight = Math.max(0, entry.inFlight - 1)
      entry.token.lastUsedAt = new Date().toISOString()
      entry.token.updatedAt = new Date().toISOString()
    }
  }

  markExhausted(tokenId: string) {
    const entry = this.pool.get(tokenId)
    if (entry) {
      entry.token.isActive = false
      entry.inFlight = 0
    }
  }

  isRateLimitError(error: string): boolean {
    const lower = error.toLowerCase()
    return (
      lower.includes("429") ||
      lower.includes("rate limit") ||
      lower.includes("quota") ||
      lower.includes("too many requests")
    )
  }

  async processWithRotation(
    content: string,
    provider?: TokenProvider,
    strategy: string = "failover",
    maxAttempts: number = 3
  ): Promise<{
    success: boolean
    data?: Record<string, unknown>
    usage?: { input_tokens: number; output_tokens: number }
    provider?: string
    tokenId?: string
    error?: string
  }> {
    let attempts = 0

    while (attempts < maxAttempts) {
      const entry = this.getNextToken(provider)

      if (!entry) {
        return {
          success: false,
          error: `No available API tokens${provider ? ` for ${provider}` : ""}`,
        }
      }

      entry.inFlight++

      try {
        const result = await extractChunk(
          content,
          entry.token.provider,
          entry.token.token,
          undefined,
          strategy
        )

        if (result.success && result.data) {
          this.recordUsage(entry.token._id)
          return {
            success: true,
            data: result.data.data as Record<string, unknown>,
            usage: result.data.usage as
              | { input_tokens: number; output_tokens: number }
              | undefined,
            provider: result.data.provider as string | undefined,
            tokenId: entry.token._id,
          }
        }

        const errorMsg = result.data?.error || result.error || "Unknown error"

        if (this.isRateLimitError(String(errorMsg))) {
          this.markExhausted(entry.token._id)
          attempts++
          continue
        }

        entry.inFlight = Math.max(0, entry.inFlight - 1)
        return { success: false, error: String(errorMsg) }
      } catch (err) {
        entry.inFlight = Math.max(0, entry.inFlight - 1)
        const errorMsg = err instanceof Error ? err.message : String(err)

        if (this.isRateLimitError(errorMsg)) {
          this.markExhausted(entry.token._id)
          attempts++
          continue
        }

        return { success: false, error: errorMsg }
      }
    }

    return { success: false, error: "All tokens exhausted" }
  }

  getTokens(): APIToken[] {
    return [...this.pool.values()].map((e) => e.token)
  }
}

// Singleton instance
export const tokenRotation = new TokenRotationService()
