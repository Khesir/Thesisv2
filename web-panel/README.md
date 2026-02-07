# Web Panel

Next.js dashboard for managing the Agricultural Data Extraction pipeline. Upload PDF documents, chunk text, extract structured crop data via LLM, and validate results — all from a single web interface.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.1.6 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Database | MongoDB via Mongoose 9.x |
| Data Fetching | SWR 2.x |
| Charts | Recharts |
| File Upload | react-dropzone |
| Icons | lucide-react |
| Toasts | sonner |

---

## Setup Guide

### Prerequisites

- **Node.js** 18+
- **Docker** (for MongoDB)
- **Python** 3.10+ (for PDF extraction and LLM scripts)
- **API Keys** — at least one of: Anthropic (Claude), Google (Gemini), or OpenAI

### 1. Install dependencies

```bash
cd web-panel
npm install
```

### 2. Start MongoDB via Docker

```bash
npm run docker:dev
```

This starts a MongoDB container on port `27017` using the `docker-compose.yml` in the project root.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` if needed (defaults work for local development):

```env
MONGODB_URI=mongodb://localhost:27017/thesis_panel
PYTHON_PATH=python
```

### 4. Run migrations and seed data

```bash
npm run db:migrate    # Create indexes on all collections
npm run db:seed       # Populate sample chunks, extracted data, and tokens
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm run start
```

For production MongoDB, set `MONGODB_URI` to your connection string (e.g. `mongodb+srv://user:pass@cluster.mongodb.net/thesis_panel`).

---

## Project Structure

```
web-panel/
├── app/
│   ├── api/
│   │   ├── chunks/            # Chunk CRUD + upload + sources
│   │   ├── dashboard/         # Stats and crop aggregations
│   │   ├── extracted/         # Extracted data listing
│   │   ├── extraction/        # Process, validate, confirm, results
│   │   └── tokens/            # Token CRUD + test
│   ├── chunks/page.tsx        # Chunks viewer page
│   ├── extracted/page.tsx     # Extracted data viewer page
│   ├── extraction/page.tsx    # Extraction workflow page
│   ├── processing/page.tsx    # Upload & chunking page
│   ├── settings/page.tsx      # API token management page
│   ├── layout.tsx             # Root layout with sidebar
│   └── page.tsx               # Dashboard page
├── components/
│   ├── dashboard/             # Stats cards, charts, activity
│   ├── extraction/            # Chunk selector, controls, results, validation
│   ├── layout/                # Sidebar, theme provider/toggle
│   ├── processing/            # File upload, chunk config, chunks table
│   ├── settings/              # Token dialogs and list
│   └── ui/                    # shadcn/ui primitives
├── hooks/
│   └── use-mobile.ts          # Viewport detection
├── lib/
│   ├── db/
│   │   ├── models/            # Mongoose models (Chunk, ExtractedData, APIToken)
│   │   └── connection.ts      # Cached MongoDB connection
│   ├── hooks/
│   │   └── use-api.ts         # SWR hooks and mutation functions
│   ├── types/                 # TypeScript interfaces
│   ├── mock-data.ts           # Legacy mock data
│   └── utils.ts               # cn() utility
├── services/
│   ├── python-runner.ts       # Execute Python scripts
│   ├── pdf-processor.ts       # PDF text extraction + chunking
│   ├── ebr-extractor.ts       # LLM extraction + token testing
│   └── token-rotation.ts      # Token pool with auto-rotation
├── scripts/
│   ├── migrate.ts             # Create database indexes
│   └── seed.ts                # Seed sample data
└── package.json
```

---

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Overview stats (total/processed/pending/unprocessed chunks), crop distribution bar chart, sources breakdown pie chart, recent activity table |
| `/processing` | Processing | Drag-and-drop PDF upload, chunk size configuration (500–2000 tokens), chunks table with status badges and detail dialogs |
| `/extraction` | Extraction | Select chunks for LLM extraction, choose provider/strategy, progress tracking, structured results display, validation comparison (side-by-side), accept/reject workflow |
| `/chunks` | Chunks | Read-only table of all chunks with filtering by status, source, and search |
| `/extracted` | Extracted | Read-only table of all extracted data with filtering by category and source |
| `/settings` | Settings | Manage API tokens — add, edit, delete, test validity, view usage |

