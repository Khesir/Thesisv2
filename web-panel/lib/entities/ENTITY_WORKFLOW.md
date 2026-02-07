# Entity-Based Development Workflow

## Overview

This guide explains the recommended workflow for adding new features or modifying existing entities in your system. An **entity** is a cohesive unit of data (like Chunk, ExtractedData, APIToken) that has a type definition, MongoDB model, and business logic.

## Directory Structure

```
web-panel/lib/entities/
├── chunk/
│   ├── types.ts       # Type definitions
│   ├── model.ts       # Mongoose model & schema
│   └── index.ts       # Public exports
├── extracted-data/
│   ├── types.ts
│   ├── model.ts
│   └── index.ts
└── api-token/
    ├── types.ts
    ├── model.ts
    └── index.ts
```

Each entity folder contains:
- **types.ts** - TypeScript interfaces and types
- **model.ts** - Mongoose schema and model
- **index.ts** - Barrel export for clean imports

---

## Typical Workflow

### Workflow 1: Add a New Field (No Default Value)

**Scenario:** You want to add an optional field like `languageDetected` to Chunk

**Steps:**

1. **Update types** - Define the field in types.ts
   ```typescript
   // lib/entities/chunk/types.ts
   export interface IChunk {
     // ... existing fields ...
     languageDetected?: string  // ← ADD HERE
   }

   export interface CreateChunkInput {
     // ... existing fields ...
     languageDetected?: string  // ← ADD HERE
   }

   export interface UpdateChunkInput {
     languageDetected?: string  // ← ADD HERE
   }
   ```

2. **Update model** - Add field to schema in model.ts
   ```typescript
   // lib/entities/chunk/model.ts
   const ChunkSchema = new Schema<IChunk>({
     // ... existing fields ...
     languageDetected: {
       type: String,
       required: false,
       description: "Detected language of chunk content"
     }
   })
   ```

3. **Done!** No migration needed. New documents will have it.

**When to use:** Optional fields, fields with null defaults, or fields that are set programmatically.

---

### Workflow 2: Add a Field + Populate Existing Documents

**Scenario:** You want `languageDetected` on ALL chunks, with a default value

**Steps:**

1. **Update types & model** (same as Workflow 1)

2. **Create migration** - Add a migration file to populate existing documents
   ```typescript
   // scripts/migrations/003_add_language_detected_to_chunks.ts
   export const name = "003_add_language_detected"
   export const description = "Add languageDetected field to all chunks"

   export async function up(db: any) {
     const result = await db.collection("chunks").updateMany(
       { languageDetected: { $exists: false } },
       { $set: { languageDetected: "auto" } }  // Default value
     )
     console.log(`✓ Updated ${result.modifiedCount} chunks`)
   }

   export async function down(db: any) {
     const result = await db.collection("chunks").updateMany(
       { languageDetected: { $exists: true } },
       { $unset: { languageDetected: "" } }
     )
     console.log(`✓ Rolled back from ${result.modifiedCount} chunks`)
   }
   ```

3. **Run migration**
   ```bash
   npm run db:migrate
   ```

**When to use:** Adding required or important fields that should have values on all documents.

---

### Workflow 3: Update Data in User Actions (CRUD Operations)

**Scenario:** User edits a chunk through the API

**Steps:**

1. **Create API route** - Handle the update request
   ```typescript
   // api/chunks/[id]/route.ts
   import { ChunkModel, type UpdateChunkInput } from "@/lib/entities/chunk"

   export async function PATCH(req: Request, { params }: { params: { id: string } }) {
     const { languageDetected } = await req.json() as UpdateChunkInput

     const updated = await ChunkModel.findByIdAndUpdate(
       params.id,
       { $set: { languageDetected } },
       { new: true }
     )

     return Response.json(updated)
   }
   ```

2. **Done!** No migration needed. Handler tracks which documents were updated.

**When to use:** User actions, UI updates, selective corrections, bulk edits triggered by users.

---

### Workflow 4: Delete a Field

**Scenario:** You no longer need the `languageDetected` field

