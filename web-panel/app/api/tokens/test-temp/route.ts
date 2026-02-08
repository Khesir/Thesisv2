import { NextRequest, NextResponse } from "next/server"
import { testToken } from "@/services/ebr-extractor"
import type { TokenProvider } from "@/lib/entities/api-token"

const PROVIDER_DEFAULTS: Record<TokenProvider, { quotaLimit: number | null; cooldownMinutes: number; description: string }> = {
  google: { quotaLimit: 1500, cooldownMinutes: 60, description: "Google free tier: ~1500 requests/day, 60min cooldown" },
  anthropic: { quotaLimit: null, cooldownMinutes: 5, description: "Anthropic: usage-based billing, 5min cooldown" },
  openai: { quotaLimit: null, cooldownMinutes: 5, description: "OpenAI: usage-based billing, 5min cooldown" },
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, token } = body

    if (!provider || !token) {
      return NextResponse.json(
        { valid: false, error: "Provider and token required" },
        { status: 400 }
      )
    }

    const result = await testToken(provider, token)
    const isValid = result.success && result.data?.valid
    const defaults = PROVIDER_DEFAULTS[provider as TokenProvider]

    return NextResponse.json({
      valid: isValid,
      error: result.data?.error || result.error,
      ...(isValid && defaults ? {
        suggestedQuotaLimit: defaults.quotaLimit,
        suggestedCooldownMinutes: defaults.cooldownMinutes,
        providerDescription: defaults.description,
      } : {}),
    })
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    )
  }
}
