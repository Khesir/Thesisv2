export type TokenProvider = "anthropic" | "google" | "openai"

export interface APIToken {
  _id: string
  provider: TokenProvider
  token: string
  alias: string
  usageCount: number
  usageLimit: number | null
  quotaLimit: number | null
  cooldownMinutes: number
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}
