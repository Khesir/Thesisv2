/**
 * API Token Entity - Types Definition
 *
 * This file defines all TypeScript types and interfaces for the APIToken entity.
 * Represents API credentials for LLM providers with usage tracking.
 */

// ============= TYPE DEFINITIONS =============

export type TokenProvider = "anthropic" | "google" | "openai"

/**
 * Input type: Used when creating API tokens
 */
export interface CreateTokenInput {
  provider: TokenProvider
  token: string
  alias: string
  usageLimit?: number | null
}

/**
 * Update type: Used when updating API tokens
 */
export interface UpdateTokenInput {
  alias?: string
  usageLimit?: number | null
  isActive?: boolean
}

/**
 * Database type: Complete document as stored in MongoDB
 */
export interface IAPIToken {
  _id: string
  provider: TokenProvider
  token: string
  alias: string
  usageCount: number
  usageLimit: number | null
  isActive: boolean
  lastUsedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * API Response type: What the client receives (token masked)
 */
export interface APITokenResponse {
  _id: string
  provider: TokenProvider
  alias: string
  maskedToken: string // Only first 4 and last 4 chars visible
  usageCount: number
  usageLimit: number | null
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

// ============= CONSTANTS =============

export const TOKEN_PROVIDERS = ["anthropic", "google", "openai"] as const

export const PROVIDER_LABELS: Record<TokenProvider, string> = {
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini)",
  openai: "OpenAI",
}

/**
 * Mask a token for safe display: shows first 4 and last 4 chars
 */
export function maskToken(token: string): string {
  if (token.length <= 8) return "****"
  const first4 = token.substring(0, 4)
  const last4 = token.substring(token.length - 4)
  return `${first4}...${last4}`
}
