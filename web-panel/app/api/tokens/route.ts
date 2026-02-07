import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { APITokenModel } from "@/lib/db/models/api-token.model"

function maskToken(token: string): string {
  if (token.length <= 8) return "****"
  return token.slice(0, 4) + "****" + token.slice(-4)
}

export async function GET() {
  try {
    await connectDB()

    const tokens = await APITokenModel.find().sort({ createdAt: -1 }).lean()

    // Mask tokens in response
    const masked = tokens.map((t) => ({
      ...t,
      token: maskToken(t.token),
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
    const { provider, token, alias, usageLimit } = body

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
