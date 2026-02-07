import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { ChunkModel } from "@/lib/db/models/chunk.model"

export async function GET() {
  try {
    await connectDB()
    const sources = await ChunkModel.distinct("source")
    return NextResponse.json({ success: true, sources })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch sources" },
      { status: 500 }
    )
  }
}
