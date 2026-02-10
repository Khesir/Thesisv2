# Getting Started

## Prerequisites

| Requirement | Minimum Version | Purpose |
|-------------|----------------|---------|
| Node.js | 18+ | Web panel runtime |
| Python | 3.10+ | Finder system scripts |
| Docker | latest | MongoDB container |
| Git | latest | Version control |

You also need an API key for at least one LLM provider:
- **Google** (Gemini) - recommended for free tier
- **Anthropic** (Claude)
- **OpenAI** (GPT)

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Thesisv2
```

### 2. Python Environment

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Web Panel Dependencies

```bash
cd web-panel
npm install
```

### 4. Start MongoDB

From the project root:

```bash
docker compose up -d
```

This starts:
- **MongoDB** on port `27017`
- **Mongo Express** (admin UI) on port `8081`

### 5. Configure Environment

Create `web-panel/.env.local`:

```env
MONGODB_URI=mongodb://localhost:27017/thesis_panel
```

Create root `.env` (for CLI usage and chatbot):

```env
GOOGLE_API_KEY=your_google_api_key_here
# OR
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### 6. Run Database Migrations

```bash
cd web-panel
npm run db:migrate
```

This creates indexes on all 3 collections (chunks, extracteddatas, apitokens).

### 7. Seed Database (Optional)

```bash
cd web-panel
npm run db:seed
```

### 8. Start the Web Panel

```bash
cd web-panel
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 9. Start the Chatbot (Optional)

From the project root:

```bash
python -m uvicorn chatbot.api:app --reload
```

- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

## Environment Variables Reference

### Web Panel (`web-panel/.env.local`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | Yes | — | MongoDB connection string |
| `PYTHON_PATH` | No | Auto-detected | Path to Python interpreter |
| `ELECTRON_PACKAGED` | No | `false` | Set to `true` in packaged Electron builds |

### Root `.env` (CLI + Chatbot)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_API_KEY` | No* | — | Google Gemini API key |
| `ANTHROPIC_API_KEY` | No* | — | Anthropic Claude API key |
| `MONGODB_URI` | For chatbot | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_NAME` | For chatbot | `thesis` | Database name for chatbot |

*At least one LLM API key is required for extraction functionality.

> **Note:** When using the web panel, API tokens are managed through the Settings page and stored in MongoDB rather than environment variables.

## Verifying Everything Works

1. **MongoDB:** Visit [http://localhost:8081](http://localhost:8081) (Mongo Express)
2. **Web Panel:** Visit [http://localhost:3000](http://localhost:3000) — Dashboard should load with stats
3. **Python Integration:** Upload a PDF through the Processing page — text extraction should complete
4. **Token Setup:** Go to Settings, add an API token, and test it
5. **Chatbot:** Visit [http://localhost:8000](http://localhost:8000) — should return a health check response

## CLI Usage

Process a PDF directly from the command line (without the web panel):

```bash
python main.py ".\docs\FAO-Crop Soil Requirements.pdf"
```

This extracts text, processes chunks, runs LLM extraction, and saves results to JSON.

## Troubleshooting

### MongoDB connection errors
- Check Docker is running: `docker compose ps`
- Verify the URI in `.env.local` matches Docker config

### Python import errors
- Ensure virtual environment is activated
- Run `pip install -r requirements.txt`

### API key errors
- Test your key through Settings > Test Token
- Check provider-specific rate limits

### Port conflicts
- MongoDB: Change port mapping in `docker-compose.yml`
- Web Panel: `npm run dev -- -p 3001`
- Chatbot: `uvicorn chatbot.api:app --port 8001`
