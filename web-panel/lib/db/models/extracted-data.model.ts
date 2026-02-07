import mongoose, { Schema, Document } from "mongoose"

export interface IExtractedData extends Document {
  chunkId: mongoose.Types.ObjectId
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
  pestsDiseases: { name: string; type: string; treatment: string }[]
  yieldInfo: {
    average: string
    range: string
    unit: string
  }
  regionalData: { region: string; specific_info: string }[]
  recommendations: string[]
  rawResponse: Record<string, unknown>
  validatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const NutrientSchema = new Schema(
  { rate: String, timing: String, notes: String },
  { _id: false }
)

const ExtractedDataSchema = new Schema<IExtractedData>(
  {
    chunkId: { type: Schema.Types.ObjectId, ref: "Chunk", required: true },
    cropName: { type: String, required: true },
    scientificName: { type: String, default: null },
    category: { type: String, required: true },
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
  { timestamps: true }
)

ExtractedDataSchema.index({ chunkId: 1 })
ExtractedDataSchema.index({ cropName: 1 })
ExtractedDataSchema.index({ category: 1 })
ExtractedDataSchema.index({ createdAt: -1 })

export const ExtractedDataModel =
  mongoose.models.ExtractedData ||
  mongoose.model<IExtractedData>("ExtractedData", ExtractedDataSchema)
