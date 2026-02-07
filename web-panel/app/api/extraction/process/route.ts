import { NextRequest, NextResponse } from "next/server"
import { extractChunk } from "@/services/ebr-extractor"
import { connectDB } from "@/lib/db/connection"
import { ChunkModel } from "@/lib/db/models/chunk.model"
import { ExtractedDataModel } from "@/lib/db/models/extracted-data.model"

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const { chunkId, content, provider, apiKey, strategy } = body

    if (!content) {
      return NextResponse.json({ success: false, error: "No content provided" }, { status: 400 })
    }

    // Mark chunk as processing
    if (chunkId) {
      await ChunkModel.findByIdAndUpdate(chunkId, { status: "processing" })
    }

    const result = await extractChunk(
      content,
      provider || "auto",
      apiKey,
      undefined,
      strategy || "failover"
    )

    if (result.success && result.data) {
      // Save extracted data to DB if we have a chunkId
      if (chunkId && result.data.data) {
        const extractedData = await ExtractedDataModel.create({
          chunkId,
          ...(result.data.data as Record<string, unknown>),
          rawResponse: result.data.data,
        })

        // Update chunk status
        await ChunkModel.findByIdAndUpdate(chunkId, {
          status: "requires-validation",
          processedDataId: extractedData._id,
        })
      }

      return NextResponse.json({
        success: true,
        data: result.data.data,
        usage: result.data.usage,
        provider: result.data.provider,
      })
    }

    // Extraction failed - reset chunk status
    if (chunkId) {
      await ChunkModel.findByIdAndUpdate(chunkId, { status: "not-processed" })
    }

    return NextResponse.json({
      success: false,
      error: result.data?.error || result.error || "Extraction failed",
    }, { status: 500 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Extraction failed",
    }, { status: 500 })
  }
}
