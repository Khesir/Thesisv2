# API Reference

Complete reference for all web panel API routes. All routes are under `/api/` and return JSON with a `success` boolean field.

## Chunks

### `GET /api/chunks` — List Chunks

Paginated list of text chunks with filtering.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | `"all"` | Filter by status: `not-processed`, `processing`, `requires-validation`, `processed`, `all` |
| `source` | string | `"all"` | Filter by source PDF filename |
| `search` | string | — | Regex search in chunk content |
| `sort` | string | `"desc"` | Sort order: `asc` or `desc` (by createdAt) |
| `page` | number | `1` | Page number |
| `limit` | number | `50` | Items per page |

**Response:**
```json
{
  "success": true,
  "chunks": [{ "_id": "...", "source": "...", "chunkIndex": 0, "content": "...", "tokenCount": 250, "status": "not-processed", "processedDataId": null, "createdAt": "...", "updatedAt": "..." }],
  "total": 100,
  "page": 1,
  "totalPages": 2
}
```

---

### `POST /api/chunks` — Create Chunks (Bulk)

Insert an array of chunk documents.

**Request Body:**
```json
{
  "chunks": [
    { "source": "file.pdf", "chunkIndex": 0, "content": "...", "tokenCount": 250 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "chunks": [ ... ],
  "count": 5
}
```

---

### `GET /api/chunks/:id` — Get Chunk by ID

**Response:**
```json
{
  "success": true,
  "chunk": { "_id": "...", "source": "...", ... }
}
```

---

### `PATCH /api/chunks/:id` — Update Chunk

**Request Body:** Any subset of chunk fields (source, chunkIndex, content, tokenCount, status, processedDataId).

**Response:**
```json
{
  "success": true,
  "chunk": { ... }
}
```

---

### `DELETE /api/chunks/:id` — Delete Chunk

**Response:**
```json
{ "success": true }
```

---

### `GET /api/chunks/sources` — List Distinct Sources

Returns all unique source filenames.

**Response:**
```json
{
  "success": true,
  "sources": ["FAO-Crop Soil Requirements.pdf", "IRRI-Rice-Guide.pdf"]
}
```

---

### `POST /api/chunks/upload` — Upload PDF

Upload a PDF file, extract text, create chunks, and save to database.

**Request:** `multipart/form-data`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `file` | File | yes | — | PDF file |
| `chunkSize` | number | no | `1000` | Tokens per chunk |

**Response:**
```json
{
  "success": true,
  "source": "file.pdf",
  "metadata": { "title": "...", "author": "...", "total_pages": 42, "word_count": 15000 },
  "chunks": [ ... ],
  "totalChunks": 15
}
```

---

## Extraction

### `POST /api/extraction/process` — Process Chunk with LLM

Run LLM extraction on a chunk's content. Saves results to database and updates chunk status.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chunkId` | string | no | Chunk ID (if provided, updates status) |
| `content` | string | yes | Text content to extract from |
| `provider` | string | no | `"anthropic"`, `"google"`, `"ollama"`, or `"auto"` |
| `apiKey` | string | yes | API key for the provider |
| `strategy` | string | no | `"failover"` (default), `"round_robin"`, `"cost_optimized"`, `"performance"` |

**Status flow:** `not-processed` → `processing` → `requires-validation` (success) or `not-processed` (failure)

**Response:**
```json
{
  "success": true,
  "data": { "crops": [...], "soil_types": [...], ... },
  "usage": { "input_tokens": 500, "output_tokens": 1200 },
  "provider": "google"
}
```

---

### `POST /api/extraction/validate` — Re-extract for Validation

Re-runs extraction on a chunk for comparison during validation.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chunkId` | string | yes | Chunk ID to re-extract |
| `provider` | string | no | Provider override |
| `apiKey` | string | no | API key |
| `strategy` | string | no | Orchestration strategy |

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "usage": { "input_tokens": 500, "output_tokens": 1200 },
  "provider": "google"
}
```

---

### `POST /api/extraction/confirm` — Accept or Reject Extraction

