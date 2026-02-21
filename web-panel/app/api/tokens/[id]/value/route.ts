import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { APITokenModel } from "@/lib/entities/api-token"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const token = await APITokenModel.findById(id).select("token provider alias").lean()
    if (!token) {
      return NextResponse.json({ success: false, error: "Token not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, token: token.token, provider: token.provider, alias: token.alias })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch token" },
      { status: 500 }
    )
  }
}
