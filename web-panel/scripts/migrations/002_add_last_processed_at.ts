/**
 * Migration 002: Add lastProcessedAt field to chunks
 * Runs: When you want to track when each chunk was last processed
 *
 * CASE 2 EXAMPLE: Adding default values to all existing documents
 */

import type { MigrationDatabase } from "./types"

export const name = "002_add_last_processed_at"
export const description = "Add lastProcessedAt timestamp field to all chunks with current date as default"

export async function up(db: MigrationDatabase): Promise<void> {
  const chunks = db.collection("chunks")

  // CASE 2: Update all existing documents with a default value
  // The schema update is separate (you update chunk.model.ts)
  // This script makes sure old documents have the field too
  const result = await chunks.updateMany(
    { lastProcessedAt: { $exists: false } }, // Only update docs missing this field
    { $set: { lastProcessedAt: new Date() } }
  )

  console.log(
    `✓ Added lastProcessedAt to ${result.modifiedCount} chunks (default: now)`
  )
}

export async function down(db: MigrationDatabase): Promise<void> {
  const chunks = db.collection("chunks")
  const result = await chunks.updateMany(
    { lastProcessedAt: { $exists: true } },
    { $unset: { lastProcessedAt: "" } }
  )
  console.log(`✓ Removed lastProcessedAt from ${result.modifiedCount} chunks`)
}
