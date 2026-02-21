/**
 * Validation Result Entity - Types Definition
 *
 * Stores per-field consistency (auto) and accuracy (human) metrics
 * for extracted crop data validation.
 */

export interface CreateValidationResultInput {
  extractedDataId: string
  chunkId: string
  cropName: string
  fieldConsistency: Record<string, boolean>
  fieldAccuracy: Record<string, boolean>
}

export interface IValidationResult {
  _id: string
  extractedDataId: string
  chunkId: string
  cropName: string
  fieldConsistency: Record<string, boolean>
  consistencyScore: number
  fieldAccuracy: Record<string, boolean>
  accuracyScore: number
  totalFields: number
  reviewedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface ValidationResultResponse {
  _id: string
  extractedDataId: string
  chunkId: string
  cropName: string
  fieldConsistency: Record<string, boolean>
  consistencyScore: number
  fieldAccuracy: Record<string, boolean>
  accuracyScore: number
  totalFields: number
  reviewedAt: string
  createdAt: string
  updatedAt: string
}
