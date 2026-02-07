import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { ExtractedDataModel } from "@/lib/entities/extracted-data"
import { ChunkModel } from "@/lib/entities/chunk"

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category")
    const source = searchParams.get("source")
    const sort = searchParams.get("sort") || "desc"
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")

    const filter: Record<string, unknown> = {}
    if (category && category !== "all") filter.category = category

    // If filtering by source, find chunk IDs for that source first
    if (source && source !== "all") {
      const chunkIds = await ChunkModel.find({ source }).lean().distinct("_id")
      filter.chunkId = { $in: chunkIds }
    }

    const sortOrder = sort === "asc" ? 1 : -1
    const skip = (page - 1) * limit

    const [results, total] = await Promise.all([
      ExtractedDataModel.find(filter)
        .sort({ createdAt: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate("chunkId", "source chunkIndex")
        .lean(),
      ExtractedDataModel.countDocuments(filter),
    ])

    return NextResponse.json({
      success: true,
      data: results,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch data" },
      { status: 500 }
    )
  }
}
