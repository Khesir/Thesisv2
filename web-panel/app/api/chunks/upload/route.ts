import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir, unlink } from "fs/promises"
import path from "path"
import { extractText } from "@/services/pdf-processor"
import { createChunks } from "@/services/pdf-processor"
import { connectDB } from "@/lib/db/connection"
import { ChunkModel } from "@/lib/db/models/chunk.model"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const chunkSize = parseInt(formData.get("chunkSize") as string) || 1000

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 })
    }

    if (!file.name.endsWith(".pdf")) {
      return NextResponse.json({ success: false, error: "Only PDF files are supported" }, { status: 400 })
    }

    // Save to temp dir
    const tmpDir = path.join(process.cwd(), "tmp")
    await mkdir(tmpDir, { recursive: true })
    const tmpPath = path.join(tmpDir, `upload_${Date.now()}_${file.name}`)
    const bytes = await file.arrayBuffer()
    await writeFile(tmpPath, Buffer.from(bytes))

    try {
      // Extract text
      const extractResult = await extractText(tmpPath)
      if (!extractResult.success || !extractResult.data?.text) {
        return NextResponse.json({
          success: false,
          error: extractResult.data?.error || extractResult.error || "Failed to extract text",
          traceback: extractResult.traceback,
        }, { status: 500 })
      }

      // Create chunks
      const chunksResult = await createChunks(
        extractResult.data.text,
        chunkSize,
        file.name
      )
      if (!chunksResult.success || !chunksResult.data?.chunks) {
        return NextResponse.json({
          success: false,
          error: chunksResult.data?.error || chunksResult.error || "Failed to create chunks",
          traceback: chunksResult.traceback,
        }, { status: 500 })
      }

      // Save chunks to database
      await connectDB()
      const chunkDocs = chunksResult.data.chunks.map(
        (chunk: { content: string; tokenCount: number }, index: number) => ({
          source: file.name,
          chunkIndex: index,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          status: "not-processed",
        })
      )
      const savedChunks = await ChunkModel.insertMany(chunkDocs)

      return NextResponse.json({
        success: true,
        source: file.name,
        metadata: extractResult.data.metadata,
        chunks: savedChunks,
        totalChunks: savedChunks.length,
      })
    } finally {
      // Clean up temp file
      await unlink(tmpPath).catch(() => {})
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    }, { status: 500 })
  }
}
