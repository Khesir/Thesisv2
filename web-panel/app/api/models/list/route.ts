import { NextRequest, NextResponse } from "next/server"
import { listModels } from "@/services/ebr-extractor"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, apiKey } = body

    if (!provider) {
      return NextResponse.json({ success: false, error: "Provider required" }, { status: 400 })
    }

    const result = await listModels(provider, apiKey || "")

    if (result.success && result.data) {
      return NextResponse.json({ success: true, models: (result.data as any).models || [] })
    }

    return NextResponse.json(
      { success: false, error: result.error || "Failed to list models" },
      { status: 500 }
    )
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}
