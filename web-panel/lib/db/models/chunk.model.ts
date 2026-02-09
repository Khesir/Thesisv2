import mongoose, { Schema, Document } from "mongoose"
import type { ChunkStatus } from "@/lib/types/chunk"

export interface IChunk extends Document {
  source: string
  chunkIndex: number
  content: string
  tokenCount: number
  status: ChunkStatus
  processedDataId: mongoose.Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const ChunkSchema = new Schema<IChunk>(
  {
    source: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    content: { type: String, required: true },
    tokenCount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["not-processed", "processing", "requires-validation", "processed", "rejected"],
      default: "not-processed",
    },
    processedDataId: { type: Schema.Types.ObjectId, ref: "ExtractedData", default: null },
  },
  { timestamps: true }
)

ChunkSchema.index({ source: 1 })
ChunkSchema.index({ status: 1 })
ChunkSchema.index({ source: 1, status: 1 })
ChunkSchema.index({ createdAt: -1 })

export const ChunkModel =
  mongoose.models.Chunk || mongoose.model<IChunk>("Chunk", ChunkSchema)
