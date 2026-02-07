/**
 * Chunk Entity - MongoDB Model
 *
 * Mongoose schema and model for the Chunk collection.
 * Uses types from chunk/types.ts
 *
 * Migration tracking:
 * - 001_initial: Created indexes
 * - [Add future migrations here when schema changes]
 */

import mongoose, { Schema } from "mongoose"
import type { IChunk, ChunkStatus } from "./types"

const ChunkSchema = new Schema<IChunk>(
  {
    source: {
      type: String,
      required: true,
      description: "Source PDF filename",
    },
    chunkIndex: {
      type: Number,
      required: true,
      description: "Chunk number within the document (0-indexed)",
    },
    content: {
      type: String,
      required: true,
      description: "Text content of the chunk",
    },
    tokenCount: {
      type: Number,
      required: true,
      description: "Estimated token count for this chunk",
    },
    status: {
      type: String,
      enum: ["not-processed", "processing", "requires-validation", "processed"],
      default: "not-processed",
      description: "Current processing status of the chunk",
    },
    processedDataId: {
      type: Schema.Types.ObjectId,
      ref: "ExtractedData",
      default: null,
      description: "Reference to extracted data document (if processed)",
    },
  },
  {
    timestamps: true,
    collection: "chunks",
  }
)

// ============= INDEXES =============
// Migration: 001_initial creates these indexes
ChunkSchema.index({ source: 1 })
ChunkSchema.index({ status: 1 })
ChunkSchema.index({ source: 1, status: 1 })
ChunkSchema.index({ createdAt: -1 })

// ============= METHODS =============

/**
 * Instance method: Get chunk summary for display
 */
ChunkSchema.methods.getSummary = function () {
  return {
    _id: this._id,
    source: this.source,
    chunkIndex: this.chunkIndex,
    status: this.status,
    preview: this.content.substring(0, 100) + "...",
  }
}

/**
 * Static method: Get chunks by status
 */
ChunkSchema.statics.getByStatus = function (status: ChunkStatus) {
  return this.find({ status })
}

/**
 * Static method: Get chunks by source
 */
ChunkSchema.statics.getBySource = function (source: string) {
  return this.find({ source })
}

// ============= EXPORT =============

export const ChunkModel =
  mongoose.models.Chunk || mongoose.model<IChunk>("Chunk", ChunkSchema)
