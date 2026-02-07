# Thesis

A comprehensive system for extracting, managing, and serving agricultural crop data through multiple interfaces. Features PDF document processing with LLM-powered analysis, a web dashboard for data management, and a conversational API gateway for client applications.

## Architecture

```
┌────────────────────────┐    ┌────────────────────────┐    ┌──────────────┐
│   Web Panel            │    │   Chatbot API          │    │   MongoDB    │
│   (Next.js)            │    │   (FastAPI)            │    │  (Docker)    │
│   Port: 3000           │───►│   Port: 8000           │◄──►│  Port 27017  │
└────────┬───────────────┘    └────────────────────────┘    └──────────────┘
         │ child_process
         ▼
┌────────────────────────┐
│   finder_system        │
│   (Python Scripts)     │
└────────────────────────┘
```

## Components

- **finder_system/** - Python backend for PDF processing and LLM extraction
- **web-panel/** - Next.js dashboard for managing the extraction pipeline
- **chatbot/** - FastAPI RAG chatbot for crop information queries (gateway for frontends)
- **docs/** - Source PDF documents

## Prerequisites

- Python 3.10+
- Node.js 18+
- Docker (for MongoDB in development)
- API keys for at least one LLM provider (Google, Anthropic, or OpenAI)

## Quick Start

### 1. Python Setup

```bash
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Web Panel Setup

```bash
cd web-panel
npm install
```

### 3. Start MongoDB (Docker)

```bash
# From project root
docker compose up -d
```

### 4. Configure Environment

```bash
# Root .env (for CLI usage)
GOOGLE_API_KEY=your_google_api_key_here

# web-panel/.env.local (for web panel)
MONGODB_URI=mongodb://localhost:27017/thesis_panel
```

### 5. Seed Database (Optional)

```bash
cd web-panel
npm run db:migrate
npm run db:seed
```

### 6. Start Web Panel

```bash
cd web-panel
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## CLI Usage

Process a PDF directly from the command line:

```bash
python main.py ".\docs\FAO-Crop Soil Requirements.pdf"
```

This will:
1. Extract text from the PDF
2. Process and chunk the text
3. Extract agricultural information using AI
4. Save results to JSON

## What Gets Extracted

- Crop names and scientific names
- Soil requirements (types, pH, drainage)
- Climate conditions (temperature, rainfall, humidity)
- Nutrient requirements (N, P, K, micronutrients)
- Planting information (season, method, spacing, duration)
- Pests and diseases with treatments
- Yield data
- Regional growing information
- Farming practice recommendations

## Project Structure

```
Thesisv2/
├── finder_system/          # Python extraction engine
│   ├── llm_extractor/      # LLM adapters (Claude, Gemini, OpenAI)
│   ├── web_scripts/        # Scripts called by web panel
│   └── ...
├── web-panel/              # Next.js dashboard
│   ├── app/                # Pages and API routes
│   ├── components/         # UI components
│   ├── lib/                # Types, DB models, hooks
│   ├── lib/entities/       # Entity definitions (types + models)
│   ├── services/           # Python runner, token rotation
│   └── scripts/            # Migrations and seed scripts
├── chatbot/                # FastAPI chatbot (RAG-based)
│   ├── api.py              # FastAPI endpoints
│   ├── crop_store.py       # Crop data loading and search
│   └── rag_engine.py       # RAG logic and LLM integration
├── docs/                   # Source PDF documents
├── extracted/              # Extracted crop data (JSON)
├── docker-compose.yml      # Dev MongoDB container
└── requirements.txt        # Python dependencies
```

## Troubleshooting

### API key errors
Ensure `.env` file exists with your provider's API key.

### MongoDB connection errors
Check Docker is running: `docker compose ps`

### Python import errors
Ensure virtual environment is activated and dependencies installed.

---

## Chatbot API (Optional)

A lightweight FastAPI-based agricultural chatbot using Retrieval-Augmented Generation (RAG) for crop information and farming recommendations. **This is the gateway for frontend applications to access crop data via a conversational interface.**

### Architecture

```
┌─────────────────┐    ┌───────────────────┐
│   Frontend/     │    │  Chatbot API      │
│   Mobile App    │───►│  (FastAPI)        │
│                 │    │  Port: 8000       │
└─────────────────┘    └────────┬──────────┘
                                │
                                ▼
                        ┌───────────────────┐
                        │   MongoDB         │
                        │   (Crop Data)     │
                        └───────────────────┘
```

### Quick Start

```bash
# Run the chatbot API (from project root)
python -m uvicorn chatbot.api:app --reload

# Access API documentation
# Swagger UI: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
```

### Environment Setup

```bash
# Root .env (for chatbot LLM usage)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
# OR
GOOGLE_API_KEY=your_google_api_key_here
```

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check (status, crops loaded, LLM available) |
| `POST` | `/chat` | Chat with agricultural advisor |
| `GET` | `/crops` | List all available crops |
| `GET` | `/crops/{crop_name}` | Get detailed crop information |
| `POST` | `/search` | Search crops by keyword |
| `GET` | `/sources` | List source documents used |

### Example: Chat Request

```bash
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the best conditions for growing wheat?",
    "top_k": 3,
    "include_context": false
  }'
```

### Response Example

```json
{
  "answer": "Wheat thrives in temperate climates with moderate rainfall...",
  "crops_used": ["Wheat"],
  "context": null,
  "llm_used": true
}
```

### Data Requirements

The chatbot API requires extracted crop data to function. Ensure you have:

1. **Run the extraction pipeline** via the web panel to generate crop data
2. **Extracted data in `extracted/` directory** as JSON files (auto-loaded on startup)
3. **MongoDB available** (same connection as web panel)

The API will:
- Load all crop data from extracted JSON files on startup
- Provide RAG-based responses using the extracted agricultural data
- Use your configured LLM (Claude, Gemini, or Ollama) to enhance responses with conversational AI

### Notes

- **Embedded, not separate**: Since the chatbot API is small and only requires database access, it's included in this repository rather than as a separate service
- **Complements web panel**: Works alongside the web panel for data extraction and validation
- **Production ready**: Can be deployed independently or alongside the web panel
- **CORS enabled**: Configured to accept requests from any origin (configure for production)

For detailed API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
