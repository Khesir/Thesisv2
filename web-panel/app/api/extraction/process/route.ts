import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { ChunkModel } from "@/lib/entities/chunk"
import { ExtractedDataModel } from "@/lib/entities/extracted-data"
import { extractChunk } from "@/services/ebr-extractor"
import { logger } from "@/lib/logger"

/**
 * Safely parse a value that may be a JSON-stringified array or already an array.
 * LLMs sometimes return array fields as raw JSON strings instead of parsed arrays.
 */
function parseArray(value: any): any[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/**
 * Parse an array whose elements should be objects (e.g. pestsDiseases, regionalData).
 * Handles cases where the LLM returns the entire list as a single string element,
 * or returns individual elements as JSON strings.
 * Non-parseable string elements are dropped rather than causing a cast error.
 */
function parseObjectArray(value: any): any[] {
  const arr = parseArray(value)
  const result: any[] = []
  for (const item of arr) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      result.push(item)
    } else if (typeof item === "string") {
      // The element itself is a string — could be JSON or a Python-style repr
      try {
        const parsed = JSON.parse(item)
        if (Array.isArray(parsed)) {
          // The string was actually the whole array (e.g. "[{...},{...}]")
          for (const inner of parsed) {
            if (inner && typeof inner === "object") result.push(inner)
          }
        } else if (parsed && typeof parsed === "object") {
          result.push(parsed)
        }
      } catch {
        // Unparseable string element — skip it to avoid a cast error
      }
    }
  }
  return result
}

/**
 * Transform LLM extraction output to database schema format.
 * LLM returns crops array, but database expects separate records per crop.
 * Creates one ExtractedData document per crop found.
 * Handles incomplete data gracefully - saves potential data even with missing fields.
 */
function transformExtractionData(
  llmData: Record<string, any>,
  chunkId: string
): Record<string, any>[] {
  // Unwrap nested data structure from Python script output
  // llmData is { success, data: { crops: [...] }, usage, provider }
  const inner = llmData.data || llmData
  const crops = inner.crops || llmData.crops || []

  // If no crops found, create a single record with general agricultural info
  if (!Array.isArray(crops) || crops.length === 0) {
    return [{
      chunkId,
      cropName: null,
      category: "other",
      scientificName: null,
      soilRequirements: inner.soil_types ? { types: parseArray(inner.soil_types) } : undefined,
      climateRequirements: inner.climate_conditions || undefined,
      plantingInfo: inner.growing_conditions || undefined,
      farmingPractices: parseArray(inner.farming_practices),
      pestsDiseases: parseObjectArray(inner.pests_diseases),
      recommendations: parseArray(inner.recommendations),
      rawResponse: llmData,
    }]
  }

  // Create a document for each crop found
  // Only store rawResponse on the first crop to avoid redundant copies
  return crops.map((crop: any, index: number) => {
    const cropName = crop.name || crop.common_name

    return {
      chunkId,
      cropName: cropName ? String(cropName).trim() || null : null,
      scientificName: crop.scientific_name ? String(crop.scientific_name).trim() : null,
      category: crop.category || "other",
      soilRequirements: crop.soil_requirements || undefined,
      climateRequirements: crop.climate_requirements || undefined,
      nutrients: crop.nutrients || undefined,
      plantingInfo: crop.planting_info || undefined,
      farmingPractices: parseArray(crop.farming_practices),
      pestsDiseases: parseObjectArray(crop.pests_diseases),
      yieldInfo: crop.yield_info || undefined,
      regionalData: parseObjectArray(crop.regional_data),
      recommendations: parseArray(crop.recommendations),
      rawResponse: index === 0 ? llmData : {},
    }
  })
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  logger.debug('ExtractionAPI', `[${requestId}] Request received`)

  try {
    await connectDB()
    const body = await req.json()
    const { chunkId, content, provider, apiKey, model, strategy } = body

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
      model || undefined,
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
