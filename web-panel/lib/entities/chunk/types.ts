/**
 * Chunk Entity - Types Definition
 *
 * This file defines all TypeScript types and interfaces for the Chunk entity.
 * Update these types when adding new fields to chunks.
 */

// ============= TYPE DEFINITIONS =============

export type ChunkStatus = "not-processed" | "processing" | "requires-validation" | "processed"

/**
 * Input type: Used when creating/updating chunks from API
 * (Only includes user-provided fields)
 */
export interface CreateChunkInput {
  source: string
  chunkIndex: number
  content: string
  tokenCount: number
}

/**
 * Update type: Used when updating chunks
 * (All fields optional except _id)
 */
export interface UpdateChunkInput {
  source?: string
  chunkIndex?: number
  content?: string
  tokenCount?: number
  status?: ChunkStatus
  processedDataId?: string | null
}

/**
 * Database type: Complete document as stored in MongoDB
 * (Includes system fields like _id, createdAt, updatedAt)
 */
export interface IChunk {
  _id: string
  source: string
  chunkIndex: number
  content: string
  tokenCount: number
  status: ChunkStatus
  processedDataId: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * API Response type: What the client receives from API
 * (ISO strings for dates, serializable types)
 */
export interface ChunkResponse {
  _id: string
  source: string
  chunkIndex: number
  content: string
  tokenCount: number
  status: ChunkStatus
  processedDataId: string | null
  createdAt: string
  updatedAt: string
}

// ============= CONSTANTS =============

export const CHUNK_STATUSES = ["not-processed", "processing", "requires-validation", "processed"] as const

export const CHUNK_STATUS_LABELS: Record<ChunkStatus, string> = {
  "not-processed": "Not Processed",
  "processing": "Processing",
  "requires-validation": "Requires Validation",
  "processed": "Processed",
}

export const CHUNK_STATUS_COLORS: Record<ChunkStatus, string> = {
  "not-processed": "gray",
  "processing": "blue",
  "requires-validation": "yellow",
  "processed": "green",
}
