import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { ExtractedDataModel } from "@/lib/db/models/extracted-data.model"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chunkId: string }> }
) {
  try {
    await connectDB()
    const { chunkId } = await params

    const result = await ExtractedDataModel.findOne({ chunkId }).lean()
    if (!result) {
      return NextResponse.json(
        { success: false, error: "No extraction result found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch results" },
      { status: 500 }
    )
  }
}