**Steps:**

1. **Remove from types**
   ```typescript
   // lib/entities/chunk/types.ts - REMOVE languageDetected
   ```

2. **Remove from model**
   ```typescript
   // lib/entities/chunk/model.ts - REMOVE languageDetected field
   ```

3. **Create migration** (optional, but recommended)
   ```typescript
   // scripts/migrations/004_remove_language_detected.ts
   export async function up(db: any) {
     const result = await db.collection("chunks").updateMany(
       { languageDetected: { $exists: true } },
       { $unset: { languageDetected: "" } }
     )
     console.log(`✓ Removed languageDetected from ${result.modifiedCount} chunks`)
   }

   export async function down(db: any) {
     const result = await db.collection("chunks").updateMany(
       { languageDetected: { $exists: false } },
       { $set: { languageDetected: "auto" } }
     )
     console.log(`✓ Restored languageDetected to ${result.modifiedCount} chunks`)
   }
   ```

4. **Run migration**
   ```bash
   npm run db:migrate
   ```

**When to use:** Removal of deprecated fields to clean up schema and reduce data size.

---

### Workflow 5: Rename a Field

**Scenario:** Rename `languageDetected` → `detectedLanguage`

**Steps:**

1. **Update types**
   ```typescript
   export interface IChunk {
     detectedLanguage?: string  // ← NEW NAME
     // Remove: languageDetected
   }
   ```

2. **Update model**
   ```typescript
   const ChunkSchema = new Schema<IChunk>({
     detectedLanguage: { type: String, required: false }  // ← NEW NAME
   })
   ```

3. **Create migration**
   ```typescript
   // scripts/migrations/005_rename_language_field.ts
   export async function up(db: any) {
     const result = await db.collection("chunks").updateMany(
       { languageDetected: { $exists: true } },
       { $rename: { languageDetected: "detectedLanguage" } }
     )
     console.log(`✓ Renamed field in ${result.modifiedCount} chunks`)
   }

   export async function down(db: any) {
     const result = await db.collection("chunks").updateMany(
       { detectedLanguage: { $exists: true } },
       { $rename: { detectedLanguage: "languageDetected" } }
     )
     console.log(`✓ Renamed back in ${result.modifiedCount} chunks`)
   }
   ```

4. **Run migration**
   ```bash
   npm run db:migrate
   ```

**When to use:** Improving field naming for clarity or consistency.

---

## Clean Imports Example

Once entities are organized this way, imports become very clean:

```typescript
// ❌ OLD: Multiple imports from different places
import { Chunk } from "@/lib/types/chunk"
import { ChunkModel } from "@/lib/db/models/chunk.model"

// ✅ NEW: Single import, barrel export
import { ChunkModel, type IChunk, type CreateChunkInput } from "@/lib/entities/chunk"
```

---

## API Endpoint Pattern

```typescript
// api/chunks/[id]/route.ts
import { ChunkModel, type UpdateChunkInput, CHUNK_STATUS_LABELS } from "@/lib/entities/chunk"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const chunk = await ChunkModel.findById(params.id)
  return Response.json(chunk)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const input = await req.json() as UpdateChunkInput
  const chunk = await ChunkModel.findByIdAndUpdate(params.id, input, { new: true })
  return Response.json(chunk)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await ChunkModel.findByIdAndDelete(params.id)
  return Response.json({ success: true })
}
```

---

## Summary: When to Use Each Workflow

| Task | Workflow | Requires Migration? |
|------|----------|-------------------|
| Add optional field | 1 | ❌ No |
| Add field + set default on all docs | 2 | ✅ Yes |
| Update specific docs via API | 3 | ❌ No |
| Delete field from all docs | 4 | ✅ Yes |
| Rename field in all docs | 5 | ✅ Yes |

---

## Key Takeaway

**The pattern:**
1. **Type first** - Define what the data should look like
2. **Model second** - Implement the schema that stores it
3. **Migration third** - Only if you need to update existing data
4. **API fourth** - Build endpoints that use the type-safe model

This ensures type safety, consistency, and clean code organization.
