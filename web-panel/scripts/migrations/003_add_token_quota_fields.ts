/**
 * Migration 003: Add quotaLimit and cooldownMinutes to API tokens
 * Adds daily quota tracking and rate limit cooldown configuration fields.
 */

import type { MigrationDatabase } from "./types"

export const name = "003_add_token_quota_fields"
export const description = "Add quotaLimit and cooldownMinutes fields to API tokens"

export async function up(db: MigrationDatabase): Promise<void> {
  const tokens = db.collection("apitokens")

  const result = await tokens.updateMany(
    { quotaLimit: { $exists: false } },
    { $set: { quotaLimit: null, cooldownMinutes: 60 } }
  )

  console.log(
    `✓ Added quotaLimit and cooldownMinutes to ${result.modifiedCount} tokens`
  )
}

export async function down(db: MigrationDatabase): Promise<void> {
  const tokens = db.collection("apitokens")
  const result = await tokens.updateMany(
    { quotaLimit: { $exists: true } },
    { $unset: { quotaLimit: "", cooldownMinutes: "" } }
  )
  console.log(`✓ Removed quotaLimit and cooldownMinutes from ${result.modifiedCount} tokens`)
}