---

## API Routes

### Chunks

#### `GET /api/chunks`

List chunks with optional filters.

| Query Param | Type | Description |
|-------------|------|-------------|
| `status` | `ChunkStatus` | Filter by status |
| `source` | `string` | Filter by source name |
| `search` | `string` | Search in content |
| `sort` | `"asc" \| "desc"` | Sort by creation date |
| `page` | `number` | Page number (default 1) |
| `limit` | `number` | Items per page (default 20) |

**Response:**
```json
{ "success": true, "chunks": [...], "total": 50, "page": 1, "totalPages": 3 }
```

#### `POST /api/chunks`

Create chunks in bulk.

**Body:** `{ "chunks": [{ source, chunkIndex, content, tokenCount }] }`

**Response:** `{ "success": true, "chunks": [...], "count": 4 }`

#### `GET /api/chunks/[id]`

Get a single chunk by ID.

**Response:** `{ "success": true, "chunk": { ... } }`

#### `PATCH /api/chunks/[id]`

Update a chunk (partial update).

**Body:** Any subset of chunk fields.

**Response:** `{ "success": true, "chunk": { ... } }`

#### `DELETE /api/chunks/[id]`

Delete a chunk by ID.

**Response:** `{ "success": true }`

#### `GET /api/chunks/sources`

Get all unique source names.

**Response:** `{ "success": true, "sources": ["FAO_Report.pdf", "Manual_2024.pdf"] }`

#### `POST /api/chunks/upload`

Upload a PDF and create chunks from it.

**Body:** `FormData` with `file` (PDF) and `chunkSize` (number).

**Response:**
```json
{
  "success": true,
  "source": "filename.pdf",
  "metadata": { "title": "...", "total_pages": 12, "word_count": 5000 },
  "chunks": [...],
  "totalChunks": 8
}
```

---

### Extraction

#### `POST /api/extraction/process`

Extract structured data from a chunk using an LLM.

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chunkId` | `string` | No | Chunk ID (updates status in DB) |
| `content` | `string` | Yes | Text content to extract from |
| `provider` | `string` | No | `"anthropic"`, `"google"`, or `"openai"` |
| `apiKey` | `string` | No | API key (uses token rotation if omitted) |
| `strategy` | `string` | No | Extraction strategy (default `"auto"`) |

**Response:** `{ "success": true, "data": { ... }, "usage": { "input_tokens": 500, "output_tokens": 200 }, "provider": "google" }`

**Side effects:** Sets chunk status to `"processing"` → `"requires-validation"`, creates an `ExtractedData` record.

#### `POST /api/extraction/validate`

Re-extract a chunk for validation comparison.

**Body:** `{ "chunkId": "...", "provider?": "...", "apiKey?": "...", "strategy?": "..." }`

**Response:** `{ "success": true, "data": { ... }, "usage": { ... }, "provider": "..." }`

#### `POST /api/extraction/confirm`

Accept or reject an extraction result.

**Body:** `{ "chunkId": "...", "action": "accept" | "reject", "data?": { ... } }`

**Response:** `{ "success": true, "extractedData": { ... } }`

| Action | Effect |
|--------|--------|
| `accept` | Chunk status → `"processed"`, sets `validatedAt` on extracted data |
| `reject` | Chunk status → `"not-processed"`, deletes extracted data |

#### `GET /api/extraction/results/[chunkId]`

Get extraction result for a specific chunk.

**Response:** `{ "success": true, "data": { ... } }`

---

### Dashboard

#### `GET /api/dashboard/stats`

Get aggregated statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalChunks": 50,
    "processedChunks": 30,
    "validationChunks": 5,
    "notProcessedChunks": 15,
    "totalExtracted": 30
  },
  "sources": [
    { "source": "FAO_Report.pdf", "total": 25, "processed": 15 }
  ]
}
```

