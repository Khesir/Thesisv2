/**
 * Extracted Data Entity - Types Definition
 *
 * This file defines all TypeScript types and interfaces for the ExtractedData entity.
 * Represents structured agricultural information extracted from crop documents.
 */

// ============= TYPE DEFINITIONS =============

/**
 * Input type: Used when creating extracted data from API
 */
export interface CreateExtractedDataInput {
  chunkId: string
  cropName?: string | null   // Optional - incomplete extractions may not have crop name
  scientificName?: string | null
  category?: string  // Defaults to "other" if not provided
  soilRequirements?: {
    types: string[]
    ph_range: string
    drainage: string
  }
  climateRequirements?: {
    temperature: string
    rainfall: string
    humidity: string
    conditions: string[]
  }
  nutrients?: {
    nitrogen: { rate: string; timing: string; notes: string }
    phosphorus: { rate: string; timing: string; notes: string }
    potassium: { rate: string; timing: string; notes: string }
    other_nutrients: { name: string; rate: string; notes: string }[]
  }
  plantingInfo?: {
    season: string
    method: string
    spacing: string
    duration: string
  }
  farmingPractices?: string[]
  /** Elements may be objects {name,type,treatment} or raw strings from LLM */
  pestsDiseases?: Array<{ name: string; type: string; treatment: string | null } | string>
  yieldInfo?: {
    average: string
    range: string
    unit: string
  }
  /** Elements may be objects {region,specific_info} or raw strings from LLM */
  regionalData?: Array<{ region: string; specific_info: string } | string>
  recommendations?: string[]
  rawResponse?: Record<string, unknown>
}

/**
 * Update type: Used when updating extracted data
 */
export interface UpdateExtractedDataInput extends Partial<CreateExtractedDataInput> {
  validatedAt?: Date | null
}

/**
 * Database type: Complete document as stored in MongoDB
 */
export interface IExtractedData {
  _id: string
  chunkId: string
  cropName: string | null  // Optional - incomplete data may lack crop name
  scientificName: string | null
  category: string  // Defaults to "other"
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
  pestsDiseases: Array<{ name: string; type: string; treatment: string | null } | string>
  yieldInfo: {
    average: string
    range: string
    unit: string
  }
  regionalData: Array<{ region: string; specific_info: string } | string>
  recommendations: string[]
  rawResponse: Record<string, unknown>
  validatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * API Response type: What the client receives from API
 */
export interface ExtractedDataResponse {
  _id: string
  chunkId: string
  cropName: string
  scientificName: string | null
  category: string
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
  pestsDiseases: Array<{ name: string; type: string; treatment: string | null } | string>
  yieldInfo: {
    average: string
    range: string
    unit: string
  }
  regionalData: Array<{ region: string; specific_info: string } | string>
  recommendations: string[]
  rawResponse: Record<string, unknown>
  validatedAt: string | null
  createdAt: string
  updatedAt: string
}

// ============= CONSTANTS =============

export const NUTRIENT_TYPES = ["nitrogen", "phosphorus", "potassium"] as const
