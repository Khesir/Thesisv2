# Migration Guide & Data Modification Cases

## Overview

Versioned migrations are now set up with automatic tracking. Migrations live in `scripts/migrations/` and are numbered (001, 002, etc) to ensure proper order.

**Commands:**
```bash
npm run db:migrate          # Run all pending migrations (up)
npm run db:migrate:down     # Rollback last migration batch
npm run db:seed             # Seed database with sample data
```

---

## Three Cases Explained

### CASE 1: Add New Field to Model (Schema-Only)

**No migration script needed!** ✅

**What you do:**
1. Update the TypeScript interface and Mongoose schema:
```typescript
// web-panel/lib/db/models/chunk.model.ts
export interface IChunk extends Document {
  source: string
  chunkIndex: number
  content: string
  tokenCount: number
  status: ChunkStatus
  processedDataId: mongoose.Types.ObjectId | null
  languageDetected?: string  // ← NEW FIELD
  createdAt: Date
  updatedAt: Date
}

const ChunkSchema = new Schema<IChunk>({
  // ... existing fields ...
  languageDetected: { type: String, required: false }  // ← ADD HERE
}, { timestamps: true })
```

**What happens:**
- ✅ New documents created after this change will have the field
- ✅ Old documents work fine (field is optional, will be `undefined` if missing)
- ✅ Queries work either way
- **No database migration required**

**Use case:** Optional fields, deprecated fields being phased out, or fields that have sensible defaults

---

### CASE 2: Add Field with Default Values to All Existing Documents

**Requires a migration script!** 📝

**Problem:** You want all existing documents to have a value for a new field, not just `undefined`

**What you do:**
1. Create a migration file: `scripts/migrations/002_add_language_field.ts`

```typescript
export const name = "002_add_language_field"
export const description = "Add languageDetected field to all chunks"

export async function up(db: any) {
  const chunks = db.collection("chunks")

  const result = await chunks.updateMany(
    { languageDetected: { $exists: false } },  // Only update docs missing field
    { $set: { languageDetected: "en" } }       // Set default value
  )

  console.log(`✓ Added languageDetected to ${result.modifiedCount} chunks`)
}
```

2. Run the migration:
```bash
npm run db:migrate
```

**What happens:**
- ✅ Migration runner reads migration files in order
- ✅ Tracks which migrations have run (in `migrations` collection)
- ✅ Only runs pending migrations (safety against duplicates)
- ✅ All old documents now have the field with your default value
- ✅ Can rollback with `npm run db:migrate:down`

**Use case:** Adding required fields, setting up initial data for existing records

---

### CASE 3: Update Selected/Specific Documents (Ad-hoc)

