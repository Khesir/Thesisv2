/**
 * Migration 006: Normalize pestsDiseases and regionalData to Mixed arrays
 *
 * The Mongoose schema for ExtractedData previously defined pestsDiseases and
 * regionalData as strict subdocument arrays. LLMs occasionally return these
 * fields as raw strings or arrays containing stringified data, which caused
 * Mongoose cast errors on save.
 *
 * This migration:
 *   up   - Walks existing documents and normalises any string elements inside
 *          pestsDiseases and regionalData into proper objects where possible,
 *          and removes elements that cannot be parsed (saving them in rawResponse
 *          so no data is permanently lost).
 *   down - No-op: Mixed arrays are backwards-compatible; the old strict schema
 *          will simply reject malformed documents that already exist.
 */

import type { MigrationDatabase } from "./types"

function tryParseObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // not valid JSON — drop it (was LLM-hallucinated Python code)
    }
  }
  return null
}

function normaliseObjectArray(raw: unknown): {
  cleaned: Record<string, unknown>[]
  dropped: unknown[]
} {
  const cleaned: Record<string, unknown>[] = []
  const dropped: unknown[] = []

  if (!raw) return { cleaned, dropped }

  const items: unknown[] = Array.isArray(raw) ? raw : [raw]

  for (const item of items) {
    // Item might itself be a stringified array (the LLM hallucination case)
    if (typeof item === "string") {
      try {
        const parsed = JSON.parse(item)
        if (Array.isArray(parsed)) {
          for (const inner of parsed) {
            const obj = tryParseObject(inner)
            if (obj) cleaned.push(obj)
            else dropped.push(inner)
          }
          continue
        }
        const obj = tryParseObject(parsed)
        if (obj) cleaned.push(obj)
        else dropped.push(item)
      } catch {
        dropped.push(item)
      }
      continue
    }

    const obj = tryParseObject(item)
    if (obj) cleaned.push(obj)
    else dropped.push(item)
  }

  return { cleaned, dropped }
}

export const name = "006_extracteddata_mixed_arrays"
export const description =
  "Normalise pestsDiseases and regionalData in extracteddatas — convert any LLM-generated string elements into proper objects and drop unparseable values"

export async function up(db: MigrationDatabase): Promise<void> {
  const col = db.collection("extracteddatas")

  // Only target documents that have at least one string element in either field
  const cursor = col.find({
    $or: [
      { "pestsDiseases": { $elemMatch: { $type: "string" } } },
      { "regionalData":  { $elemMatch: { $type: "string" } } },
    ],
  })

  let updated = 0
  let skipped = 0

  for await (const doc of cursor) {
    const { cleaned: cleanedPests, dropped: droppedPests } =
      normaliseObjectArray(doc.pestsDiseases)
    const { cleaned: cleanedRegional, dropped: droppedRegional } =
      normaliseObjectArray(doc.regionalData)

    // Preserve any dropped (unparseable) data in rawResponse so nothing is lost
    const droppedData: Record<string, unknown> = {}
    if (droppedPests.length)    droppedData.pestsDiseases_raw    = droppedPests
    if (droppedRegional.length) droppedData.regionalData_raw = droppedRegional

    const rawResponse = {
      ...(typeof doc.rawResponse === "object" && doc.rawResponse ? doc.rawResponse : {}),
      ...droppedData,
    }

    try {
      await col.updateOne(
        { _id: doc._id },
        {
          $set: {
            pestsDiseases: cleanedPests,
            regionalData:  cleanedRegional,
            rawResponse,
          },
        }
      )
      updated++
    } catch (err) {
      console.warn(`⚠ Could not update document ${doc._id}: ${err}`)
      skipped++
    }
  }

  console.log(`✓ Normalised ${updated} extracteddata documents (${skipped} skipped)`)
}

export async function down(_db: MigrationDatabase): Promise<void> {
  // No-op: reverting to the strict schema would require every document to already
  // have correctly-typed elements, which cannot be guaranteed.
  console.log("⚠ Migration 006 down is a no-op — Mixed arrays are backwards-compatible")
}
