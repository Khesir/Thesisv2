import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { APITokenModel, maskToken } from "@/lib/entities/api-token"
import { tokenCooldown } from "@/services/token-cooldown"

export async function GET() {
  try {
    await connectDB()

    const tokens = await APITokenModel.find().sort({ createdAt: -1 }).lean()

    // Mask tokens and enrich with cooldown status
    const masked = tokens.map((t) => ({
      ...t,
      token: maskToken(t.token),
      rateLimited: tokenCooldown.isRateLimited(String(t._id)),
      cooldownRemaining: tokenCooldown.getCooldownRemaining(String(t._id)),
      cooldownTotal: tokenCooldown.getCooldownTotal(String(t._id)),
      quotaUsed: tokenCooldown.getQuotaUsed(String(t._id)),
      invalidKey: tokenCooldown.isInvalidKey(String(t._id)),
    }))

    return NextResponse.json({ success: true, tokens: masked })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch tokens" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const { provider, token, alias, usageLimit, quotaLimit, cooldownMinutes } = body

    if (!provider || !token || !alias) {
      return NextResponse.json(
        { success: false, error: "Provider, token, and alias required" },
        { status: 400 }
      )
    }

    const created = await APITokenModel.create({
      provider,
      token,
      alias,
      usageLimit: usageLimit || null,
      quotaLimit: quotaLimit ?? null,
      cooldownMinutes: cooldownMinutes ?? 60,
    })

    return NextResponse.json({
      success: true,
      token: { ...created.toObject(), token: maskToken(created.token) },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create token" },
      { status: 500 }
    )
  }
}
