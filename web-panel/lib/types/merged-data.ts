/**
 * Merged Data Type Definitions
 *
 * Layer 2: Production-ready, validated, and merged crop data
 * Created from validated extracteddatas after duplicate detection and merging
 */

export interface MergedData {
  _id: string

  // Core crop information (required - reject if null)
  cropName: string
  scientificName: string | null
  category: string

  // Variety management
  varieties: string[]               // Array of variety names (e.g., ["Wetland Rice", "Upland Rice"])
  alternativeNames: string[]        // Alternative names (e.g., ["Palay", "Bigas"] for Rice)
  parentCrop: string | null         // ObjectId reference to parent crop (if this is a variety)
  isVariety: boolean                // Flag indicating if this is a variety record
  varietyType: string | null        // Variety type/classification (e.g., "Wetland", "Upland")

  // Agricultural data (same structure as ExtractedData)
  soilRequirements: {
    types: string[]
    ph_range: string
    drainage: string
  }
  climateRequirements: {
    temperature: string
    rainfall: string
    humidity: string
    conditions: string[]
  }
  nutrients: {
    nitrogen: { rate: string; timing: string; notes: string }
    phosphorus: { rate: string; timing: string; notes: string }
    potassium: { rate: string; timing: string; notes: string }
    other_nutrients: { name: string; rate: string; notes: string }[]
  }
  plantingInfo: {
    season: string
    method: string
    spacing: string
    duration: string
  }
  farmingPractices: string[]
  pestsDiseases: { name: string; type: string; treatment: string }[]
  yieldInfo: {
    average: string
    range: string
    unit: string
  }
  regionalData: { region: string; specific_info: string }[]
  recommendations: string[]

  // Merge tracking
  sourceDocuments: string[]         // ObjectId references to extracteddatas documents
  mergedFrom: string[]              // Original crop names that were merged (e.g., ["Rice", "Wetland Rice"])
  validatedBy: string               // Username of user who validated this data
  validatedAt: Date | string        // Timestamp when validated

  // Timestamps
  createdAt: Date | string
  updatedAt: Date | string
}

/**
 * Request payload for merging crops
 */
export interface MergeCropsRequest {
  sourceDocumentIds: string[]       // Array of extracteddatas IDs to merge
  validatedBy: string               // Username of user performing merge
  mergeDecision: {
    cropName: string                // Base/parent crop name
    varieties: {
      name: string                  // Variety name (e.g., "Wetland Rice")
      sourceDocId: string           // Which source document contains this variety
      varietyType: string | null    // Extracted type (e.g., "Wetland")
    }[]
    alternativeNames: string[]      // Additional names for the crop
  }
}

/**
 * Response from merge operation
 */
export interface MergeCropsResponse {
  success: boolean
  mergedCropId: string              // Parent merged record ID
  varietyIds: string[]              // Variety merged record IDs
  message?: string
  error?: string
}

/**
 * Duplicate detection result
 */
export interface DuplicateGroup {
  baseCropName: string              // Normalized crop name
  documents: {
    id: string
    cropName: string
    isVariety: boolean
    varietyType: string | null
  }[]
  suggestedParent: string           // Suggested parent crop name
  suggestedVarieties: string[]      // Suggested variety names
}
