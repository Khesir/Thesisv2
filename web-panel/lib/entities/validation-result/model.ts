/**
 * Validation Result Entity - MongoDB Model
 *
 * Stores per-field consistency and accuracy metrics for thesis reporting.
 */

import mongoose, { Schema } from "mongoose"
import type { IValidationResult } from "./types"

const ValidationResultSchema = new Schema<IValidationResult>(
  {
    extractedDataId: {
      type: String,
      ref: "ExtractedData",
      required: true,
    },
    chunkId: {
      type: String,
      ref: "Chunk",
      required: true,
    },
    cropName: {
      type: String,
      required: true,
    },
    fieldConsistency: {
      type: Schema.Types.Mixed,
      default: {},
    },
    consistencyScore: {
      type: Number,
      default: 0,
    },
    fieldAccuracy: {
      type: Schema.Types.Mixed,
      default: {},
    },
    accuracyScore: {
      type: Number,
      default: 0,
    },
    totalFields: {
      type: Number,
      default: 0,
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "validationresults",
  }
)

ValidationResultSchema.index({ extractedDataId: 1 }, { unique: true })
ValidationResultSchema.index({ chunkId: 1 })
ValidationResultSchema.index({ cropName: 1 })

export const ValidationResultModel =
  mongoose.models.ValidationResult ||
  mongoose.model<IValidationResult>("ValidationResult", ValidationResultSchema)
