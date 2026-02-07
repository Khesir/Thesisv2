export type ChunkStatus = "not-processed" | "processing" | "requires-validation" | "processed"

export interface Chunk {
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
