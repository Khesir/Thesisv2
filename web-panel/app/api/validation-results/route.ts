import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { ValidationResultModel } from "@/lib/entities/validation-result"

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const summary = searchParams.get("summary")

    if (summary === "true") {
      const results = await ValidationResultModel.find().lean()

      if (results.length === 0) {
        return NextResponse.json({
          success: true,
          summary: {
            totalValidated: 0,
            avgConsistency: 0,
            avgAccuracy: 0,
            perField: {},
          },
        })
      }

      // Aggregate per-field stats
      const fieldConsistencyCounts: Record<string, { match: number; total: number }> = {}
      const fieldAccuracyCounts: Record<string, { correct: number; total: number }> = {}

      for (const r of results) {
        const consistency = r.fieldConsistency as Record<string, boolean> | undefined
        const accuracy = r.fieldAccuracy as Record<string, boolean> | undefined

        if (consistency) {
          for (const [field, val] of Object.entries(consistency)) {
            if (!fieldConsistencyCounts[field]) fieldConsistencyCounts[field] = { match: 0, total: 0 }
            fieldConsistencyCounts[field].total++
            if (val) fieldConsistencyCounts[field].match++
          }
        }
        if (accuracy) {
          for (const [field, val] of Object.entries(accuracy)) {
            if (!fieldAccuracyCounts[field]) fieldAccuracyCounts[field] = { correct: 0, total: 0 }
            fieldAccuracyCounts[field].total++
            if (val) fieldAccuracyCounts[field].correct++
          }
        }
      }

      const perField: Record<string, { consistencyRate: number; accuracyRate: number }> = {}
      const allFields = new Set([...Object.keys(fieldConsistencyCounts), ...Object.keys(fieldAccuracyCounts)])
      for (const f of allFields) {
        const c = fieldConsistencyCounts[f]
        const a = fieldAccuracyCounts[f]
        perField[f] = {
          consistencyRate: c ? Math.round((c.match / c.total) * 100) : 0,
          accuracyRate: a ? Math.round((a.correct / a.total) * 100) : 0,
        }
      }

      const avgConsistency = Math.round(
        results.reduce((sum, r) => sum + (r.consistencyScore ?? 0), 0) / results.length
      )
      const avgAccuracy = Math.round(
        results.reduce((sum, r) => sum + (r.accuracyScore ?? 0), 0) / results.length
      )

      return NextResponse.json({
        success: true,
        summary: {
          totalValidated: results.length,
          avgConsistency,
          avgAccuracy,
          perField,
        },
      })
    }

    // Default: return paginated list
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    const [results, total] = await Promise.all([
      ValidationResultModel.find()
        .sort({ reviewedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ValidationResultModel.countDocuments(),
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
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch validation results" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()
    const { extractedDataId, chunkId, cropName, fieldConsistency, fieldAccuracy } = body

    if (!extractedDataId || !chunkId) {
      return NextResponse.json(
        { success: false, error: "extractedDataId and chunkId are required" },
        { status: 400 }
      )
    }

    // Calculate scores server-side
    const consistencyEntries = Object.values(fieldConsistency || {}) as boolean[]
    const accuracyEntries = Object.values(fieldAccuracy || {}) as boolean[]
    const totalFields = Math.max(consistencyEntries.length, accuracyEntries.length)

    const consistencyScore = consistencyEntries.length > 0
      ? Math.round((consistencyEntries.filter(Boolean).length / consistencyEntries.length) * 100)
      : 0

    const accuracyScore = accuracyEntries.length > 0
      ? Math.round((accuracyEntries.filter(Boolean).length / accuracyEntries.length) * 100)
      : 0

    const result = await ValidationResultModel.findOneAndUpdate(
      { extractedDataId },
      {
        extractedDataId,
        chunkId,
        cropName: cropName || "Unknown",
        fieldConsistency: fieldConsistency || {},
        consistencyScore,
        fieldAccuracy: fieldAccuracy || {},
        accuracyScore,
        totalFields,
        reviewedAt: new Date(),
      },
      { upsert: true, new: true, lean: true }
    )

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save validation result" },
      { status: 500 }
    )
  }
}
