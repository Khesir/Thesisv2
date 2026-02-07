import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { ChunkModel } from "@/lib/db/models/chunk.model"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const chunk = await ChunkModel.findById(id).lean()
    if (!chunk) {
      return NextResponse.json(
        { success: false, error: "Chunk not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, chunk })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch chunk" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params
    const body = await req.json()

    const chunk = await ChunkModel.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).lean()

    if (!chunk) {
      return NextResponse.json(
        { success: false, error: "Chunk not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, chunk })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update chunk" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const chunk = await ChunkModel.findByIdAndDelete(id)
    if (!chunk) {
      return NextResponse.json(
        { success: false, error: "Chunk not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete chunk" },
      { status: 500 }
    )
  }
}
