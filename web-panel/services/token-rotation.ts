import { type IAPIToken, type TokenProvider } from "@/lib/entities/api-token"
import { extractChunk } from "./ebr-extractor"
import { tokenCooldown } from "./token-cooldown"
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

    // Filter out exhausted, rate-limited, and quota-exhausted tokens
    const before = candidates.length
    candidates = candidates.filter((e) => {
      // Check if key was flagged as invalid during this session
      if (tokenCooldown.isInvalidKey(e.token._id)) return false
      // Check hard usage limit
      if (e.token.usageLimit !== null && e.token.usageCount >= e.token.usageLimit) return false
      // Check in-memory rate limit cooldown
      if (tokenCooldown.isRateLimited(e.token._id)) return false
      // Check daily quota
      if (tokenCooldown.isQuotaExhausted(e.token._id, e.token.quotaLimit)) return false
      return true
    })

    if (candidates.length === 0) {
      logger.warn('TokenRotation', `No available tokens${provider ? ` for ${provider}` : ""}`, {
        totalInPool: this.pool.size,
        checkedProvider: provider,
        filteredOut: before - candidates.length,
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
      // Track daily quota usage
      tokenCooldown.markQuotaUsed(tokenId)
    }
  }

  markExhausted(tokenId: string) {
    const entry = this.pool.get(tokenId)
    if (entry) {
      // Use cooldown instead of permanently disabling
      const cooldownSeconds = (entry.token.cooldownMinutes || 60) * 60
      tokenCooldown.markRateLimitedWithTotal(tokenId, cooldownSeconds)
      entry.inFlight = 0
      logger.info('TokenRotation', `Token rate-limited for ${entry.token.cooldownMinutes || 60}m`, {
        tokenId,
        alias: entry.token.alias,
        cooldownSeconds,
      })
    }
  }

  isRateLimitError(error: string): boolean {
    const lower = error.toLowerCase()
    return (
      lower.includes("429") ||
      lower.includes("rate limit") ||
      lower.includes("rate_limit") ||
      lower.includes("ratelimit") ||
      lower.includes("quota") ||
      lower.includes("too many requests") ||
      lower.includes("overloaded") ||
      lower.includes("resource_exhausted") ||
      lower.includes("billing") ||
      lower.includes("credit")
    )
  }

  isInvalidKeyError(error: string): boolean {
    const lower = error.toLowerCase()
    return (
      lower.includes("api_key_invalid") ||
      lower.includes("invalid api key") ||
      lower.includes("invalid or expired api key") ||
      lower.includes("api key not valid") ||
      lower.includes("401") ||
      lower.includes("unauthorized") ||
      lower.includes("authentication")
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
    tokenAlias?: string
    error?: string
    traceback?: string
  }> {
    // Ensure we can try at least as many times as tokens in pool
    const effectiveMaxAttempts = Math.max(maxAttempts, this.pool.size)
    logger.debug('TokenRotation', `Starting processWithRotation`, {
      provider,
      strategy,
      maxAttempts: effectiveMaxAttempts,
      poolSize: this.pool.size,
      contentLength: content.length,
    })

    let attempts = 0

    while (attempts < effectiveMaxAttempts) {
      const entry = this.getNextToken(provider)

      if (!entry) {
        // Build a descriptive error explaining why no tokens are available
        const allEntries = [...this.pool.values()]
        const reasons: string[] = []
        for (const e of allEntries) {
          if (provider && e.token.provider !== provider) continue
          const tokenLabel = e.token.alias || e.token.provider
          if (tokenCooldown.isInvalidKey(e.token._id)) {
            reasons.push(`${tokenLabel}: invalid API key`)
          } else if (e.token.usageLimit !== null && e.token.usageCount >= e.token.usageLimit) {
            reasons.push(`${tokenLabel}: usage limit reached (${e.token.usageCount}/${e.token.usageLimit})`)
          } else if (tokenCooldown.isRateLimited(e.token._id)) {
            const remaining = tokenCooldown.getCooldownRemaining(e.token._id)
            reasons.push(`${tokenLabel}: rate-limited (${Math.ceil(remaining / 60)}m remaining)`)
          } else if (tokenCooldown.isQuotaExhausted(e.token._id, e.token.quotaLimit)) {
            const used = tokenCooldown.getQuotaUsed(e.token._id)
            reasons.push(`${tokenLabel}: daily quota exhausted (${used}/${e.token.quotaLimit})`)
          }
        }
        const reasonStr = reasons.length > 0 ? ` Reasons: ${reasons.join("; ")}` : ""
        const error = `No available API tokens${provider ? ` for ${provider}` : ""}.${reasonStr}`
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
            tokenAlias: entry.token.alias,
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
            tokenAlias: entry.token.alias,
          }
        }

        const errorMsg = result.error || "Unknown error"

        if (this.isRateLimitError(String(errorMsg))) {
          logger.warn('TokenRotation', `Rate limit detected, marking token as rate-limited`, {
            tokenId: entry.token._id,
            error: errorMsg,
          })
          this.markExhausted(entry.token._id)
          attempts++
          continue
        }

        if (this.isInvalidKeyError(String(errorMsg))) {
          logger.warn('TokenRotation', `Invalid API key detected, disabling token and trying next`, {
            tokenId: entry.token._id,
            alias: entry.token.alias,
            error: errorMsg,
          })
          // Mark as invalid in cooldown cache — persists across loadTokens() calls
          tokenCooldown.markInvalidKey(entry.token._id)
          attempts++
          continue
        }

        entry.inFlight = Math.max(0, entry.inFlight - 1)
        const tokenLabel = entry.token.alias || entry.token.provider
        logger.error('TokenRotation', `Extraction failed, not retrying`, {
          attempt: attempts + 1,
          token: tokenLabel,
          error: errorMsg,
        })
        return { success: false, error: `[${tokenLabel}] ${errorMsg}`, traceback: result.traceback }
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

        if (this.isInvalidKeyError(errorMsg)) {
          logger.warn('TokenRotation', `Invalid API key in exception, disabling token and trying next`, {
            tokenId: entry.token._id,
            alias: entry.token.alias,
          })
          this.pool.delete(entry.token._id)
          attempts++
          continue
        }

        const tokenLabel = entry.token.alias || entry.token.provider
        return { success: false, error: `[${tokenLabel}] ${errorMsg}` }
      }
    }

    const finalError = "All tokens exhausted after " + attempts + " attempts (all rate-limited, invalid, or quota exceeded)"
    logger.error('TokenRotation', finalError, { attempts })
    return { success: false, error: finalError }
  }

  getTokens(): IAPIToken[] {
    return [...this.pool.values()].map((e) => e.token)
  }
}

// Singleton instance
export const tokenRotation = new TokenRotationService()
