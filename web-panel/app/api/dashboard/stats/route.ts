import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { ChunkModel } from "@/lib/entities/chunk"
import { ExtractedDataModel } from "@/lib/entities/extracted-data"

export async function GET() {
  try {
    await connectDB()

    const [chunkStats, totalExtracted, sources] = await Promise.all([
      ChunkModel.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            byStatus: [
              {
                $group: {
                  _id: "$status",
                  count: { $sum: 1 },
                },
              },
            ],
          },
        },
      ]),
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

    // Extract counts from aggregation results
    const totalChunks = chunkStats[0]?.total[0]?.count || 0
    const statusCounts = chunkStats[0]?.byStatus || []
    const processedChunks = statusCounts.find((s: any) => s._id === "processed")?.count || 0
    const validationChunks = statusCounts.find((s: any) => s._id === "requires-validation")?.count || 0
    const notProcessedChunks = statusCounts.find((s: any) => s._id === "not-processed")?.count || 0
    const rejectedChunks = statusCounts.find((s: any) => s._id === "rejected")?.count || 0

    return NextResponse.json({
      success: true,
      stats: {
        totalChunks,
        processedChunks,
        validationChunks,
        notProcessedChunks,
        rejectedChunks,
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
