# Web Panel Documentation

The web panel is a Next.js 15 dashboard for managing the agricultural data extraction pipeline. It provides interfaces for uploading PDFs, managing text chunks, running LLM extraction, validating results, and viewing extracted crop data.

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Overview stats: total chunks, processed, pending validation, extracted data counts. Crop breakdown chart and source progress. |
| `/processing` | Processing | Upload PDF files, extract text, create chunks. Drag-and-drop upload with configurable chunk size. |
| `/chunks` | Chunks | Browse and manage text chunks. Filter by status, source, search content. Paginated table view. |
| `/extraction` | Extraction | Run LLM extraction on chunks. Select provider/strategy, view results, track progress. |
| `/extracted` | Extracted Data | Browse all extracted crop data. Filter by category and source. View detailed extraction results. |
| `/settings` | Settings | Manage API tokens. Add, test, enable/disable tokens. View usage stats and cooldown status. |

## Services Layer

### `python-runner.ts`

Spawns Python scripts as child processes. Handles:
- Virtual environment detection (looks for `venv/` in project root)
- Packaged Electron mode (runs `.exe` directly)
- stdin/stdout JSON communication
- Timeout management (default 120s)
- JSON extraction from mixed output

### `pdf-processor.ts`

Wraps two Python scripts:
- `extractText(filePath)` — calls `extract_text.py` with file path as CLI arg
- `createChunks(text, chunkSize, sourceName)` — calls `create_chunks.py` via stdin

### `ebr-extractor.ts`

Wraps two Python scripts:
- `extractChunk(content, provider, apiKey, model, strategy)` — calls `extract_chunk.py` via stdin (180s timeout)
- `testToken(provider, apiKey)` — calls `test_token.py` via stdin (30s timeout)

### `token-rotation.ts`

Singleton service that manages API token rotation for batch extraction:
- Loads active tokens into an in-memory pool
- Selects least-used token for each request
- Detects rate limit errors (429, quota, overloaded) and triggers cooldown
- Detects invalid key errors (401, unauthorized) and permanently disables token
- Retries with next available token on failure
- Tracks in-flight requests per token

### `token-cooldown.ts`

In-memory cache (node-cache) for token rate limiting:
- Rate limit cooldowns with configurable TTL
- Daily quota tracking (resets at midnight)
- Invalid key flagging (persists until server restart)

## Data Fetching

The web panel uses [SWR](https://swr.vercel.app/) for client-side data fetching. All pages fetch data from the API routes using SWR hooks. Example pattern:

```typescript
const { data, error, isLoading, mutate } = useSWR('/api/chunks?status=all', fetcher)
```

## Component Library

Built with [shadcn/ui](https://ui.shadcn.com/) components on top of Radix UI primitives. Installed components:

button, card, table, dialog, select, tabs, badge, progress, dropdown-menu, checkbox, input, label, sidebar, separator, scroll-area, chart, sonner (toast), sheet, tooltip, slider, skeleton, switch

## Entity Structure

Each entity follows a consistent pattern under `lib/entities/<name>/`:

```
lib/entities/chunk/
├── types.ts    # TypeScript interfaces (IChunk, CreateChunkInput, ChunkResponse, etc.)
├── model.ts    # Mongoose schema and model definition
└── index.ts    # Re-exports
```

See [Database](./database.md) for detailed schema definitions.

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build (standalone output) |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run docker:dev` | Start dev MongoDB container |
| `npm run docker:dev:down` | Stop dev MongoDB container |
| `npm run docker:prod` | Start production Docker container |
| `npm run db:migrate` | Run database migrations |
| `npm run db:migrate:down` | Reverse database migrations |
| `npm run db:seed` | Seed database with sample data |
| `npm run electron:dev` | Start Electron dev mode |
| `npm run electron:build` | Build Electron app |
| `npm run build:python` | Build Python scripts with PyInstaller |
