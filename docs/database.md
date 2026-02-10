# Database Reference

MongoDB is the primary data store, shared by the web panel (via Mongoose) and the chatbot (via PyMongo). The development setup uses Docker with the `mongo:7.0` image.

## Collections

### `chunks`

Stores text segments extracted from PDF documents.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | auto | — | Primary key |
| `source` | String | yes | — | PDF filename (e.g., `"FAO-Crop Soil Requirements.pdf"`) |
| `chunkIndex` | Number | yes | — | Position within source document |
| `content` | String | yes | — | Full text content of the chunk |
| `tokenCount` | Number | yes | — | Estimated token count (~chars/4) |
| `status` | String (enum) | no | `"not-processed"` | Processing status |
| `processedDataId` | ObjectId (ref) | no | `null` | Reference to ExtractedData |
| `createdAt` | Date | auto | — | Mongoose timestamp |
| `updatedAt` | Date | auto | — | Mongoose timestamp |

**Status values:** `not-processed`, `processing`, `requires-validation`, `processed`

**Indexes:**
- `{ source: 1 }`
- `{ status: 1 }`
- `{ source: 1, status: 1 }` (compound)
- `{ createdAt: -1 }`

---

### `extracteddatas`

Stores structured agricultural data extracted by LLMs from chunks.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | auto | — | Primary key |
| `chunkId` | String (ref) | yes | — | Reference to source Chunk |
| `cropName` | String | no | `null` | Crop name (null for incomplete extractions) |
| `scientificName` | String | no | `null` | Scientific/Latin name |
| `category` | String | no | `"other"` | Crop category |
| `soilRequirements` | Object | no | — | Soil types, pH range, drainage |
| `climateRequirements` | Object | no | — | Temperature, rainfall, humidity, conditions |
| `nutrients` | Object | no | — | NPK rates/timing + other nutrients |
| `plantingInfo` | Object | no | — | Season, method, spacing, duration |
| `farmingPractices` | [String] | no | `[]` | Farming practice recommendations |
| `pestsDiseases` | [Object] | no | `[]` | Name, type, treatment per pest |
| `yieldInfo` | Object | no | — | Average, range, unit |
| `regionalData` | [Object] | no | `[]` | Region-specific information |
| `recommendations` | [String] | no | `[]` | General recommendations |
| `rawResponse` | Mixed | no | `{}` | Raw LLM response for debugging |
| `validatedAt` | Date | no | `null` | When a user confirmed this data |
| `createdAt` | Date | auto | — | Mongoose timestamp |
| `updatedAt` | Date | auto | — | Mongoose timestamp |

**Category values:** `cereal`, `vegetable`, `fruit`, `legume`, `oilseed`, `tuber`, `other`

**Nested schemas:**

```
soilRequirements: { types: [String], ph_range: String, drainage: String }
climateRequirements: { temperature: String, rainfall: String, humidity: String, conditions: [String] }
nutrients.nitrogen/phosphorus/potassium: { rate: String, timing: String, notes: String }
nutrients.other_nutrients: [{ name: String, rate: String, notes: String }]
plantingInfo: { season: String, method: String, spacing: String, duration: String }
pestsDiseases: [{ name: String, type: String, treatment: String }]
yieldInfo: { average: String, range: String, unit: String }
regionalData: [{ region: String, specific_info: String }]
```

**Indexes:**
- `{ chunkId: 1 }`
- `{ cropName: 1 }`
- `{ category: 1 }`
- `{ createdAt: -1 }`

---

### `apitokens`

Stores LLM provider API credentials with usage tracking and rate limit management.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | auto | — | Primary key |
| `provider` | String (enum) | yes | — | LLM provider |
| `token` | String | yes | — | API key (stored plaintext) |
| `alias` | String | yes | — | User-friendly name |
| `usageCount` | Number | no | `0` | Total API requests made |
| `usageLimit` | Number | no | `null` | Max requests allowed (null = unlimited) |
| `quotaLimit` | Number | no | `null` | Provider daily quota limit (null = unlimited) |
| `cooldownMinutes` | Number | no | `60` | Cooldown minutes after rate limit hit |
| `isActive` | Boolean | no | `true` | Whether token is available for use |
| `lastUsedAt` | Date | no | `null` | Timestamp of last usage |
| `createdAt` | Date | auto | — | Mongoose timestamp |
| `updatedAt` | Date | auto | — | Mongoose timestamp |

**Provider values:** `anthropic`, `google`, `openai`

**Indexes:**
- `{ provider: 1 }`
- `{ isActive: 1 }`

> **Note:** Token values are stored as plaintext in MongoDB. In the API responses, tokens are masked (first 4 and last 4 characters only). The API response also includes enriched fields from the in-memory cooldown cache: `rateLimited`, `cooldownRemaining`, `cooldownTotal`, `quotaUsed`, `invalidKey`.

## Migration System

Migrations are run with:

```bash
cd web-panel
npm run db:migrate        # Run migrations
npm run db:migrate:down   # Reverse migrations
```

The migration script (`scripts/migrate.ts`) creates all indexes defined above on their respective collections. It uses inline Mongoose connection (no path alias dependencies) for compatibility with `tsx`.

The migration runner (`scripts/migration-runner.ts`) supports up/down operations.

## Seed Data

Seed the database with sample data:

```bash
cd web-panel
npm run db:seed
```

The seed script (`scripts/seed.ts`) populates the database with sample chunks and extracted data for development and testing.

## Connection Details

### Web Panel (Mongoose)

Connection is managed by `lib/db/connection.ts` with HMR-safe singleton pattern:

```typescript
// Uses mongoose.models.X || mongoose.model() pattern
const ChunkModel = mongoose.models.Chunk || mongoose.model<IChunk>("Chunk", ChunkSchema)
```

### Chatbot (PyMongo)

Connection is managed by `chatbot/db_connection.py` with a singleton `DatabaseConnection` class:

```python
# Singleton pattern
conn = DatabaseConnection()
db = conn.get_database()
```

Default connection: `mongodb://localhost:27017`, database name from `MONGODB_NAME` env var (default: `thesis`).
