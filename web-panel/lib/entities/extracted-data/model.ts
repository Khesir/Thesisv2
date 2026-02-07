/**
 * Extracted Data Entity - MongoDB Model
 *
 * Mongoose schema and model for the ExtractedData collection.
 * Uses types from extracted-data/types.ts
 */

import mongoose, { Schema } from "mongoose"
import type { IExtractedData } from "./types"

const NutrientSchema = new Schema(
  { rate: String, timing: String, notes: String },
  { _id: false }
)

const ExtractedDataSchema = new Schema<IExtractedData>(
  {
    chunkId: {
      type: String,
      ref: "Chunk",
      required: true,
    },
    cropName: {
      type: String,
      required: true,
    },
    scientificName: {
      type: String,
      default: null,
    },
    category: {
      type: String,
      required: true,
    },
    soilRequirements: {
      types: [String],
      ph_range: String,
      drainage: String,
    },
    climateRequirements: {
      temperature: String,
      rainfall: String,
      humidity: String,
      conditions: [String],
    },
    nutrients: {
      nitrogen: NutrientSchema,
      phosphorus: NutrientSchema,
      potassium: NutrientSchema,
      other_nutrients: [{ name: String, rate: String, notes: String }],
    },
    plantingInfo: {
      season: String,
      method: String,
      spacing: String,
      duration: String,
    },
    farmingPractices: [String],
    pestsDiseases: [{ name: String, type: String, treatment: String }],
    yieldInfo: {
      average: String,
      range: String,
      unit: String,
    },
    regionalData: [{ region: String, specific_info: String }],
    recommendations: [String],
    rawResponse: { type: Schema.Types.Mixed, default: {} },
    validatedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "extracteddatas",
  }
)

// ============= INDEXES =============
// Migration: 001_initial creates these indexes
ExtractedDataSchema.index({ chunkId: 1 })
ExtractedDataSchema.index({ cropName: 1 })
ExtractedDataSchema.index({ category: 1 })
ExtractedDataSchema.index({ createdAt: -1 })

// ============= METHODS =============

/**
 * Instance method: Check if data has been validated
 */
ExtractedDataSchema.methods.isValidated = function () {
  return this.validatedAt !== null
}

/**
 * Static method: Get by crop name
 */
ExtractedDataSchema.statics.getByCropName = function (cropName: string) {
  return this.find({ cropName })
}

/**
 * Static method: Get by category
 */
ExtractedDataSchema.statics.getByCategory = function (category: string) {
  return this.find({ category })
}

/**
 * Static method: Get unvalidated data
 */
ExtractedDataSchema.statics.getUnvalidated = function () {
  return this.find({ validatedAt: null })
}

// ============= EXPORT =============

export const ExtractedDataModel =
  mongoose.models.ExtractedData ||
  mongoose.model<IExtractedData>("ExtractedData", ExtractedDataSchema)
