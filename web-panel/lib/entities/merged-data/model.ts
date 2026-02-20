/**
 * Merged Data Entity - MongoDB Model
 *
 * Mongoose schema and model for the MergedData collection.
 * Layer 2: Production-ready validated and merged crop data for chatbot consumption.
 */

import mongoose, { Schema } from "mongoose"
import type { IMergedData } from "./types"

const NutrientSchema = new Schema(
  { rate: String, timing: String, notes: String },
  { _id: false }
)

const MergedDataSchema = new Schema<IMergedData>(
  {
    // Core crop information (cropName is required)
    cropName: {
      type: String,
      required: true,
      index: true,
      description: "Crop name (required for merged data)",
    },
    scientificName: {
      type: String,
      default: null,
    },
    category: {
      type: String,
      default: "other",
      index: true,
      description: "Crop category (cereal|vegetable|fruit|legume|oilseed|tuber|other)",
    },

    // Variety management
    varieties: {
      type: [String],
      default: [],
      description: "Array of variety names for this parent crop",
    },
    alternativeNames: {
      type: [String],
      default: [],
      description: "Alternative names (regional, local, multilingual)",
    },
    parentCrop: {
      type: Schema.Types.ObjectId,
      ref: "MergedData",
      default: null,
      index: true,
      description: "Reference to parent crop if this is a variety",
    },
    isVariety: {
      type: Boolean,
      default: false,
      index: true,
      description: "Flag indicating if this is a variety record",
    },
    varietyType: {
      type: String,
      default: null,
      description: "Type/classification of variety (e.g., 'Wetland', 'Upland')",
    },

    // Agricultural data (same structure as ExtractedData)
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

    // Merge tracking
    sourceDocuments: {
      type: [Schema.Types.ObjectId],
      ref: "ExtractedData",
      default: [],
      description: "References to source extracteddatas documents",
    },
    mergedFrom: {
      type: [String],
      default: [],
      description: "Original crop names that were merged together",
    },
    validatedBy: {
      type: String,
      required: true,
      description: "Username of user who validated this data",
    },
    validatedAt: {
      type: Date,
      default: Date.now,
      index: true,
      description: "Timestamp when data was validated and merged",
    },
  },
  {
    timestamps: true,
    collection: "mergeddata",
  }
)

// ============= INDEXES =============
MergedDataSchema.index({ cropName: 1 })
MergedDataSchema.index({ category: 1 })
MergedDataSchema.index({ isVariety: 1 })
MergedDataSchema.index({ parentCrop: 1 })
MergedDataSchema.index({ validatedAt: -1 })
MergedDataSchema.index({ validatedBy: 1 })
MergedDataSchema.index({ createdAt: -1 })

// ============= METHODS =============

/**
 * Instance method: Check if this is a parent crop with varieties
 */
MergedDataSchema.methods.hasVarieties = function () {
  return !this.isVariety && this.varieties && this.varieties.length > 0
}

/**
 * Instance method: Get all variety records for this parent crop
 */
MergedDataSchema.methods.getVarieties = async function () {
  if (!this.hasVarieties()) {
    return []
  }
  return await MergedDataModel.find({ parentCrop: this._id })
}

/**
 * Static method: Get by crop name
 */
MergedDataSchema.statics.getByCropName = function (cropName: string) {
  return this.find({ cropName })
}

/**
 * Static method: Get parent crops only (not varieties)
 */
MergedDataSchema.statics.getParentCrops = function () {
  return this.find({
    $or: [{ isVariety: { $exists: false } }, { isVariety: false }],
  })
}

/**
 * Static method: Get varieties of a parent crop
 */
MergedDataSchema.statics.getVarietiesOf = function (parentCropId: string) {
  return this.find({ parentCrop: parentCropId, isVariety: true })
}

/**
 * Static method: Get by category
 */
MergedDataSchema.statics.getByCategory = function (category: string) {
  return this.find({ category })
}

/**
 * Static method: Get crops validated by user
 */
MergedDataSchema.statics.getByValidator = function (username: string) {
  return this.find({ validatedBy: username })
}

// ============= EXPORT =============

export const MergedDataModel =
  mongoose.models.MergedData ||
  mongoose.model<IMergedData>("MergedData", MergedDataSchema)
