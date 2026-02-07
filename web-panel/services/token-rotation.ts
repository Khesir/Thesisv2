import { type IAPIToken, type TokenProvider } from "@/lib/entities/api-token"
import { extractChunk } from "./ebr-extractor"
import { logger } from "@/lib/logger"

interface TokenPoolEntry {
  token: IAPIToken
  inFlight: number
}

class TokenRotationService {
  private pool: Map<string, TokenPoolEntry> = new Map()

  loadTokens(tokens: IAPIToken[]) {
    this.pool.clear()
    const activeTokens = tokens.filter((t) => t.isActive)
    logger.info('TokenRotation', `Loaded ${activeTokens.length}/${tokens.length} active tokens`, {
      byProvider: {
        anthropic: activeTokens.filter((t) => t.provider === "anthropic").length,
        google: activeTokens.filter((t) => t.provider === "google").length,
        openai: activeTokens.filter((t) => t.provider === "openai").length,
      },
    })
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
    const before = candidates.length
    candidates = candidates.filter((e) => {
      if (e.token.usageLimit === null) return true
      return e.token.usageCount < e.token.usageLimit
    })

    if (candidates.length === 0) {
      logger.warn('TokenRotation', `No available tokens${provider ? ` for ${provider}` : ""}`, {
        totalInPool: this.pool.size,
        checkedProvider: provider,
        exhaustedTokens: before - candidates.length,
      })
      return null
    }

    // Pick least-used token (usage count + in-flight)
    candidates.sort(
      (a, b) =>
        a.token.usageCount + a.inFlight - (b.token.usageCount + b.inFlight)
    )

    const selected = candidates[0]
    logger.debug('TokenRotation', `Selected token for extraction`, {
      provider: selected.token.provider,
      alias: selected.token.alias,
      usageCount: selected.token.usageCount,
      usageLimit: selected.token.usageLimit,
      candidatesCount: candidates.length,
    })

    return selected
  }

  recordUsage(tokenId: string, requestCount: number = 1) {
    const entry = this.pool.get(tokenId)
    if (entry) {
      entry.token.usageCount += requestCount
      entry.inFlight = Math.max(0, entry.inFlight - 1)
      entry.token.lastUsedAt = new Date()
      entry.token.updatedAt = new Date()
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
    logger.debug('TokenRotation', `Starting processWithRotation`, {
      provider,
      strategy,
      maxAttempts,
      contentLength: content.length,
    })

    let attempts = 0

    while (attempts < maxAttempts) {
      const entry = this.getNextToken(provider)

      if (!entry) {
        const error = `No available API tokens${provider ? ` for ${provider}` : ""}`
        logger.error('TokenRotation', error)
        return { success: false, error }
      }

      entry.inFlight++
      logger.debug('TokenRotation', `Attempt ${attempts + 1}/${maxAttempts}`, {
        tokenProvider: entry.token.provider,
        tokenAlias: entry.token.alias,
      })

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
          logger.info('TokenRotation', `Extraction successful on attempt ${attempts + 1}`, {
            tokenId: entry.token._id,
            provider: result.data.provider,
          })
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

        const errorMsg = result.error || "Unknown error"

        if (this.isRateLimitError(String(errorMsg))) {
          logger.warn('TokenRotation', `Rate limit detected, marking token as exhausted`, {
            tokenId: entry.token._id,
            error: errorMsg,
          })
          this.markExhausted(entry.token._id)
          attempts++
          continue
        }

        entry.inFlight = Math.max(0, entry.inFlight - 1)
        logger.error('TokenRotation', `Extraction failed, not retrying`, {
          attempt: attempts + 1,
          error: errorMsg,
        })
        return { success: false, error: String(errorMsg) }
      } catch (err) {
        entry.inFlight = Math.max(0, entry.inFlight - 1)
        const errorMsg = err instanceof Error ? err.message : String(err)

        logger.error('TokenRotation', `Exception during extraction`, {
          attempt: attempts + 1,
          error: errorMsg,
        })

        if (this.isRateLimitError(errorMsg)) {
          logger.warn('TokenRotation', `Rate limit in exception, retrying with next token`, {
            tokenId: entry.token._id,
          })
          this.markExhausted(entry.token._id)
          attempts++
          continue
        }

        return { success: false, error: errorMsg }
      }
    }

    const finalError = "All tokens exhausted"
    logger.error('TokenRotation', finalError, { attempts: maxAttempts })
    return { success: false, error: finalError }
  }

  getTokens(): IAPIToken[] {
    return [...this.pool.values()].map((e) => e.token)
  }
}

// Singleton instance
export const tokenRotation = new TokenRotationService()
