# Finder System Documentation

The finder system (`finder_system/`) is the Python backend responsible for PDF text extraction, text processing, and LLM-powered structured data extraction. It is not a standalone server; individual scripts are invoked by the web panel as child processes.

## Module Overview

### `pdf_extractor.py` — PDF Text Extraction

Uses `pdfplumber` to extract text and metadata from PDF files.

**Key methods:**
- `extract_text(pdf_path)` — Extracts full text, page-by-page text, metadata (title, author, pages, word count), and content hash
- `extract_tables(pdf_path)` — Extracts tabular data from PDF pages

### `text_processor.py` — Text Processing

Cleans and segments extracted text into chunks for LLM processing.

**Key methods:**
- `clean_text(text)` — Removes excessive whitespace, special characters (preserving agricultural terms), normalizes line breaks
- `segment_text(text, max_chunk_size)` — Splits text into chunks by paragraphs, falling back to sentence splitting. Default chunk size: 1000 tokens (~4000 chars)
- `extract_sections(text)` — Identifies document sections by common headers (Introduction, Results, Conclusion, etc.)
- `preprocess(raw_text)` — Full pipeline: clean → extract sections → create chunks

### `llm_extractor/` — LLM Extraction

Defines the interface and adapters for extracting structured agricultural data from text chunks using LLMs.

**Interface (`llm_interface.py`):**
- `LLMExtractorInterface` — Abstract base class with methods:
  - `extract_from_chunks(chunks, combine_results)` → `ChunkExtractionResult`
  - `is_available()` → `bool`
  - `get_provider_name()` → `str`
  - `get_token_limit()` → `int`

**Adapters (`adapter/`):**

| Adapter | Provider | Default Model |
|---------|----------|---------------|
| `ClaudeAdapter` | Anthropic | claude-3-haiku |
| `GeminiAdapter` | Google | gemini-2.0-flash |
| `OllamaAdapter` | Ollama (local) | llama3.1 |

Each adapter:
- Takes an API key (or URL for Ollama) in the constructor
- Sends a structured prompt asking the LLM to extract agricultural information
- Returns a `ChunkExtractionResult` with extracted data, usage stats, and provider info

### `llm_orchestrator.py` — Multi-Provider Orchestration

Manages multiple LLM providers with automatic failover and load balancing.

**Strategies (`ProviderStrategy`):**

| Strategy | Behavior |
|----------|----------|
| `failover` | Try providers in order until one succeeds |
| `round_robin` | Distribute load across available providers |
| `cost_optimized` | Use cheapest provider first: Ollama → Gemini → Claude |
| `performance` | Use best provider first: Claude → Gemini → Ollama |

**Key methods:**
- `extract_from_chunks(chunks, combine_results, max_retries)` — Extract using configured strategy with automatic failover
- `get_status()` — Returns status of all configured providers
- `create_orchestrator(strategy, ...)` — Factory function for creating a configured orchestrator

**Auto-configuration:** When no providers are specified, the orchestrator automatically checks for available providers by looking for API keys in environment variables and testing Ollama connectivity.

## Web Scripts

These scripts are called by the web panel's `python-runner.ts` service. They communicate via stdin/stdout JSON.

### `extract_text.py`

Extracts text from a PDF file.

- **Input:** PDF file path as CLI argument
- **Output:** `{ success, text, metadata, pages }` or `{ success: false, error }`

### `create_chunks.py`

Creates text chunks from extracted text.

- **Input (stdin):** `{ text, chunk_size, source_name }`
- **Output:** `{ success, chunks: [{ index, content, tokenCount }], source, totalChunks }`

### `extract_chunk.py`

Extracts structured agricultural data from a text chunk using an LLM.

- **Input (stdin):** `{ content, provider, api_key, model, strategy }`
  - `provider`: `"anthropic"`, `"google"`, `"ollama"`, or `"auto"` (use orchestrator)
  - `strategy`: `"failover"`, `"round_robin"`, `"cost_optimized"`, `"performance"`
- **Output:** `{ success, data, usage: { input_tokens, output_tokens }, provider }`

### `test_token.py`

Tests if an API key is valid by making a minimal request.

- **Input (stdin):** `{ provider, api_key }`
- **Output:** `{ valid: true }` or `{ valid: false, error, errorType }`
- **Special cases:**
  - Rate limit (429) → returns `valid: true` (key works, just throttled)
  - Invalid key (401) → returns `valid: false`
  - Quota/billing issues → returns `valid: false`

## Extracted Data Structure

The LLM extracts the following agricultural information:

- Crop names and scientific names
- Soil requirements (types, pH range, drainage)
- Climate conditions (temperature, rainfall, humidity)
- Nutrient requirements (N, P, K, micronutrients)
- Planting information (season, method, spacing, duration)
- Pests and diseases with treatments
- Yield data (average, range, unit)
- Regional growing information
- Farming practice recommendations