**No migration script needed!** ✅ (But you could write one if it's a one-time data cleanup)

**Direct in your API/code:**
```typescript
// Example: API route to update specific chunks
export async function PATCH(req: Request) {
  const { chunkIds, languageDetected } = await req.json()

  const result = await ChunkModel.updateMany(
    { _id: { $in: chunkIds } },  // Update only these documents
    { $set: { languageDetected } }
  )

  return Response.json({ modified: result.modifiedCount })
}
```

**OR one-off MongoDB query:**
```javascript
// In mongo-express or mongosh
db.chunks.updateMany(
  { _id: ObjectId("..."), _id: ObjectId("...") },  // Specific docs
  { $set: { languageDetected: "fr" } }
)
```

**What happens:**
- ✅ Direct update, no migration needed
- ✅ No tracking, no batches
- ✅ Great for user actions, corrections, bulk edits

**Use case:** Users editing data through the UI, one-off corrections, selective updates

---

## Quick Reference

| Scenario | Requires Migration? | How to Execute |
|----------|-------------------|-----------------|
| Add optional field to schema | ❌ No | Edit `.model.ts` file |
| Add field + populate all docs with default | ✅ Yes | Create `XXX_migration.ts` + `npm run db:migrate` |
| Update specific documents (UI action) | ❌ No | API route / direct query |
| Rename field in all documents | ✅ Yes | Create migration with `$rename` operator |
| Delete field from all documents | ✅ Yes | Create migration with `$unset` operator |
| Complex data transformation | ✅ Yes | Create migration with `$merge` or update pipeline |

---

## Creating New Migrations

Template:
```typescript
// scripts/migrations/003_your_migration.ts
export const name = "003_your_migration"
export const description = "What this migration does"

export async function up(db: any) {
  const collection = db.collection("your_collection")

  // Make changes
  const result = await collection.updateMany(
    { /* query */ },
    { /* update */ }
  )

  console.log(`✓ Migration completed: ${result.modifiedCount} documents updated`)
}

export async function down(db: any) {
  // Undo the changes (optional but recommended)
  const collection = db.collection("your_collection")
  const result = await collection.updateMany(
    { /* query */ },
    { /* reverse update */ }
  )

  console.log(`✓ Rollback completed: ${result.modifiedCount} documents updated`)
}
```

---

## Advanced Tips

**Batch large updates:**
```typescript
const batchSize = 1000
const total = await collection.countDocuments({ /* query */ })

for (let i = 0; i < total; i += batchSize) {
  await collection.updateMany(
    { /* query */ },
    { /* update */ },
    { skip: i, limit: batchSize }
  )
  console.log(`Processed ${Math.min(i + batchSize, total)}/${total}`)
}
```

**Complex transformations:**
```typescript
// Use aggregation pipeline in updateMany
await collection.updateMany(
  { status: "pending" },
  [
    { $set: {
      newField: { $concat: ["$firstName", " ", "$lastName"] }
    }}
  ]
)
```

---

## Migration File Template

Use this template when creating new migrations. **All parameters are properly typed** - no `any` types!

```typescript
// scripts/migrations/XXX_description.ts
/**
 * Migration XXX: Brief description
 * Changes: What data/schema changes are made
 * Rollback: What the down() method does
 */

import type { MigrationDatabase } from "./types"

export const name = "XXX_migration_name"
export const description = "Detailed description of what this migration does"

export async function up(db: MigrationDatabase): Promise<void> {
  const collection = db.collection("collection_name")

  // Example patterns:

  // 1. Add field with default to all documents
  const result1 = await collection.updateMany(
    { fieldName: { $exists: false } },
    { $set: { fieldName: "default_value" } }
  )
  console.log(`✓ Updated ${result1.modifiedCount} documents`)

  // 2. Rename field
  const result2 = await collection.updateMany(
    { oldField: { $exists: true } },
    { $rename: { oldField: "newField" } }
  )
  console.log(`✓ Renamed field in ${result2.modifiedCount} documents`)

  // 3. Delete field
  const result3 = await collection.updateMany(
    { fieldToRemove: { $exists: true } },
    { $unset: { fieldToRemove: "" } }
  )
  console.log(`✓ Removed field from ${result3.modifiedCount} documents`)

  // 4. Complex transformation with aggregation
  const result4 = await collection.updateMany(
    { status: "old" },
    [
      {
        $set: {
          status: "new",
          transformedField: { $concat: ["$first", "-", "$second"] },
        },
      },
    ]
  )
  console.log(`✓ Transformed ${result4.modifiedCount} documents`)
}

export async function down(db: MigrationDatabase): Promise<void> {
  const collection = db.collection("collection_name")

  // Reverse the changes made in up()
  const result = await collection.updateMany(
    { /* query */ },
    { /* reverse operation */ }
  )

  console.log(`✓ Rollback completed: ${result.modifiedCount} documents updated`)
}
```

### Key Points:
- ✅ Import `MigrationDatabase` type from `./types`
- ✅ All functions are `async` and return `Promise<void>`
- ✅ Parameter `db` is properly typed as `MigrationDatabase`, not `any`
- ✅ Collection methods are fully typed by MongoDB drivers

---

## Safety Features

- ✅ Migrations tracked by name (can't run twice)
- ✅ Grouped by batch (rollback entire batch at once)
- ✅ Can rollback with `npm run db:migrate:down`
- ✅ Order enforced (001 → 002 → 003...)
- ✅ Both `up()` and `down()` methods supported
