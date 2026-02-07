# Agricultural Data Extraction System

A system for extracting structured agricultural data from PDF documents using LLM-powered analysis. Includes a web dashboard for managing the extraction pipeline.

## Architecture

```
┌─────────────────────┐    ┌─────────────────────┐
│    Web Panel         │    │   MongoDB            │
│    (Next.js)         │◄──►│   (Docker/Cloud)     │
│    Port: 3000        │    │   Port: 27017        │
└──────────┬──────────┘    └─────────────────────┘
           │ child_process
           ▼
┌─────────────────────┐
│   finder_system      │
│   (Python Scripts)   │
└─────────────────────┘
```

## Components

- **finder_system/** - Python backend for PDF processing and LLM extraction
- **web-panel/** - Next.js dashboard for managing the extraction pipeline
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
│   ├── services/           # Python runner, token rotation
│   └── scripts/            # Seed and migration scripts
├── docs/                   # Source PDF documents
├── docker-compose.yml      # Dev MongoDB
└── requirements.txt        # Python dependencies
```

## Troubleshooting

### API key errors
Ensure `.env` file exists with your provider's API key.

### MongoDB connection errors
Check Docker is running: `docker compose ps`

### Python import errors
Ensure virtual environment is activated and dependencies installed.
