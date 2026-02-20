/**
 * Migration 004: Create mergeddata collection
 *
 * Creates the production-ready merged crop data collection with proper indexes.
 * This collection stores validated, merged crop data for the RAG chatbot.
 *
 * Key features:
 * - Parent-child variety relationships
 * - Alternative name support (multilingual)
 * - Validation tracking (validatedBy, validatedAt)
 * - Source document tracing
 */

import type { MigrationDatabase } from "./types"

export const name = "004_create_mergeddata_collection"
export const description = "Create mergeddata collection with indexes for variety relationships and validation tracking"

export async function up(db: MigrationDatabase): Promise<void> {
  const mergedData = db.collection("mergeddata")

  console.log("Creating indexes for mergeddata collection...")

  // Index 1: cropName (text index for searching)
  await mergedData.createIndex(
    { cropName: 1 },
    { name: "idx_cropName" }
  )
  console.log("✓ Created index: idx_cropName")

  // Index 2: isVariety (for filtering parent crops vs varieties)
  await mergedData.createIndex(
    { isVariety: 1 },
    { name: "idx_isVariety" }
  )
  console.log("✓ Created index: idx_isVariety")

  // Index 3: parentCrop (for finding varieties of a parent)
  await mergedData.createIndex(
    { parentCrop: 1 },
    { name: "idx_parentCrop", sparse: true }
  )
  console.log("✓ Created index: idx_parentCrop")

  // Index 4: validatedAt (for querying validated data)
  await mergedData.createIndex(
    { validatedAt: -1 },
    { name: "idx_validatedAt" }
  )
  console.log("✓ Created index: idx_validatedAt")

  // Index 5: validatedBy (for tracking who validated)
  await mergedData.createIndex(
    { validatedBy: 1 },
    { name: "idx_validatedBy" }
  )
  console.log("✓ Created index: idx_validatedBy")

  // Index 6: Compound index for chatbot queries (parent crops only)
  await mergedData.createIndex(
    { isVariety: 1, cropName: 1 },
    { name: "idx_isVariety_cropName" }
  )
  console.log("✓ Created index: idx_isVariety_cropName")

  // Index 7: createdAt for sorting
  await mergedData.createIndex(
    { createdAt: -1 },
    { name: "idx_createdAt" }
  )
  console.log("✓ Created index: idx_createdAt")

  console.log("✓ mergeddata collection migration complete")
}

export async function down(db: MigrationDatabase): Promise<void> {
  const mergedData = db.collection("mergeddata")

  console.log("Dropping indexes from mergeddata collection...")

  const indexesToDrop = [
    "idx_cropName",
    "idx_isVariety",
    "idx_parentCrop",
    "idx_validatedAt",
    "idx_validatedBy",
    "idx_isVariety_cropName",
    "idx_createdAt"
  ]

  for (const indexName of indexesToDrop) {
    try {
      await mergedData.dropIndex(indexName)
      console.log(`✓ Dropped index: ${indexName}`)
    } catch (err) {
      // Index might not exist, that's okay
      console.log(`⚠ Could not drop index ${indexName} (might not exist)`)
    }
  }

  console.log("✓ mergeddata collection indexes removed")
  console.log("⚠ Note: Collection itself not dropped (contains production data)")
}
