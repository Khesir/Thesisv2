/**
 * Migration 005: Create validationresults collection
 *
 * Creates indexes for the validationresults collection which stores
 * per-field consistency and accuracy metrics captured during validation.
 */

import type { MigrationDatabase } from "./types"

export const name = "005_create_validationresults_collection"
export const description = "Create validationresults collection with indexes for querying validation metrics"

export async function up(db: MigrationDatabase): Promise<void> {
  const col = db.collection("validationresults")

  console.log("Creating indexes for validationresults collection...")

  // Unique per accepted extraction
  await col.createIndex(
    { extractedDataId: 1 },
    { name: "idx_extractedDataId", unique: true }
  )
  console.log("✓ Created index: idx_extractedDataId")

  // For looking up by chunk
  await col.createIndex(
    { chunkId: 1 },
    { name: "idx_chunkId" }
  )
  console.log("✓ Created index: idx_chunkId")

  // For grouping/filtering by crop name
  await col.createIndex(
    { cropName: 1 },
    { name: "idx_cropName" }
  )
  console.log("✓ Created index: idx_cropName")

  // For sorting by review date
  await col.createIndex(
    { reviewedAt: -1 },
    { name: "idx_reviewedAt" }
  )
  console.log("✓ Created index: idx_reviewedAt")

  console.log("✓ validationresults collection migration complete")
}

export async function down(db: MigrationDatabase): Promise<void> {
  const col = db.collection("validationresults")

  console.log("Dropping indexes from validationresults collection...")

  const indexesToDrop = [
    "idx_extractedDataId",
    "idx_chunkId",
    "idx_cropName",
    "idx_reviewedAt",
  ]

  for (const indexName of indexesToDrop) {
    try {
      await col.dropIndex(indexName)
      console.log(`✓ Dropped index: ${indexName}`)
    } catch {
      console.log(`⚠ Could not drop index ${indexName} (might not exist)`)
    }
  }

  console.log("✓ validationresults indexes removed")
}
