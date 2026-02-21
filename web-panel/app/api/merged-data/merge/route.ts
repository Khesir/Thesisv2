import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { ExtractedDataModel } from "@/lib/entities/extracted-data"
import { MergedDataModel } from "@/lib/entities/merged-data"
import type { MergeCropsRequest, MergeCropsResponse } from "@/lib/types/merged-data"

/**
 * POST /api/merged-data/merge
 *
 * Creates merged data records from validated extracted data.
 * Handles both:
 * - Merging duplicates with variety relationships
 * - Creating individual records (no duplicates)
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body: MergeCropsRequest = await req.json()
    const { sourceDocumentIds, validatedBy, mergeDecision } = body

    // Validate request
    if (
      !sourceDocumentIds ||
      !Array.isArray(sourceDocumentIds) ||
      sourceDocumentIds.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "sourceDocumentIds is required and must be a non-empty array",
        },
        { status: 400 }
      )
    }

    if (!validatedBy || typeof validatedBy !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "validatedBy (username) is required",
        },
        { status: 400 }
      )
    }

    // Fetch source documents from extracteddatas
    const sourceDocuments = await ExtractedDataModel.find({
      _id: { $in: sourceDocumentIds },
    })

    if (sourceDocuments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No source documents found with provided IDs",
        },
        { status: 404 }
      )
    }

    // Validate prerequisites: validatedAt != null AND cropName != null
    const invalidDocs = sourceDocuments.filter(
      (doc) => !doc.validatedAt || !doc.cropName
    )

    if (invalidDocs.length > 0) {
      const invalidIds = invalidDocs.map((d) => d._id.toString())
      return NextResponse.json(
        {
          success: false,
          error: `The following documents are not validated or have null cropName: ${invalidIds.join(", ")}`,
          invalidDocuments: invalidIds,
        },
        { status: 400 }
      )
    }

    // Case 1: Single document (no duplicates) - create individual merged record
    if (sourceDocuments.length === 1) {
      const doc = sourceDocuments[0]

      const mergedData = await MergedDataModel.create({
        cropName: doc.cropName,
        scientificName: doc.scientificName,
        category: doc.category,
        varieties: [],
        alternativeNames: [],
        parentCrop: null,
        isVariety: false,
        varietyType: null,
        soilRequirements: doc.soilRequirements,
        climateRequirements: doc.climateRequirements,
        nutrients: doc.nutrients,
        plantingInfo: doc.plantingInfo,
        farmingPractices: doc.farmingPractices,
        pestsDiseases: doc.pestsDiseases,
        yieldInfo: doc.yieldInfo,
        regionalData: doc.regionalData,
        recommendations: doc.recommendations,
        sourceDocuments: [doc._id],
        mergedFrom: [doc.cropName],
        validatedBy,
        validatedAt: new Date(),
      })

      return NextResponse.json<MergeCropsResponse>({
        success: true,
        mergedCropId: mergedData._id.toString(),
        varietyIds: [],
        message: "Individual crop record created successfully",
      })
    }

    // Case 2: Multiple documents with merge decision
    if (!mergeDecision || !mergeDecision.cropName) {
      return NextResponse.json(
        {
          success: false,
          error: "mergeDecision with cropName is required for merging multiple documents",
        },
        { status: 400 }
      )
    }

    // Find parent document (shortest name or first document as fallback)
    const sortedDocs = [...sourceDocuments].sort(
      (a, b) => a.cropName.length - b.cropName.length
    )
    const parentDoc = sortedDocs[0]

    // Merge agricultural data from all source documents
    const mergedSoilTypes = new Set<string>()
    const mergedClimateConditions = new Set<string>()
    const mergedFarmingPractices = new Set<string>()
    const mergedRecommendations = new Set<string>()
    const mergedRegionalData: Array<{ region: string; specific_info: string }> = []

    let mergedSoilPH = parentDoc.soilRequirements?.ph_range
    let mergedSoilDrainage = parentDoc.soilRequirements?.drainage
    let mergedClimateTemp = parentDoc.climateRequirements?.temperature
    let mergedClimateRainfall = parentDoc.climateRequirements?.rainfall
    let mergedClimateHumidity = parentDoc.climateRequirements?.humidity

    for (const doc of sourceDocuments) {
      // Merge soil types
      if (doc.soilRequirements?.types) {
        doc.soilRequirements.types.forEach((type: string) => mergedSoilTypes.add(type))
      }

      // Merge climate conditions
      if (doc.climateRequirements?.conditions) {
        doc.climateRequirements.conditions.forEach((cond: string) =>
          mergedClimateConditions.add(cond)
        )
      }

      // Merge farming practices
      if (doc.farmingPractices) {
        doc.farmingPractices.forEach((practice: string) =>
          mergedFarmingPractices.add(practice)
        )
      }

      // Merge recommendations
      if (doc.recommendations) {
        doc.recommendations.forEach((rec: string) => mergedRecommendations.add(rec))
      }

      // Merge regional data
      if (doc.regionalData) {
        mergedRegionalData.push(...doc.regionalData)
      }

      // Take first non-null values for scalar fields
      if (!mergedSoilPH && doc.soilRequirements?.ph_range) {
        mergedSoilPH = doc.soilRequirements.ph_range
      }
      if (!mergedSoilDrainage && doc.soilRequirements?.drainage) {
        mergedSoilDrainage = doc.soilRequirements.drainage
      }
      if (!mergedClimateTemp && doc.climateRequirements?.temperature) {
        mergedClimateTemp = doc.climateRequirements.temperature
      }
      if (!mergedClimateRainfall && doc.climateRequirements?.rainfall) {
        mergedClimateRainfall = doc.climateRequirements.rainfall
      }
      if (!mergedClimateHumidity && doc.climateRequirements?.humidity) {
        mergedClimateHumidity = doc.climateRequirements.humidity
      }
    }

    // Create parent merged record
    const parentMergedData = await MergedDataModel.create({
      cropName: mergeDecision.cropName,
      scientificName: parentDoc.scientificName,
      category: parentDoc.category,
      varieties: mergeDecision.varieties.map((v) => v.name),
      alternativeNames: mergeDecision.alternativeNames || [],
      parentCrop: null,
      isVariety: false,
      varietyType: null,
      soilRequirements: {
        types: Array.from(mergedSoilTypes),
        ph_range: mergedSoilPH || "",
        drainage: mergedSoilDrainage || "",
      },
      climateRequirements: {
        temperature: mergedClimateTemp || "",
        rainfall: mergedClimateRainfall || "",
        humidity: mergedClimateHumidity || "",
        conditions: Array.from(mergedClimateConditions),
      },
      nutrients: parentDoc.nutrients,
      plantingInfo: parentDoc.plantingInfo,
      farmingPractices: Array.from(mergedFarmingPractices),
      pestsDiseases: parentDoc.pestsDiseases || [],
      yieldInfo: parentDoc.yieldInfo,
      regionalData: mergedRegionalData,
      recommendations: Array.from(mergedRecommendations),
      sourceDocuments: sourceDocuments.map((d) => d._id),
      mergedFrom: sourceDocuments.map((d) => d.cropName),
      validatedBy,
      validatedAt: new Date(),
    })

    // Create variety records
    const varietyIds: string[] = []

    for (const variety of mergeDecision.varieties) {
      // Find source document for this variety
      const varietySourceDoc = sourceDocuments.find(
        (d) => d._id.toString() === variety.sourceDocId
      )

      if (!varietySourceDoc) {
        console.warn(`Source document not found for variety: ${variety.name}`)
        continue
      }

      const varietyMergedData = await MergedDataModel.create({
        cropName: variety.name,
        scientificName: varietySourceDoc.scientificName,
        category: varietySourceDoc.category,
        varieties: [],
        alternativeNames: [],
        parentCrop: parentMergedData._id,
        isVariety: true,
        varietyType: variety.varietyType,
        soilRequirements: varietySourceDoc.soilRequirements,
        climateRequirements: varietySourceDoc.climateRequirements,
        nutrients: varietySourceDoc.nutrients,
        plantingInfo: varietySourceDoc.plantingInfo,
        farmingPractices: varietySourceDoc.farmingPractices || [],
        pestsDiseases: varietySourceDoc.pestsDiseases || [],
        yieldInfo: varietySourceDoc.yieldInfo,
        regionalData: varietySourceDoc.regionalData || [],
        recommendations: varietySourceDoc.recommendations || [],
        sourceDocuments: [varietySourceDoc._id],
        mergedFrom: [varietySourceDoc.cropName],
        validatedBy,
        validatedAt: new Date(),
      })

      varietyIds.push(varietyMergedData._id.toString())
    }

    return NextResponse.json<MergeCropsResponse>({
      success: true,
      mergedCropId: parentMergedData._id.toString(),
      varietyIds,
      message: `Merged ${sourceDocuments.length} documents into 1 parent crop with ${varietyIds.length} varieties`,
    })
  } catch (error) {
    console.error("Merge error:", error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json<MergeCropsResponse>(
      {
        success: false,
        mergedCropId: "",
        varietyIds: [],
        error: errorMsg || "An unexpected error occurred during merge",
      },
      { status: 500 }
    )
  }
}
