import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { ChunkModel } from "@/lib/entities/chunk"
import { ExtractedDataModel } from "@/lib/entities/extracted-data"
import { extractChunk } from "@/services/ebr-extractor"
import { logger } from "@/lib/logger"

/**
 * Transform LLM extraction output to database schema format.
 * LLM returns crops array, but database expects separate records per crop.
 * Handles incomplete data gracefully - saves potential data even with missing fields.
 */
function transformExtractionData(
  llmData: Record<string, any>,
  chunkId: string
): Record<string, any>[] {
  const crops = llmData.crops || []

  // If no crops found, create a single record with general agricultural info
  if (!Array.isArray(crops) || crops.length === 0) {
    return [{
      chunkId,
      cropName: null,  // No specific crop identified
      category: "other",
      scientificName: null,
      soilRequirements: llmData.soil_types ? { types: llmData.soil_types } : undefined,
      climateRequirements: llmData.climate_conditions || undefined,
      plantingInfo: llmData.growing_conditions || undefined,
      farmingPractices: llmData.farming_practices || [],
      pestsDiseases: llmData.pests_diseases || [],
      recommendations: llmData.recommendations || [],
      rawResponse: llmData,
    }]
  }

  // Create a document for each crop found
  return crops.map((crop: any, index: number) => {
    const cropName = crop.name || crop.common_name

    return {
      chunkId,
      cropName: cropName ? String(cropName).trim() || null : null,  // Use null if empty
      scientificName: crop.scientific_name ? String(crop.scientific_name).trim() : null,
      category: crop.category || "other",  // Default to "other" if not specified
      soilRequirements: llmData.soil_types ? { types: llmData.soil_types } : undefined,
      climateRequirements: llmData.climate_conditions || undefined,
      plantingInfo: llmData.growing_conditions || undefined,
      farmingPractices: llmData.farming_practices || [],
      pestsDiseases: llmData.pests_diseases || [],
      yieldInfo: llmData.yield_information || undefined,
      regionalData: llmData.regional_data ? [llmData.regional_data] : undefined,
      recommendations: llmData.recommendations || [],
      rawResponse: llmData,
    }
  })
}

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
      hasApiKey: !!apiKey,
    })

    if (!content) {
      logger.warn('ExtractionAPI', `[${requestId}] No content provided`)
      return NextResponse.json({ success: false, error: "No content provided" }, { status: 400 })
    }

    if (!apiKey) {
      logger.warn('ExtractionAPI', `[${requestId}] No API key provided`)
      return NextResponse.json(
        { success: false, error: "No API key provided. Please enter and test your token." },
        { status: 400 }
      )
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
        provider: result.data.provider || provider,
      })

      // Save extracted data to DB if we have a chunkId
      if (chunkId && result.data) {
        logger.debug('ExtractionAPI', `[${requestId}] Transforming and saving extracted data`)
        const transformedDocs = transformExtractionData(result.data as Record<string, any>, chunkId)

        try {
          const savedDocs = await ExtractedDataModel.insertMany(transformedDocs)
          logger.info('ExtractionAPI', `[${requestId}] Saved ${savedDocs.length} extracted records`, {
            chunkId,
            recordCount: savedDocs.length,
          })

          // Update chunk status
          logger.debug('ExtractionAPI', `[${requestId}] Updating chunk status to requires-validation`)
          await ChunkModel.findByIdAndUpdate(chunkId, {
            status: "requires-validation",
            processedDataId: savedDocs[0]._id, // Reference to first extracted record
          })
        } catch (saveError) {
          logger.error('ExtractionAPI', `[${requestId}] Failed to save extracted data`, {
            chunkId,
            error: saveError instanceof Error ? saveError.message : String(saveError),
          })
          // Reset chunk status on save failure
          await ChunkModel.findByIdAndUpdate(chunkId, { status: "not-processed" })
          return NextResponse.json(
            { success: false, error: "Failed to save extraction results" },
            { status: 500 }
          )
        }
      }

      return NextResponse.json({
        success: true,
        data: result.data,
        usage: result.data.usage || (result as any).usage,
        provider: result.data.provider || provider,
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
      traceback: result.traceback,
      requestId,
    }, { status: 500 })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const errorType = error instanceof Error ? error.constructor.name : typeof error

    logger.error('ExtractionAPI', `[${requestId}] Unexpected error`, {
      error: errorMsg,
      errorType,
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
    })

    return NextResponse.json({
      success: false,
      error: errorMsg || "An unexpected server error occurred",
      errorType,
      requestId,
    }, { status: 500 })
  }
}
