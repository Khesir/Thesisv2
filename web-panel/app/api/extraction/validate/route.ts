import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { ChunkModel } from "@/lib/entities/chunk"
import { extractChunk } from "@/services/ebr-extractor"

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const { chunkId, provider, apiKey, strategy } = body

    const chunk = await ChunkModel.findById(chunkId).lean()
    if (!chunk) {
      return NextResponse.json(
        { success: false, error: "Chunk not found" },
        { status: 404 }
      )
    }

    // Re-extract for validation comparison
    const result = await extractChunk(
      chunk.content,
      provider || "auto",
      apiKey,
      undefined,
      strategy || "failover"
    )

    if (result.success && result.data) {
      return NextResponse.json({
        success: true,
        data: result.data.data,
        usage: result.data.usage,
        provider: result.data.provider,
      })
    }

    return NextResponse.json(
      { success: false, error: result.data?.error || result.error || "Validation extraction failed" },
      { status: 500 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Validation failed" },
      { status: 500 }
    )
  }
}
