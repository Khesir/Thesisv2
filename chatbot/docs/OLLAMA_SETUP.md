# Ollama Setup Guide

Setup guide for running Ollama as the local LLM backend for the Agricultural Chatbot.

---

## Minimum Requirements

| Component | Minimum |
|---|---|
| OS | Windows 10 64-bit |
| CPU | Intel Core i5 (any gen) or AMD Ryzen 5 (any gen) or equivalent |
| RAM | 4 GB (8 GB recommended) |
| Disk | 3 GB free (1.3 GB model + Ollama install) |
| GPU | Not required — runs on CPU only |

## Recommended Model

Use `llama3.2:1b` — it's fast, lightweight (~1.3 GB), and works well on an i5 CPU without a GPU.

---

## Setup (Native Install)

### 1. Install Ollama

Download and run the installer: https://ollama.com/download/windows

After install, Ollama runs as a background service automatically. No need to manually start it.

### 2. Pull the model

```bash
ollama pull llama3.2:1b
```

Downloads the model (~1.3 GB). Only needed once — cached locally after that.

### 3. Verify Ollama is running

```bash
python chatbot/test_ollama.py
```

All 3 checks should pass before starting the chatbot API.

### 4. Configure the chatbot

In `chatbot/.env`:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:1b
```

---

## CPU Performance Tips

- **Close other apps** — Ollama uses all available CPU cores
- Expected response time on i5 (no GPU): **15–35 seconds** per query

---

## Troubleshooting

### `LLM available: False` at startup

Ollama is not reachable. Open the Ollama app or check if it's running in the system tray. Then rerun:

```bash
python chatbot/test_ollama.py
```

### `model not found` error in chat responses

The model hasn't been pulled yet:

```bash
ollama pull llama3.2:1b
```

### Responses are too slow

Reduce max tokens in `rag_engine.py` to cap response length:

```python
"options": {
    "temperature": 0.7,
    "num_predict": 512,  # lower = faster
},
```

### Check what models are downloaded

```bash
ollama list
```
