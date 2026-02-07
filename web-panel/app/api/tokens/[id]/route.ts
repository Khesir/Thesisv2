import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { APITokenModel } from "@/lib/db/models/api-token.model"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params
    const body = await req.json()

    // Don't allow updating the actual token value through PATCH
    const { alias, usageLimit, isActive } = body
    const update: Record<string, unknown> = {}
    if (alias !== undefined) update.alias = alias
    if (usageLimit !== undefined) update.usageLimit = usageLimit
    if (isActive !== undefined) update.isActive = isActive

    const token = await APITokenModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean()

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Token not found" },
        { status: 404 }
      )
    }

    // Mask the token before returning
    const masked = {
      ...token,
      token:
        token.token.length <= 8
          ? "****"
          : token.token.slice(0, 4) + "****" + token.token.slice(-4),
    }

    return NextResponse.json({ success: true, token: masked })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update token" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const token = await APITokenModel.findByIdAndDelete(id)
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Token not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete token" },
      { status: 500 }
    )
  }
}
