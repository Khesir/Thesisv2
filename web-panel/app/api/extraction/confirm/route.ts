import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { ChunkModel } from "@/lib/entities/chunk"
import { ExtractedDataModel } from "@/lib/entities/extracted-data"

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const { chunkId, data, action } = body

    if (!chunkId || !action) {
      return NextResponse.json(
        { success: false, error: "chunkId and action required" },
        { status: 400 }
      )
    }

    if (action === "accept" && data) {
      // Update or create extracted data
      const extractedData = await ExtractedDataModel.findOneAndUpdate(
        { chunkId },
        { ...data, chunkId, validatedAt: new Date() },
        { upsert: true, new: true, runValidators: true }
      )

      // Update chunk status
      await ChunkModel.findByIdAndUpdate(chunkId, {
        status: "processed",
        processedDataId: extractedData._id,
      })

      return NextResponse.json({ success: true, extractedData })
    }

    if (action === "reject") {
      // Reset chunk to not-processed
      await ChunkModel.findByIdAndUpdate(chunkId, {
        status: "not-processed",
        processedDataId: null,
      })

      // Remove extracted data if exists
      await ExtractedDataModel.deleteOne({ chunkId })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Confirmation failed" },
      { status: 500 }
    )
  }
}
