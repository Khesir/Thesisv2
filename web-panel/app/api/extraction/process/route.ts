import { NextRequest, NextResponse } from "next/server"
import { extractChunk } from "@/services/ebr-extractor"
import { connectDB } from "@/lib/db/connection"
import { ChunkModel } from "@/lib/entities/chunk"
import { ExtractedDataModel } from "@/lib/entities/extracted-data"
import { logger } from "@/lib/logger"

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  logger.debug('ExtractionAPI', `[${requestId}] Request received`)

  try {
    await connectDB()
    const body = await req.json()
    const { chunkId, content, provider, apiKey, strategy } = body

    logger.debug('ExtractionAPI', `[${requestId}] Request parsed`, {
      hasChunkId: !!chunkId,
      contentLength: content?.length || 0,
      provider,
      strategy,
    })

    if (!content) {
      logger.warn('ExtractionAPI', `[${requestId}] No content provided`)
      return NextResponse.json({ success: false, error: "No content provided" }, { status: 400 })
    }

    // Mark chunk as processing
    if (chunkId) {
      logger.debug('ExtractionAPI', `[${requestId}] Marking chunk as processing`, { chunkId })
      await ChunkModel.findByIdAndUpdate(chunkId, { status: "processing" })
    }

    logger.debug('ExtractionAPI', `[${requestId}] Starting extraction`, {
      provider: provider || "auto",
      strategy: strategy || "failover",
    })

    const result = await extractChunk(
      content,
      provider || "auto",
      apiKey,
      undefined,
      strategy || "failover"
    )

    if (result.success && result.data) {
      logger.info('ExtractionAPI', `[${requestId}] Extraction successful`, {
        chunkId,
        provider: result.data.provider,
        tokensUsed: (result.data.usage as any)?.input_tokens + (result.data.usage as any)?.output_tokens,
      })

      // Save extracted data to DB if we have a chunkId
      if (chunkId && result.data.data) {
        logger.debug('ExtractionAPI', `[${requestId}] Saving extracted data`)
        const extractedData = await ExtractedDataModel.create({
          chunkId,
          ...(result.data.data as Record<string, unknown>),
          rawResponse: result.data.data,
        })

        // Update chunk status
        logger.debug('ExtractionAPI', `[${requestId}] Updating chunk status to requires-validation`)
        await ChunkModel.findByIdAndUpdate(chunkId, {
          status: "requires-validation",
          processedDataId: extractedData._id,
        })
      }

      return NextResponse.json({
        success: true,
        data: result.data.data,
        usage: result.data.usage,
        provider: result.data.provider,
      })
    }

    // Extraction failed - reset chunk status
    logger.error('ExtractionAPI', `[${requestId}] Extraction failed`, {
      chunkId,
      error: result.error,
    })

    if (chunkId) {
      logger.debug('ExtractionAPI', `[${requestId}] Resetting chunk status to not-processed`)
      await ChunkModel.findByIdAndUpdate(chunkId, { status: "not-processed" })
    }

    return NextResponse.json({
      success: false,
      error: result.error || "Extraction failed",
      requestId,
    }, { status: 500 })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"

    logger.error('ExtractionAPI', `[${requestId}] Unexpected error`, {
      error: errorMsg,
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
    })

    return NextResponse.json({
      success: false,
      error: errorMsg,
      requestId,
    }, { status: 500 })
  }
}
