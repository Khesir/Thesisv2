/**
 * Merged Data Entity - Types Definition
 *
 * Layer 2: Production-ready, validated, and merged crop data
 * Created from validated extracteddatas after duplicate detection and merging
 */

import type { Schema } from "mongoose"

// ============= TYPE DEFINITIONS =============

/**
 * Input type: Used when creating merged data from API
 */
export interface CreateMergedDataInput {
  // Core crop information (required - reject if null)
  cropName: string
  scientificName?: string | null
  category?: string

  // Variety management
  varieties?: string[]
  alternativeNames?: string[]
  parentCrop?: string | null        // ObjectId reference to parent crop
  isVariety?: boolean
  varietyType?: string | null

  // Agricultural data
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
  pestsDiseases?: { name: string; type: string; treatment: string }[]
  yieldInfo?: {
    average: string
    range: string
    unit: string
  }
  regionalData?: { region: string; specific_info: string }[]
  recommendations?: string[]

  // Merge tracking
  sourceDocuments?: string[]        // ObjectId references to extracteddatas documents
  mergedFrom?: string[]             // Original crop names that were merged
  validatedBy: string               // Username of user who validated (required)
  validatedAt?: Date
}

/**
 * Update type: Used when updating merged data
 */
export interface UpdateMergedDataInput extends Partial<CreateMergedDataInput> {
  cropName?: string
}

/**
 * Database type: Complete document as stored in MongoDB
 */
export interface IMergedData {
  _id: Schema.Types.ObjectId

  // Core crop information
  cropName: string
  scientificName: string | null
  category: string

  // Variety management
  varieties: string[]
  alternativeNames: string[]
  parentCrop: Schema.Types.ObjectId | null
  isVariety: boolean
  varietyType: string | null

  // Agricultural data
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
  sourceDocuments: Schema.Types.ObjectId[]
  mergedFrom: string[]
  validatedBy: string
  validatedAt: Date

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

/**
 * API Response type: What the client receives from API
 */
export interface MergedDataResponse {
  _id: string
  cropName: string
  scientificName: string | null
  category: string
  varieties: string[]
  alternativeNames: string[]
  parentCrop: string | null
  isVariety: boolean
  varietyType: string | null
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
  sourceDocuments: string[]
  mergedFrom: string[]
  validatedBy: string
  validatedAt: string
  createdAt: string
  updatedAt: string
}