#### `GET /api/dashboard/crops`

Get crop distribution data.

**Response:** `{ "success": true, "crops": [{ "name": "Wheat", "count": 3, "category": "cereal" }] }`

---

### Extracted Data

#### `GET /api/extracted`

List extracted data with filters.

| Query Param | Type | Description |
|-------------|------|-------------|
| `category` | `string` | Filter by crop category |
| `source` | `string` | Filter by source document |
| `sort` | `"asc" \| "desc"` | Sort by creation date |
| `page` | `number` | Page number (default 1) |
| `limit` | `number` | Items per page (default 20) |

**Response:** `{ "success": true, "data": [...], "total": 30, "page": 1, "totalPages": 2 }`

Note: `chunkId` is populated as `{ _id, source, chunkIndex }` instead of a plain string.

---

### Tokens

#### `GET /api/tokens`

List all API tokens (token values are masked).

**Response:** `{ "success": true, "tokens": [...] }`

#### `POST /api/tokens`

Add a new API token.

**Body:** `{ "provider": "google", "token": "AIza...", "alias": "My Key", "usageLimit?": 1000 }`

**Response:** `{ "success": true, "token": { ... } }` (masked)

#### `PATCH /api/tokens/[id]`

Update token metadata.

**Body:** `{ "alias?": "...", "usageLimit?": 500, "isActive?": false }`

**Response:** `{ "success": true, "token": { ... } }` (masked)

#### `DELETE /api/tokens/[id]`

Delete a token.

**Response:** `{ "success": true }`

#### `POST /api/tokens/[id]/test`

Test a stored token's validity.

**Response:** `{ "valid": true }` or `{ "valid": false, "error": "Invalid API key" }`

#### `POST /api/tokens/test`

Test a token by provider and key (before saving).

**Body:** `{ "provider": "anthropic", "apiKey": "sk-ant-..." }`

**Response:** `{ "valid": true }` or `{ "valid": false, "error": "..." }`

---

## Components

### Dashboard (`components/dashboard/`)

| Component | Description |
|-----------|-------------|
| `stats-cards.tsx` | Four stat cards — total chunks, processed, pending validation, not processed |
| `crop-chart.tsx` | Bar chart showing crop distribution by category |
| `sources-breakdown.tsx` | Pie chart showing processed vs unprocessed chunks per source |
| `recent-activity.tsx` | Table of recently extracted crops |

### Processing (`components/processing/`)

| Component | Description |
|-----------|-------------|
| `file-upload.tsx` | Drag-and-drop PDF upload area using react-dropzone |
| `chunk-config.tsx` | Slider to set chunk size (500–2000 tokens) |
| `chunks-table.tsx` | Table showing chunks with status badges, search, filters, and actions |
| `chunk-detail-dialog.tsx` | Modal displaying full chunk content and metadata |

### Extraction (`components/extraction/`)

| Component | Description |
|-----------|-------------|
| `chunk-selector.tsx` | Select chunks for extraction with filters and batch selection |
| `extraction-controls.tsx` | Provider and strategy selector with start button |
| `extraction-progress.tsx` | Progress bar and current-chunk indicator during extraction |
| `extraction-results.tsx` | Structured display of extracted agricultural data |
| `validation-queue.tsx` | List of chunks awaiting validation |
| `validation-compare.tsx` | Side-by-side comparison of original vs re-extracted data |
| `validation-actions.tsx` | Accept/reject buttons for confirming extractions |

### Settings (`components/settings/`)

| Component | Description |
|-----------|-------------|
| `token-list.tsx` | Table of API tokens with masked values, usage display, and filters |
| `add-token-dialog.tsx` | Modal form to add a new API token |
| `edit-token-dialog.tsx` | Modal form to edit token alias, limit, and active status |
| `delete-token-dialog.tsx` | Confirmation dialog for token deletion |

### Layout (`components/layout/`)

