# Agricultural RAG Chatbot API Documentation

A FastAPI-based agricultural advisory chatbot using Retrieval-Augmented Generation (RAG) for crop information and farming recommendations.

## Table of Contents

- [Getting Started](#getting-started)
- [Base URL](#base-url)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Chat](#chat)
  - [List Crops](#list-crops)
  - [Get Crop Details](#get-crop-details)
  - [Search Crops](#search-crops)
  - [Get Sources](#get-sources)
- [Request/Response Models](#requestresponse-models)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Getting Started

### Prerequisites

- Python 3.10 or higher
- Virtual environment (recommended)

### Installation

```bash
# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

### Configuration

Copy `.env.example` to `.env` and configure your API keys:

```env
# LLM Providers (at least one required for chat functionality)
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_API_KEY=your_google_api_key

# Ollama (optional - for local LLM)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

### Running the API

```bash
# Development mode with auto-reload
uvicorn chatbot.api:app --reload

# Production mode
uvicorn chatbot.api:app --host 0.0.0.0 --port 8000
```

### Running with Docker

#### Quick Start (standalone)

1. Create a `.env` file inside the `chatbot/` directory:

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net
MONGODB_NAME=thesis_panel
GOOGLE_API_KEY=your-google-api-key
```

> **Note:** `GOOGLE_API_KEY` is optional. Without it, the chatbot falls back to keyword-based search instead of embedding/LLM-powered responses.

2. Build and run:

```bash
docker compose -f chatbot/docker-compose.standalone.yml up --build
```

#### As part of the full project

From the **project root** directory:

```bash
docker compose up chatbot-api
```

This builds the image from source and uses your root `.env` file.

#### Verify it's running

```bash
# Health check
curl http://localhost:8000/

# Swagger docs available at
http://localhost:8000/docs
```

---

## Base URL

```
http://localhost:8000
```

Interactive API documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Endpoints

### Health Check

Check API status and system health.

```
GET /
```

#### Response

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | API health status |
| `crops_loaded` | integer | Number of crops in database |
| `llm_available` | boolean | Whether LLM is available for chat |

#### Example Response

```json
{
  "status": "healthy",
  "crops_loaded": 45,
  "llm_available": true
}
```

---

### Chat

Chat with the agricultural advisor using RAG (Retrieval-Augmented Generation).

```
POST /chat
```

#### Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `message` | string | Yes | - | Your question about crops/agriculture |
| `top_k` | integer | No | 3 | Number of relevant crops to retrieve for context |
| `include_context` | boolean | No | false | Include raw context in response |
| `api_key` | string | No | null | Custom Google API key (use if backend quota exhausted) |

#### Response

| Field | Type | Description |
|-------|------|-------------|
| `answer` | string | AI-generated response to your question |
| `crops_used` | array | List of crop names used as context |
| `context` | string | Raw context (only if `include_context` is true) |
| `llm_used` | boolean | Whether LLM was used for response |

#### Example Request

```json
{
  "message": "What are the soil requirements for rice?",
  "top_k": 3,
  "include_context": false
}
```

#### Example Request (with custom API key)

```json
{
  "message": "What are the soil requirements for rice?",
  "top_k": 3,
  "include_context": false,
  "api_key": "AIzaSyD...your-custom-api-key"
}
```

#### Example Response

```json
{
  "answer": "Rice thrives best in clay or loam soils with good water retention. The optimal soil pH range is 6.0-7.0. Rice paddies require soil that can maintain standing water, so clay-heavy soils that prevent excessive drainage are ideal. Good fertility with adequate organic matter is also important for optimal yields.",
  "crops_used": ["Rice", "Wheat", "Corn"],
  "context": null,
  "llm_used": true
}
```

---

### List Crops

Get a list of all available crops in the database.

```
GET /crops
```

#### Response

| Field | Type | Description |
|-------|------|-------------|
| `crops` | array | List of crop names |
| `count` | integer | Total number of crops |

#### Example Response

```json
{
  "crops": ["Rice", "Wheat", "Corn", "Soybean", "Tomato", "..."],
  "count": 45
}
```

---

### Get Crop Details

Get detailed information about a specific crop.

```
GET /crops/{crop_name}
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `crop_name` | string | Name of the crop (case-insensitive) |

#### Response

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Crop name |
| `scientific_name` | string | Scientific name |
| `category` | string | Crop category (cereal, vegetable, etc.) |
| `data` | object | Complete crop data |
| `summary` | string | Formatted text summary |

#### Crop Data Structure

```json
{
  "name": "string",
  "scientific_name": "string",
  "category": "string",
  "soil_requirements": {
    "types": ["array of soil types"],
    "ph_range": "string",
    "drainage": "string"
  },
  "climate_requirements": {
    "temperature": "string",
    "rainfall": "string",
    "conditions": ["array of climate conditions"]
  },
  "nutrients": {
    "nitrogen": "string",
    "phosphorus": "string",
    "potassium": "string"
  },
  "planting_info": {
    "season": "string",
    "spacing": "string",
    "depth": "string"
  },
  "yield_info": {
    "expected_yield": "string",
    "harvest_time": "string"
  },
  "farming_practices": ["array of practices"],
  "recommendations": ["array of recommendations"]
}
```

#### Example Request

```
GET /crops/rice
```

#### Example Response

```json
{
  "name": "Rice",
  "scientific_name": "Oryza sativa",
  "category": "cereal",
  "data": {
    "name": "Rice",
    "scientific_name": "Oryza sativa",
    "category": "cereal",
    "soil_requirements": {
      "types": ["clay", "loam"],
      "ph_range": "6.0-7.0",
      "drainage": "poor to moderate"
    },
    "climate_requirements": {
      "temperature": "20-35°C",
      "rainfall": "1500-2000mm",
      "conditions": ["tropical", "subtropical"]
    }
  },
  "summary": "## Rice\nScientific name: Oryza sativa\nCategory: cereal\n..."
}
```

#### Error Response (404)

```json
{
  "detail": "Crop 'unknown_crop' not found"
}
```

---

### Search Crops

Search for crops by keyword.

```
POST /search
```

#### Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | - | Search query |
| `top_k` | integer | No | 5 | Maximum number of results |

#### Response

Array of search results:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Crop name |
| `score` | integer | Relevance score (keyword match count) |
| `category` | string | Crop category |

#### Example Request

```json
{
  "query": "nitrogen fertilizer tropical",
  "top_k": 5
}
```

#### Example Response

```json
[
  {
    "name": "Rice",
    "score": 3,
    "category": "cereal"
  },
  {
    "name": "Corn",
    "score": 2,
    "category": "cereal"
  },
  {
    "name": "Banana",
    "score": 2,
    "category": "fruit"
  }
]
```

---

### Get Sources

Get the list of data source files used for crop information.

```
GET /sources
```

#### Response

| Field | Type | Description |
|-------|------|-------------|
| `sources` | array | List of source file names |
| `count` | integer | Number of sources |

#### Example Response

```json
{
  "sources": [
    "FAO-Crop_Soil_Requirements_extracted.json",
    "Philippine_Rice_Guide_extracted.json"
  ],
  "count": 2
}
```

---

## Request/Response Models

### ChatRequest

```json
{
  "message": "string (required)",
  "top_k": "integer (optional, default: 3)",
  "include_context": "boolean (optional, default: false)",
  "api_key": "string (optional, default: null) - Custom Google API key"
}
```

### ChatResponse

```json
{
  "answer": "string",
  "crops_used": ["string"],
  "context": "string | null",
  "llm_used": "boolean"
}
```

### SearchRequest

```json
{
  "query": "string (required)",
  "top_k": "integer (optional, default: 5)"
}
```

### SearchResult

```json
{
  "name": "string",
  "score": "integer",
  "category": "string"
}
```

---

## Security Considerations

### Custom API Keys

The `/chat` endpoint accepts an optional `api_key` parameter. This allows the frontend to provide its own Google API key if the backend quota is exhausted.

**Security Best Practices:**

1. **Use HTTPS in production** - API keys should only be transmitted over encrypted connections (HTTPS). For local development (localhost), HTTP is acceptable.

2. **Frontend storage** - If your Flutter app stores an API key:
   - Use Flutter's `flutter_secure_storage` for sensitive data
   - Never hardcode keys in source code
   - Consider using environment variables or user input

3. **Key scope** - The custom API key is used only for that single request and is not stored server-side.

4. **Rate limiting** - Consider implementing rate limiting in production to prevent abuse.

5. **Quota monitoring** - The API returns helpful error messages when quota is exhausted, prompting the user to provide their own key.

**Example Flutter code (secure storage):**
```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final storage = FlutterSecureStorage();

// Store API key securely
await storage.write(key: 'google_api_key', value: userApiKey);

// Retrieve when needed
String? apiKey = await storage.read(key: 'google_api_key');

// Send in request only if backend quota exhausted
final response = await http.post(
  Uri.parse('$baseUrl/chat'),
  body: jsonEncode({
    'message': message,
    'api_key': apiKey,  // Include only when needed
  }),
);
```

---

## Error Handling

The API uses standard HTTP status codes:

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 404 | Resource not found |
| 422 | Validation error (invalid request body) |
| 500 | Internal server error |

### Error Response Format

```json
{
  "detail": "Error message describing what went wrong"
}
```

---

## Examples

### Using cURL

```bash
# Health check
curl http://localhost:8000/

# List all crops
curl http://localhost:8000/crops

# Get crop details
curl http://localhost:8000/crops/rice

# Search crops
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "nitrogen fertilizer", "top_k": 5}'

# Chat with advisor
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What soil pH does rice need?", "top_k": 3}'
```

### Using Python (requests)

```python
import requests

BASE_URL = "http://localhost:8000"

# Health check
response = requests.get(f"{BASE_URL}/")
print(response.json())

# List crops
response = requests.get(f"{BASE_URL}/crops")
crops = response.json()
print(f"Available crops: {crops['count']}")

# Get crop details
response = requests.get(f"{BASE_URL}/crops/rice")
rice_data = response.json()
print(f"Rice pH range: {rice_data['data']['soil_requirements']['ph_range']}")

# Search crops
response = requests.post(
    f"{BASE_URL}/search",
    json={"query": "tropical climate", "top_k": 5}
)
results = response.json()
for crop in results:
    print(f"{crop['name']}: score {crop['score']}")

# Chat with advisor
response = requests.post(
    f"{BASE_URL}/chat",
    json={
        "message": "What are the best practices for growing rice?",
        "top_k": 3,
        "include_context": False
    }
)
answer = response.json()
print(answer['answer'])
```

### Using JavaScript (fetch)

```javascript
const BASE_URL = 'http://localhost:8000';

// Chat with advisor
async function askQuestion(message) {
  const response = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: message,
      top_k: 3,
      include_context: false
    }),
  });

  const data = await response.json();
  console.log('Answer:', data.answer);
  console.log('Crops used:', data.crops_used);
  return data;
}

askQuestion('What fertilizers does corn need?');
```

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  FastAPI    │────▶│  RAG Engine │
│  (Request)  │     │   Server    │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
            ┌─────────────┐          ┌─────────────┐            ┌─────────────┐
            │ Crop Store  │          │     LLM     │            │   Context   │
            │  (JSON DB)  │          │  Provider   │            │   Builder   │
            └─────────────┘          └─────────────┘            └─────────────┘
```

---

## License

This project is part of a thesis research project.
