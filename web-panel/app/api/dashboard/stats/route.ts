import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { ChunkModel } from "@/lib/db/models/chunk.model"
import { ExtractedDataModel } from "@/lib/db/models/extracted-data.model"

export async function GET() {
  try {
    await connectDB()

    const [
      totalChunks,
      processedChunks,
      validationChunks,
      notProcessedChunks,
      totalExtracted,
      sources,
    ] = await Promise.all([
      ChunkModel.countDocuments(),
      ChunkModel.countDocuments({ status: "processed" }),
      ChunkModel.countDocuments({ status: "requires-validation" }),
      ChunkModel.countDocuments({ status: "not-processed" }),
      ExtractedDataModel.countDocuments(),
      ChunkModel.aggregate([
        {
          $group: {
            _id: "$source",
            total: { $sum: 1 },
            processed: {
              $sum: { $cond: [{ $eq: ["$status", "processed"] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ])

    return NextResponse.json({
      success: true,
      stats: {
        totalChunks,
        processedChunks,
        validationChunks,
        notProcessedChunks,
        totalExtracted,
      },
      sources: sources.map((s) => ({
        source: s._id,
        total: s.total,
        processed: s.processed,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