| Component | Description |
|-----------|-------------|
| `app-sidebar.tsx` | Main navigation sidebar with page links and theme toggle |
| `theme-provider.tsx` | next-themes provider wrapper |
| `theme-toggle.tsx` | Light/dark mode toggle button |

### UI (`components/ui/`)

21 shadcn/ui primitives: badge, button, card, chart, checkbox, dialog, dropdown-menu, input, label, progress, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, tooltip.

---

## Services

### `python-runner.ts`

Executes Python scripts from `finder_system/web_scripts/`. Spawns a child process, passes input via stdin (JSON), and parses stdout as JSON.

**Function:** `runScript<T>(options)` — `{ scriptName, args?, stdin?, timeout? (default 120s) }`

**Returns:** `{ success, data, error? }`

### `pdf-processor.ts`

Handles PDF upload processing.

| Function | Description |
|----------|-------------|
| `extractText(filePath)` | Calls `extract_text.py` to extract text from a PDF. Returns `{ success, text, metadata, pages }` |
| `createChunks(text, chunkSize, sourceName)` | Calls `create_chunks.py` to split text into semantic chunks. Returns `{ success, chunks[], source, totalChunks }` |

### `ebr-extractor.ts`

Handles LLM-based data extraction.

| Function | Description |
|----------|-------------|
| `extractChunk(content, provider, apiKey?, model?, strategy)` | Calls `extract_chunk.py` to extract structured crop data. Returns `{ success, data, usage?, provider? }` |
| `testToken(provider, apiKey)` | Calls `test_token.py` to validate an API key. Returns `{ valid, error? }` |

### `token-rotation.ts`

Manages a pool of API tokens with automatic rotation on rate limits or exhaustion.

| Method | Description |
|--------|-------------|
| `loadTokens(tokens)` | Load tokens into the rotation pool |
| `getNextToken(provider?)` | Get the next available token (round-robin) |
| `recordUsage(tokenId, count)` | Record usage against a token |
| `markExhausted(tokenId)` | Mark a token as exhausted |
| `processWithRotation(content, provider?, strategy?, maxAttempts?)` | Process extraction with automatic token rotation on failure |

---

## Database Models

### Chunk (`lib/db/models/chunk.model.ts`)

| Field | Type | Description |
|-------|------|-------------|
| `source` | `string` | Source document name |
| `chunkIndex` | `number` | Position within the source |
| `content` | `string` | Text content |
| `tokenCount` | `number` | Approximate token count |
| `status` | `ChunkStatus` | `"not-processed"` \| `"processing"` \| `"requires-validation"` \| `"processed"` |
| `processedDataId` | `ObjectId \| null` | Reference to ExtractedData |

**Indexes:** `source`, `status`, `{ source, status }`, `{ createdAt: -1 }`

### ExtractedData (`lib/db/models/extracted-data.model.ts`)

| Field | Type | Description |
|-------|------|-------------|
| `chunkId` | `ObjectId` | Reference to source Chunk |
| `cropName` | `string` | Name of the crop |
| `scientificName` | `string \| null` | Scientific name |
| `category` | `string` | Crop category |
| `soilRequirements` | `object` | `{ types[], ph_range, drainage }` |
| `climateRequirements` | `object` | `{ temperature, rainfall, humidity, conditions[] }` |
| `nutrients` | `object` | `{ nitrogen, phosphorus, potassium, other_nutrients[] }` — each with `{ rate, timing, notes }` |
| `plantingInfo` | `object` | `{ season, method, spacing, duration }` |
| `farmingPractices` | `string[]` | List of practices |
| `pestsDiseases` | `array` | `[{ name, type, treatment }]` |
| `yieldInfo` | `object` | `{ average, range, unit }` |
| `regionalData` | `array` | `[{ region, specific_info }]` |
| `recommendations` | `string[]` | List of recommendations |
| `rawResponse` | `object` | Original LLM response |
| `validatedAt` | `Date \| null` | When extraction was confirmed |