Confirm or reject extracted data after validation.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chunkId` | string | yes | Chunk ID |
| `action` | string | yes | `"accept"`, `"reject"`, or `"reject-permanent"` |
| `data` | object | for accept | Extracted data to save (can be edited) |

**Actions:**
- `accept` — Saves data with `validatedAt` timestamp, updates chunk to `processed`, removes other extractions for this chunk
- `reject` — Resets chunk to `not-processed`, deletes extracted data
- `reject-permanent` — Marks chunk as `rejected`, deletes extracted data

**Response:**
```json
{ "success": true, "extractedData": { ... } }
```

---

### `GET /api/extraction/results/:chunkId` — Get Extraction Result

Get the extracted data for a specific chunk.

**Response:**
```json
{
  "success": true,
  "data": { "_id": "...", "chunkId": "...", "cropName": "Wheat", ... }
}
```

---

## Extracted Data

### `GET /api/extracted` — List Extracted Data

Paginated list of all extracted crop data with filtering.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `category` | string | `"all"` | Filter by crop category |
| `source` | string | `"all"` | Filter by source PDF filename |
| `sort` | string | `"desc"` | Sort order (by createdAt) |
| `page` | number | `1` | Page number |
| `limit` | number | `50` | Items per page |

**Response:**
```json
{
  "success": true,
  "data": [{ "_id": "...", "chunkId": { "source": "...", "chunkIndex": 0 }, "cropName": "Wheat", ... }],
  "total": 42,
  "page": 1,
  "totalPages": 1
}
```

> **Note:** The `chunkId` field is populated with `source` and `chunkIndex` from the referenced Chunk document.

---

## Dashboard

### `GET /api/dashboard/stats` — Get Dashboard Statistics

Aggregated statistics for the dashboard.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalChunks": 150,
    "processedChunks": 80,
    "validationChunks": 20,
    "notProcessedChunks": 50,
    "totalExtracted": 120
  },
  "sources": [
    { "source": "FAO-Crop Soil Requirements.pdf", "total": 100, "processed": 60 },
    { "source": "IRRI-Rice-Guide.pdf", "total": 50, "processed": 20 }
  ]
}
```

---

### `GET /api/dashboard/crops` — Get Crop Breakdown

Aggregated crop names with counts and categories.

**Response:**
```json
{
  "success": true,
  "crops": [
    { "name": "Wheat", "count": 5, "category": "cereal" },
    { "name": "Rice", "count": 3, "category": "cereal" }
  ]
}
```

---

## Tokens

### `GET /api/tokens` — List All Tokens

Returns all tokens with masked values and cooldown status.

**Response:**
```json
{
  "success": true,
  "tokens": [{
    "_id": "...",
    "provider": "google",
    "alias": "My Gemini Key",
    "token": "AIza...xY9z",
    "usageCount": 42,
    "usageLimit": null,
    "quotaLimit": 1500,
    "cooldownMinutes": 60,
    "isActive": true,
    "lastUsedAt": "2025-01-15T...",
    "rateLimited": false,
    "cooldownRemaining": 0,
    "cooldownTotal": 0,
    "quotaUsed": 12,
    "invalidKey": false,
    "createdAt": "...",
    "updatedAt": "..."
  }]
}
```

---

### `POST /api/tokens` — Create Token

**Request Body:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `provider` | string | yes | — | `"anthropic"`, `"google"`, or `"openai"` |
| `token` | string | yes | — | API key |
| `alias` | string | yes | — | Display name |
| `usageLimit` | number | no | `null` | Max requests (null = unlimited) |
| `quotaLimit` | number | no | `null` | Daily quota limit |
| `cooldownMinutes` | number | no | `60` | Cooldown after rate limit |

**Response:**
```json
{
  "success": true,
  "token": { "_id": "...", "provider": "google", "alias": "My Key", "token": "AIza...xY9z", ... }
}
```

---

### `PATCH /api/tokens/:id` — Update Token

Update alias, usage limit, or active status. Cannot update the actual token value.

**Request Body:**
```json
{ "alias": "Renamed Key", "usageLimit": 1000, "isActive": false }
```

Clears the invalid key flag when a token is updated.

---

### `DELETE /api/tokens/:id` — Delete Token

**Response:**
```json
{ "success": true }
```

---

### `POST /api/tokens/:id/test` — Test Saved Token

Tests a token that is already saved in the database.

**Response:**
```json
{ "valid": true }
```

or

```json
{ "valid": false, "error": "Invalid API key: ..." }
```

Clears the invalid key flag if the test passes.

---

### `POST /api/tokens/test` — Test Token (Unsaved)

Tests a provider/API key combination without saving.

**Request Body:**
```json
{ "provider": "google", "apiKey": "AIza..." }
```

**Response:**
```json
{ "valid": true }
```

---

### `POST /api/tokens/test-temp` — Test Token with Provider Defaults

Tests a token and returns suggested provider settings.

**Request Body:**
```json
{ "provider": "google", "token": "AIza..." }
```

**Response (success):**
```json
{
  "valid": true,
  "suggestedQuotaLimit": 1500,
  "suggestedCooldownMinutes": 60,
  "providerDescription": "Google free tier: ~1500 requests/day, 60min cooldown"
}
```

**Provider defaults:**

| Provider | Suggested Quota | Cooldown | Description |
|----------|----------------|----------|-------------|
| `google` | 1500/day | 60 min | Google free tier |
| `anthropic` | unlimited | 5 min | Usage-based billing |
| `openai` | unlimited | 5 min | Usage-based billing |

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "errorType": "ErrorClassName"
}
```

HTTP status codes:
- `400` — Bad request (missing/invalid parameters)
- `404` — Resource not found
- `500` — Server error (extraction failure, database error, etc.)
- `503` — Service unavailable (chatbot not initialized)
