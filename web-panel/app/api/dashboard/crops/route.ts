import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { ExtractedDataModel } from "@/lib/entities/extracted-data"

export async function GET() {
  try {
    await connectDB()

    const crops = await ExtractedDataModel.aggregate([
      {
        $group: {
          _id: "$cropName",
          count: { $sum: 1 },
          category: { $first: "$category" },
        },
      },
      { $sort: { count: -1 } },
    ])

    return NextResponse.json({
      success: true,
      crops: crops.map((c) => ({
        name: c._id,
        count: c.count,
        category: c.category,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch crops" },
      { status: 500 }
    )
  }
}