**Indexes:** `chunkId`, `cropName`, `category`, `{ createdAt: -1 }`

### APIToken (`lib/db/models/api-token.model.ts`)

| Field | Type | Description |
|-------|------|-------------|
| `provider` | `TokenProvider` | `"anthropic"` \| `"google"` \| `"openai"` |
| `token` | `string` | API key (masked in API responses) |
| `alias` | `string` | User-friendly name |
| `usageCount` | `number` | Requests made with this token |
| `usageLimit` | `number \| null` | Max requests (`null` = unlimited) |
| `isActive` | `boolean` | Whether token is enabled |
| `lastUsedAt` | `Date \| null` | Last usage timestamp |

**Indexes:** `provider`, `isActive`

---

## Types

Defined in `lib/types/`.

```typescript
// chunk.ts
type ChunkStatus = "not-processed" | "processing" | "requires-validation" | "processed"

interface Chunk {
  _id: string; source: string; chunkIndex: number; content: string;
  tokenCount: number; status: ChunkStatus; processedDataId: string | null;
  createdAt: string; updatedAt: string;
}

// extracted-data.ts
interface ExtractedData {
  _id: string; chunkId: string; cropName: string; scientificName: string | null;
  category: string; soilRequirements: { types: string[]; ph_range: string; drainage: string };
  climateRequirements: { temperature: string; rainfall: string; humidity: string; conditions: string[] };
  nutrients: { nitrogen: NutrientDetail; phosphorus: NutrientDetail; potassium: NutrientDetail;
    other_nutrients: { name: string; rate: string; notes: string }[] };
  plantingInfo: { season: string; method: string; spacing: string; duration: string };
  farmingPractices: string[]; pestsDiseases: { name: string; type: string; treatment: string }[];
  yieldInfo: { average: string; range: string; unit: string };
  regionalData: { region: string; specific_info: string }[];
  recommendations: string[]; rawResponse: Record<string, unknown>;
  validatedAt: string | null; createdAt: string; updatedAt: string;
}

// api-token.ts
type TokenProvider = "anthropic" | "google" | "openai"

interface APIToken {
  _id: string; provider: TokenProvider; token: string; alias: string;
  usageCount: number; usageLimit: number | null; isActive: boolean;
  lastUsedAt: string | null; createdAt: string; updatedAt: string;
}
```

---

## Hooks

All data-fetching hooks live in `lib/hooks/use-api.ts` and use SWR.

### Data Fetching

| Hook | Parameters | Returns |
|------|-----------|---------|
| `useChunks(params?)` | `{ status?, source?, search?, sort?, page?, limit? }` | `{ chunks, total, page, totalPages, isLoading, error }` |
| `useSources()` | — | `{ sources, isLoading, error }` |
| `useDashboardStats()` | — | `{ stats, sources, isLoading, error }` |
| `useCrops()` | — | `{ crops, isLoading, error }` |
| `useExtractedData(params?)` | `{ category?, source?, sort?, page?, limit? }` | `{ data, total, page, totalPages, isLoading, error }` |
| `useTokens()` | — | `{ tokens, isLoading, error }` |

### Mutations

| Function | Description |
|----------|-------------|
| `mutateChunks()` | Revalidate all chunk SWR caches |
| `mutateExtracted()` | Revalidate all extracted data SWR caches |
| `createToken(data)` | `POST /api/tokens` |
| `updateToken(id, data)` | `PATCH /api/tokens/[id]` |
| `deleteToken(id)` | `DELETE /api/tokens/[id]` |
| `testTokenById(id)` | `POST /api/tokens/[id]/test` |
| `uploadPDF(file, chunkSize)` | `POST /api/chunks/upload` (FormData) |
| `processChunk(data)` | `POST /api/extraction/process` |
| `confirmExtraction(data)` | `POST /api/extraction/confirm` |

---

## Scripts

### `scripts/migrate.ts`

Creates database indexes on all collections. Uses inline Mongoose schemas to avoid path alias issues when run via `tsx`.

```bash
npm run db:migrate
```

