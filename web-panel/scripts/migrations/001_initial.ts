/**
 * Migration 001: Initial setup - Create indexes
 * Runs: On first database setup
 */

import type { MigrationDatabase } from "./types"

export const name = "001_initial"
export const description = "Create indexes on chunks, extracteddatas, and apitokens collections"

export async function up(db: MigrationDatabase): Promise<void> {
  // Create indexes for chunks collection
  const chunks = db.collection("chunks")
  await chunks.createIndex({ source: 1 })
  await chunks.createIndex({ status: 1 })
  await chunks.createIndex({ source: 1, status: 1 })
  await chunks.createIndex({ createdAt: -1 })
  console.log("✓ Created indexes on chunks collection")

  // Create indexes for extracteddata collection
  const extractedData = db.collection("extracteddatas")
  await extractedData.createIndex({ chunkId: 1 })
  await extractedData.createIndex({ cropName: 1 })
  await extractedData.createIndex({ category: 1 })
  await extractedData.createIndex({ createdAt: -1 })
  console.log("✓ Created indexes on extracteddatas collection")

  // Create indexes for apitokens collection
  const apiTokens = db.collection("apitokens")
  await apiTokens.createIndex({ provider: 1 })
  await apiTokens.createIndex({ isActive: 1 })
  console.log("✓ Created indexes on apitokens collection")
}

export async function down(db: MigrationDatabase): Promise<void> {
  // For rollback: drop indexes
  const chunks = db.collection("chunks")
  await chunks.dropIndex("source_1")
  await chunks.dropIndex("status_1")
  await chunks.dropIndex("source_1_status_1")
  await chunks.dropIndex("createdAt_-1")

  const extractedData = db.collection("extracteddatas")
  await extractedData.dropIndex("chunkId_1")
  await extractedData.dropIndex("cropName_1")
  await extractedData.dropIndex("category_1")
  await extractedData.dropIndex("createdAt_-1")

  const apiTokens = db.collection("apitokens")
  await apiTokens.dropIndex("provider_1")
  await apiTokens.dropIndex("isActive_1")

  console.log("✓ Rolled back migration 001")
}
