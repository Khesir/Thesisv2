# Groq Setup Guide

Setup guide for using Groq API as the LLM backend for the Agricultural Chatbot.

> **Note:** This project previously used Ollama (local inference). It has been replaced with Groq API for faster responses and simpler setup — no local model installation required.

---

## Prerequisites

- A free Groq account: [console.groq.com](https://console.groq.com)
- Python 3.10+
- `groq` Python package (listed in `requirements.txt`)

---

## Setup

### 1. Get a Groq API Key

1. Sign up or log in at [console.groq.com](https://console.groq.com)
2. Go to **API Keys** → **Create API Key**
3. Copy the key (starts with `gsk_...`)

### 2. Configure the chatbot

In `chatbot/.env`:

```env
GROQ_API_KEY=gsk_your_api_key_here
GROQ_MODEL=llama-3.1-8b-instant
```

### 3. Install dependencies

```bash
pip install -r chatbot/requirements.txt
```

### 4. Start the chatbot API

```bash
uvicorn chatbot.api:app --host 127.0.0.1 --port 8000
```

Check the health endpoint:

```bash
curl http://127.0.0.1:8000/
```

Expected output:

```json
{
  "status": "healthy",
  "crops_loaded": 45,
  "llm_available": true
}
```

---

## Available Models

| Model | Notes |
|-------|-------|
| `llama-3.1-8b-instant` | **Default** — fast, free-tier friendly |
| `llama-3.3-70b-versatile` | Higher quality, slightly slower |
| `mixtral-8x7b-32768` | Alternative |
| `gemma2-9b-it` | Lightweight |

Change the model via the `GROQ_MODEL` env var.

---

## Free Tier Limits

Groq's free tier (as of early 2025) for `llama-3.1-8b-instant`:

- ~14,400 requests/day
- ~500,000 tokens/minute

This is more than sufficient for thesis demo use.

---

## Troubleshooting

### `LLM available: False` at startup

`GROQ_API_KEY` is missing or not set in `chatbot/.env`. Verify the key is present and starts with `gsk_`.

### `AuthenticationError` in chat responses

The API key is invalid or expired. Generate a new key at [console.groq.com](https://console.groq.com).

### `RateLimitError` in chat responses

You've hit the free tier rate limit. Either wait a moment or upgrade to a paid plan at [groq.com/pricing](https://groq.com/pricing).

### Responses are too slow

Groq is typically very fast (~200–500ms). If slow, check your internet connection or try a smaller model like `gemma2-9b-it`.
