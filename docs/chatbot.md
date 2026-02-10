# Chatbot API Documentation

The chatbot is a lightweight FastAPI service that provides a conversational interface to the extracted agricultural data using Retrieval-Augmented Generation (RAG). It serves as the gateway for frontend and mobile applications to access crop information.

## Architecture

```
┌─────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│   Frontend /    │    │  Chatbot API      │    │   MongoDB         │
│   Mobile App    │───►│  (FastAPI)        │───►│  extracteddatas   │
│                 │    │  Port: 8000       │    │  collection       │
└─────────────────┘    └───────────────────┘    └───────────────────┘
```

## Quick Start

```bash
# From project root (with venv activated)
python -m uvicorn chatbot.api:app --reload

# API documentation
# Swagger UI: http://localhost:8000/docs
# ReDoc:      http://localhost:8000/redoc
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_API_KEY` | Yes* | — | Google Gemini API key for LLM responses |
| `MONGODB_URI` | Yes | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_NAME` | No | `thesis` | Database name |

*If no API key is provided, the chatbot falls back to returning raw context without LLM-generated responses.

## Endpoints

### `GET /` — Health Check

Returns service status.

**Response:**
```json
{
  "status": "healthy",
  "crops_loaded": 42,
  "llm_available": true
}
```

### `POST /chat` — Chat with Agricultural Advisor

Send a question and receive a RAG-powered response.

**Request:**
```json
{
  "message": "What are the best conditions for growing wheat?",
  "top_k": 3,
  "include_context": false
}
```

**Response:**
```json
{
  "answer": "Wheat thrives in temperate climates with moderate rainfall...",
  "crops_used": ["Wheat"],
  "context": null,
  "llm_used": true
}
```

### `GET /crops` — List All Crops

**Response:**
```json
{
  "crops": ["Barley", "Maize", "Rice", "Wheat"],
  "count": 4
}
```

### `GET /crops/{crop_name}` — Get Crop Details

**Response:**
```json
{
  "name": "Wheat",
  "scientific_name": "Triticum aestivum",
  "category": "cereal",
  "data": { ... },
  "summary": "## Wheat\nScientific name: Triticum aestivum\n..."
}
```

### `POST /search` — Search Crops by Keyword

**Request:**
```json
{
  "query": "tropical fruit",
  "top_k": 5
}
```

**Response:**
```json
[
  { "name": "Mango", "score": 2, "category": "fruit" },
  { "name": "Banana", "score": 1, "category": "fruit" }
]
```

### `GET /sources` — List Source Documents

**Response:**
```json
{
  "sources": "MongoDB (42 documents)",
  "count": 1
}
```

## RAG Pipeline

### 1. Data Loading (Startup)

On startup, the chatbot:
1. Connects to MongoDB via `db_connection.py` (singleton pattern)
2. Loads all documents from the `extracteddatas` collection
3. Builds an in-memory index mapping crop names to their data
4. Creates searchable text representations for keyword matching
5. Handles incomplete data (missing crop names) with fallback identifiers

### 2. Query Processing

When a user sends a message:
1. **Retrieval:** Keyword-based search scores crops by the number of matching query terms
2. **Context Building:** Top-k crop summaries are formatted as markdown text
3. **Generation:** The context is sent to Gemini (gemini-2.5-flash) with the user's question
4. **Fallback:** If LLM is unavailable, raw context is returned directly

### 3. Crop Data Merging

When multiple extracted data documents reference the same crop:
- List fields (practices, pests, recommendations, regional data) are merged
- Scalar fields (scientific name, category, soil/climate) use first non-null value
- Multiple sources are tracked for provenance

## Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| LLM Model | `gemini-2.5-flash` | Used for response generation |
| Temperature | `0.7` | Response creativity |
| Max Output Tokens | `1024` | Response length limit |
| CORS | `*` (all origins) | Configure for production |

## Data Requirements

The chatbot requires extracted crop data to function:

1. Run the extraction pipeline via the web panel to populate MongoDB
2. The `extracteddatas` collection must contain documents
3. MongoDB must be accessible at the configured URI

## Notes

- **Not a separate service:** Included in the monorepo since it only needs database access
- **Complements web panel:** Works alongside the web panel for data extraction and validation
- **Production ready:** Can be deployed independently or alongside the web panel
- **CORS enabled:** Currently allows all origins — restrict for production use