**Indexes created:**
- `chunks`: `source`, `status`, `{ source, status }`, `{ createdAt: -1 }`
- `extracteddatas`: `chunkId`, `cropName`, `category`, `{ createdAt: -1 }`
- `apitokens`: `provider`, `isActive`

### `scripts/seed.ts`

Clears all collections and populates sample data. Uses inline schemas for the same reason as `migrate.ts`.

```bash
npm run db:seed
```

**Seeds:**
- 8 chunks (4 from "FAO_Agricultural_Report.pdf", 4 from "Crop_Manual_2024.pdf")
- 4 extracted data records (Wheat, Rice, Cassava, Banana)
- 3 API tokens (2 Google, 1 Anthropic) with placeholder keys

---

## Python Integration

The `finder_system/web_scripts/` directory contains four Python scripts that the web panel calls via the `python-runner` service. Communication follows a JSON-over-stdio protocol: input is passed via stdin (or CLI args), output is JSON on stdout.

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `extract_text.py` | Extract text from PDF | CLI arg: file path | `{ success, text, metadata, pages[] }` |
| `create_chunks.py` | Split text into chunks | stdin: `{ text, chunk_size, source_name }` | `{ success, chunks[], source, totalChunks }` |
| `extract_chunk.py` | Extract structured data via LLM | stdin: `{ content, provider, api_key, model?, strategy }` | `{ success, data, usage?, provider? }` |
| `test_token.py` | Validate an API key | stdin: `{ provider, api_key }` | `{ valid, error? }` |

**Supported providers:** `anthropic` (Claude), `google` (Gemini), `openai`, `ollama` (local).

**Strategies:** `auto` uses an orchestrator that may call multiple providers; otherwise specify a single provider.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URI` | `mongodb://localhost:27017/thesis_panel` | MongoDB connection string |
| `PYTHON_PATH` | `python` | Path to the Python executable |

---

## npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev` | Start development server on port 3000 |
| `build` | `next build` | Create production build |
| `start` | `next start` | Start production server |
| `lint` | `eslint` | Run ESLint |
| `docker:dev` | `docker compose up -d` | Start MongoDB container |
| `docker:dev:down` | `docker compose down` | Stop MongoDB container |
| `docker:prod` | `docker compose -f docker-compose.prod.yml up -d` | Start production containers |
| `db:migrate` | `npx tsx scripts/migrate.ts` | Create database indexes |
| `db:seed` | `npx tsx scripts/seed.ts` | Seed database with sample data |

---

## Workflow

The end-to-end data extraction pipeline:

```
┌─────────────┐     ┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌─────────┐
│  Upload PDF │ ──▶ │  Chunk   │ ──▶ │ Extract via │ ──▶ │ Validate │ ──▶ │ Confirm │
│ /processing │     │  Text    │     │    LLM      │     │ Results  │     │ Accept/ │
│             │     │          │     │ /extraction  │     │          │     │ Reject  │
└─────────────┘     └──────────┘     └─────────────┘     └──────────┘     └─────────┘
```

1. **Upload PDF** — Drag-and-drop a PDF on the `/processing` page. The file is sent to `extract_text.py` to pull out raw text, then `create_chunks.py` splits it into chunks of configurable size. Chunks are saved to MongoDB with status `"not-processed"`.

2. **Extract via LLM** — On the `/extraction` page, select one or more chunks and choose a provider (Anthropic, Google, OpenAI) and strategy. Each chunk's text is sent to `extract_chunk.py` which calls the LLM API and returns structured agricultural data. The result is saved as an `ExtractedData` record and the chunk status becomes `"requires-validation"`.

3. **Validate** — The validation queue shows chunks awaiting review. You can re-extract with a different provider for comparison. A side-by-side view highlights differences between the original and new extraction.

4. **Confirm** — Accept the extraction (chunk → `"processed"`, `validatedAt` is set) or reject it (chunk → `"not-processed"`, extracted data is deleted). Accepted data appears on the `/extracted` page and contributes to dashboard statistics.
