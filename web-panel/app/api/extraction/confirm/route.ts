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
      // Strip immutable/meta fields before saving
      const { _id, createdAt, updatedAt, __v, ...cleanData } = data

      // If accepting a specific extraction by its _id, use that; otherwise find by chunkId
      const filter = _id ? { _id } : { chunkId }

      const extractedData = await ExtractedDataModel.findOneAndUpdate(
        filter,
        { ...cleanData, chunkId, validatedAt: new Date() },
        { upsert: true, new: true, runValidators: true }
      )

      // Remove other extractions for this chunk (keep only the accepted one)
      await ExtractedDataModel.deleteMany({ chunkId, _id: { $ne: extractedData._id } })

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
