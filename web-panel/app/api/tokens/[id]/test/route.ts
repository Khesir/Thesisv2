import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { APITokenModel } from "@/lib/entities/api-token"
import { testToken } from "@/services/ebr-extractor"
import { tokenCooldown } from "@/services/token-cooldown"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const token = await APITokenModel.findById(id).lean()
    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token not found" },
        { status: 404 }
      )
    }

    const result = await testToken(token.provider, token.token)

    if (result.success && result.data) {
      // Clear invalid flag if test passes
      if (result.data.valid) {
        tokenCooldown.clearInvalidKey(id)
      }
      return NextResponse.json({
        valid: result.data.valid,
        error: result.data.error,
      })
    }

    return NextResponse.json({
      valid: false,
      error: result.data?.error || result.error || "Test failed",
    })
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    )
  }
}
