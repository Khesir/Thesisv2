import NodeCache from "node-cache"

class TokenCooldownService {
  private cache: NodeCache
  private invalidKeys: Set<string> = new Set()

  constructor() {
    this.cache = new NodeCache({ checkperiod: 30 })
  }

  /**
   * Mark a token as rate-limited with a TTL cooldown
   */
  markRateLimited(tokenId: string, cooldownSeconds: number) {
    this.cache.set(`ratelimit:${tokenId}`, Date.now(), cooldownSeconds)
  }

  /**
   * Check if a token is currently rate-limited
   */
  isRateLimited(tokenId: string): boolean {
    return this.cache.has(`ratelimit:${tokenId}`)
  }

  /**
   * Get remaining cooldown seconds (0 if not limited)
   */
  getCooldownRemaining(tokenId: string): number {
    const ttl = this.cache.getTtl(`ratelimit:${tokenId}`)
    if (!ttl) return 0
    const remaining = Math.ceil((ttl - Date.now()) / 1000)
    return Math.max(0, remaining)
  }

  /**
   * Get total cooldown that was set (stored separately)
   */
  getCooldownTotal(tokenId: string): number {
    return (this.cache.get<number>(`ratelimit-total:${tokenId}`)) || 0
  }

  /**
   * Mark rate limited with total tracking
   */
  markRateLimitedWithTotal(tokenId: string, cooldownSeconds: number) {
    this.cache.set(`ratelimit:${tokenId}`, Date.now(), cooldownSeconds)
    this.cache.set(`ratelimit-total:${tokenId}`, cooldownSeconds, cooldownSeconds)
  }

  /**
   * Increment daily quota usage counter (resets at midnight)
   */
  markQuotaUsed(tokenId: string) {
    const key = `quota:${tokenId}`
    const current = this.cache.get<number>(key) || 0

    // Calculate seconds until midnight
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    const ttl = Math.ceil((midnight.getTime() - now.getTime()) / 1000)

    this.cache.set(key, current + 1, ttl)
  }

  /**
   * Get current daily quota usage
   */
  getQuotaUsed(tokenId: string): number {
    return this.cache.get<number>(`quota:${tokenId}`) || 0
  }

  /**
   * Check if daily quota is exhausted
   */
  isQuotaExhausted(tokenId: string, quotaLimit: number | null): boolean {
    if (quotaLimit === null) return false
    return this.getQuotaUsed(tokenId) >= quotaLimit
  }

  /**
   * Mark a token as having an invalid API key.
   * Persists in memory across loadTokens() calls until server restart.
   */
  markInvalidKey(tokenId: string) {
    this.invalidKeys.add(String(tokenId))
  }

  /**
   * Check if a token has been flagged as having an invalid key.
   */
  isInvalidKey(tokenId: string): boolean {
    return this.invalidKeys.has(String(tokenId))
  }

  /**
   * Clear invalid key flag (e.g., after user updates the token).
   */
  clearInvalidKey(tokenId: string) {
    this.invalidKeys.delete(String(tokenId))
  }
}

// Singleton
export const tokenCooldown = new TokenCooldownService()
