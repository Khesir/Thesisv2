import { NextRequest, NextResponse } from "next/server"
import { testToken } from "@/services/ebr-extractor"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, apiKey } = body

    if (!provider || !apiKey) {
      return NextResponse.json(
        { valid: false, error: "Provider and API key required" },
        { status: 400 }
      )
    }

    const result = await testToken(provider, apiKey)

    if (result.success && result.data) {
      return NextResponse.json({
        valid: result.data.valid,
        error: result.data.error,
      })
    }

    return NextResponse.json({
      valid: false,
      error: result.data?.error || result.error || "Test failed",
    })
  } catch (error) {
    return NextResponse.json({
      valid: false,
      error: error instanceof Error ? error.message : "Test failed",
    }, { status: 500 })
  }
}
