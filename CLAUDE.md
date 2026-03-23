# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agricultural data extraction system: PDF documents → chunked text → LLM extraction → structured crop data → RAG chatbot. Three main components: a Next.js web panel, a Python processing backend, and a FastAPI chatbot API.

## Repository Layout

- `web-panel/` — Next.js 15 (App Router) dashboard for managing the extraction pipeline
- `finder_system/` — Python library for PDF processing and multi-provider LLM extraction
- `chatbot/` — FastAPI RAG chatbot for crop queries
- `main.py` — CLI entry point for direct PDF processing
- `docs/` — Source PDF documents

## Common Commands

All commands below run from `web-panel/`:

```bash
npm run dev              # Start Next.js dev server (localhost:3000)
npm run build            # Production build (standalone output)
npm run lint             # ESLint (flat config, v9)
npm run docker:dev       # Start MongoDB + Mongo Express (localhost:27017, :8081)
npm run docker:dev:down  # Stop dev containers
npm run db:migrate       # Run database migrations
npm run db:migrate:down  # Roll back last migration
npm run db:seed          # Seed sample data
```

Electron desktop app:
```bash
npm run electron:dev     # Dev with Electron shell
npm run electron:build   # Build distributable
```

## Architecture

### Web Panel (Next.js App Router)

**Pages:** `/` (dashboard), `/processing` (upload/chunk), `/extraction` (LLM processing), `/chunks` (viewer), `/extracted` (results), `/settings` (token management)

**API routes** follow REST conventions under `app/api/`. All return `{ success, data?, error? }` with pagination (`page`, `limit`, `total`, `totalPages`). Every route calls `connectDB()` before database operations.

**Entity pattern** (`lib/entities/<name>/`): Each entity has `types.ts`, `model.ts`, and `index.ts` (barrel export). Four entities: `chunk`, `extracted-data`, `api-token`, `merged-data`. Import from barrel: `import { ChunkModel, type IChunk } from "@/lib/entities/chunk"`. See `lib/entities/ENTITY_WORKFLOW.md` for adding/modifying entities and migrations.

**Data fetching:** SWR hooks in `lib/hooks/use-api.ts`. Each entity has a hook (e.g. `useChunks`, `useTokens`) and a mutator for revalidation. SWR is configured with aggressive dedup (60s) and disabled focus revalidation.

**Services** (`services/`): `python-runner.ts` spawns Python scripts via `child_process.spawn` with JSON stdin/stdout protocol. `token-rotation.ts` manages API key pool with quota tracking and cooldown. `pdf-processor.ts` and `ebr-extractor.ts` orchestrate the extraction pipeline.

### Python Backend (finder_system/)

**Web scripts** (`web_scripts/`): Called by the web panel via `python-runner.ts`. Communication is JSON over stdin → JSON over stdout (`{ success, data?, error?, traceback? }`).
- `extract_text.py` — PDF to text
- `create_chunks.py` — text to chunks
- `extract_chunk.py` — chunk to LLM extraction
- `test_token.py` — validate API keys

**LLM adapters** (`llm_extractor/adapter/`): Claude, Gemini, and Ollama. Orchestrator supports failover, round_robin, cost_optimized, and performance strategies.

Python expects a `venv/` at project root. The runner auto-detects `venv/Scripts/python.exe` (Windows) or `venv/bin/python` (Unix), falling back to system Python.

### Database (MongoDB)

Docker Compose provisions MongoDB 7.0 and Mongo Express. Mongoose models use `mongoose.models.X || mongoose.model()` for Next.js HMR safety. Migrations live in `web-panel/scripts/migrations/` and are tracked in a `migrations` collection.

## Key Conventions

- **Tailwind v4**: Uses `@import "tailwindcss"` in globals.css, not `@tailwind` directives
- **shadcn/ui**: New York style, OKLCH color system. Use `sonner` for toasts (not the deprecated `toast`)
- **Mongoose HMR pattern**: `mongoose.models.Name || mongoose.model("Name", schema)`
- **Scripts** (`web-panel/scripts/`): Use inline Mongoose schemas to avoid `@/` path alias issues when run with `tsx`
- **API response shape**: `{ success: boolean, data?: T, error?: string }` — paginated endpoints add `total`, `page`, `totalPages`
- **Path alias**: `@/*` maps to `web-panel/*` root

## Environment Variables

Required in `web-panel/.env.local`:
```
MONGODB_URI=mongodb://localhost:27017/thesis_panel
```

For LLM processing (root `.env`):
```
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
```