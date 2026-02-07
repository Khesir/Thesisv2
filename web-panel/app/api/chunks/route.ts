import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { ChunkModel } from "@/lib/db/models/chunk.model"

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const source = searchParams.get("source")
    const search = searchParams.get("search")
    const sort = searchParams.get("sort") || "desc"
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")

    const filter: Record<string, unknown> = {}
    if (status && status !== "all") filter.status = status
    if (source && source !== "all") filter.source = source
    if (search) {
      filter.content = { $regex: search, $options: "i" }
    }

    const sortOrder = sort === "asc" ? 1 : -1
    const skip = (page - 1) * limit

    const [chunks, total] = await Promise.all([
      ChunkModel.find(filter)
        .sort({ createdAt: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      ChunkModel.countDocuments(filter),
    ])

    return NextResponse.json({
      success: true,
      chunks,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch chunks" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()
    const { chunks } = body

    if (!chunks || !Array.isArray(chunks)) {
      return NextResponse.json(
        { success: false, error: "Chunks array required" },
        { status: 400 }
      )
    }

    const created = await ChunkModel.insertMany(chunks)

    return NextResponse.json({
      success: true,
      chunks: created,
      count: created.length,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create chunks" },
      { status: 500 }
    )
  }
}
