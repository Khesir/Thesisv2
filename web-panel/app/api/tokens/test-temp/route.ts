import { NextRequest, NextResponse } from "next/server"
import { testToken } from "@/services/ebr-extractor"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, token } = body

    if (!provider || !token) {
      return NextResponse.json(
        { valid: false, error: "Provider and token required" },
        { status: 400 }
      )
    }

    const result = await testToken(provider, token)

    return NextResponse.json({
      valid: result.success && result.data?.valid,
      error: result.data?.error || result.error,
    })
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    )
  }
}
