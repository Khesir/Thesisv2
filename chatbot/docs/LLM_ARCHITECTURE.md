# LLM Architecture: Grounded Q&A with Ollama

This document explains the LLM design decisions behind the agricultural RAG chatbot — specifically why local Ollama inference is used for chat generation, while Gemini is retained for embeddings.

---

## What is Grounded Q&A?

**Grounded Q&A** (also called context-grounded generation) is a pattern where the LLM is not expected to answer from its own parametric knowledge. Instead:

1. The system **retrieves** relevant facts from a trusted data source (the crop database)
2. Those facts are **injected** into the prompt as context
3. The LLM is instructed to answer **only from the provided context**

The model's job is essentially reading comprehension and response formatting — not recalling memorized facts.

```
User Question
     │
     ▼
┌─────────────────┐
│   RAG Retrieval │  ← Finds the most relevant crops via vector/keyword search
└────────┬────────┘
         │  Crop context (structured text)
         ▼
┌─────────────────┐
│   Ollama LLM    │  ← Reads context + question, writes a natural answer
└────────┬────────┘
         │
         ▼
     AI Answer
```

This is fundamentally different from open-ended generation tasks (creative writing, code generation, complex reasoning) where model capability matters much more.

---

## Why Ollama for Chat Generation?

### The Key Insight: Retrieval Does the Heavy Lifting

In a RAG pipeline, the quality of the final answer depends mostly on:

1. **Retrieval accuracy** — did we fetch the right crops? (handled by embeddings + vector search)
2. **Context completeness** — is the crop data rich enough? (handled by the extraction pipeline)
3. **Response formatting** — can the model read the context and write a clear answer?

Step 3 is what the chat LLM handles. For this task, `llama3.1` or `mistral` are more than capable. The model does not need to know anything about agriculture on its own — the answer is handed to it in the prompt.

### Practical Advantages of Ollama

| Concern | Gemini (cloud) | Ollama (local) |
|---------|---------------|----------------|
| API quota | Hits limit after ~2 queries on free tier | Unlimited |
| Cost at scale | Accumulates per-token charges | Free after hardware |
| Latency | Network round-trip (~1–3s) | Local inference (hardware-dependent) |
| Privacy | Data leaves the machine | Fully local |
| Availability | Requires internet + valid API key | Works offline |
| Setup | Just an API key | Ollama must be installed and running |

For a thesis prototype running locally alongside a Flutter desktop app, Ollama is the natural fit.

---

## Where Gemini Is Still Used

Gemini is retained for **embedding generation** in `crop_store.py`, and this is intentional.

### Why Keep Gemini Embeddings?

Embeddings are generated **once at startup**, then cached in MongoDB. Subsequent startups reuse cached embeddings — no API calls needed unless the crop data changes.

#### Benchmark Evidence

`gemini-embedding-001` is the current top-ranked model on the **MTEB (Massive Text Embedding Benchmark)** leaderboard — the standard academic evaluation for embedding models across retrieval, classification, clustering, and semantic similarity tasks.

Key numbers from the paper *"Gemini Embedding: Generalizable Embeddings from Gemini"* (Google, March 2025) [[arxiv:2503.07891](https://arxiv.org/abs/2503.07891)]:

| Benchmark | Score | Rank |
|-----------|-------|------|
| MTEB (Multilingual) Task Mean | **68.32** | #1 |
| MTEB Retrieval | **67.71** | #1 |
| MTEB STS | 79.40 | #1 |
| XOR-Retrieve (cross-lingual retrieval) | 90.42 | #1 |

For comparison, the next best model (multilingual-e5-large-instruct) scores 63.23 on MTEB — a gap of over 5 points. OpenAI's `text-embedding-3-large` scores 64.6. ([VentureBeat, 2025](https://venturebeat.com/ai/new-embedding-model-leaderboard-shakeup-google-takes-1-while-alibabas-open-source-alternative-closes-gap))

The MTEB leaderboard is publicly verifiable at: [huggingface.co/spaces/mteb/leaderboard](https://huggingface.co/spaces/mteb/leaderboard)

The retrieval score (67.71) is particularly relevant here — it directly measures the task the embedding is used for in this system (finding the most semantically relevant crop given a user query).

Switching embeddings to an Ollama model (e.g., `nomic-embed-text`) would:
- Require clearing and regenerating all cached embeddings (different vector dimensions)
- Reduce retrieval quality (local embedding models score ~10+ points lower on MTEB retrieval)
- Save very little — embedding calls only happen once per new crop, then are cached

**The split is deliberate:** use Gemini's strengths (embeddings) where they matter most and have near-zero ongoing cost; use Ollama (local inference) where the volume is high (every chat query).

---

## The 2-Call Pattern per Query

Each chat message triggers up to two model calls:

```
User sends follow-up: "What about fertilizer for those?"
                │
                ▼
  ┌─────────────────────────┐
  │  Call 1: Reformulation  │  → "fertilizer recommendations for rice and wheat"
  │  (api/generate, 64 tok) │     (only if conversation history exists)
  └─────────────┬───────────┘
                │ standalone search query
                ▼
         Vector/keyword search
                │ top-k crop context
                ▼
  ┌─────────────────────────┐
  │  Call 2: Chat response  │  → Natural language answer
  │  (api/chat, 1024 tok)   │
  └─────────────────────────┘
```

**Why reformulate?** Follow-up questions like "what about those?" or "how do I apply it?" don't contain enough keywords for retrieval. Without reformulation, the vector search would return irrelevant crops. The reformulation call is cheap (64 output tokens, no streaming) and significantly improves retrieval accuracy for multi-turn conversations.

With Ollama, both calls are free — there is no quota concern.

---

## Conversation History Design

Session history is stored **in-memory** in the FastAPI process:

```python
sessions: Dict[str, List[dict]] = {}
# { "session-uuid": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}] }
```

Each turn is appended after a successful response. The full history is passed to the LLM on every request, allowing natural follow-up questions.

**Role convention:** `"user"` and `"assistant"` (standard OpenAI/Ollama format).

**Limitations:**
- Sessions are lost on server restart (no database persistence)
- History grows unboundedly — very long conversations increase token usage per request
- No session expiry / cleanup

For the current thesis scope, in-memory sessions are acceptable. A future improvement would persist sessions to MongoDB and cap history to the last N turns.

---

## Hosting Ollama

### Option 1: Local (Development)

Install Ollama directly on the host machine:

```bash
# Install from https://ollama.com/download, then:
ollama serve                  # starts the server on :11434
ollama pull llama3.1          # download the model (~4.7 GB)
```

Set in `.env`:
```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

### Option 2: Docker (Recommended for consistent deployment)

Ollama has an official Docker image: `ollama/ollama`. It is included in `chatbot/docker-compose.standalone.yml`.

```bash
# Start both Ollama and the chatbot API
docker compose -f chatbot/docker-compose.standalone.yml up -d

# Pull the model inside the container (first run only — model persists in the ollama_data volume)
docker exec chatbot_ollama ollama pull llama3.1

# Restart chatbot so it can connect to Ollama
docker compose -f chatbot/docker-compose.standalone.yml restart chatbot-api
```

The `chatbot-api` container connects to Ollama via the internal Docker network at `http://ollama:11434` — no port exposure needed between containers.

#### CPU vs GPU

By default the Ollama container runs on **CPU**. This is slower (~10–60s per response depending on model size and hardware) but works on any machine.

To enable **NVIDIA GPU** acceleration, install the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) and uncomment the `deploy` section in `docker-compose.standalone.yml`:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: all
          capabilities: [gpu]
```

GPU inference is 5–20x faster and is recommended for demo environments.

#### Model Storage

Downloaded models are stored in the `ollama_data` Docker volume and persist across container restarts. A model only needs to be pulled once. Approximate sizes:

| Model | Disk |
|-------|------|
| `llama3.1:8b` | ~4.7 GB |
| `mistral:7b` | ~4.1 GB |
| `phi3:mini` | ~2.2 GB |
| `llama3.1:70b` | ~40 GB |

### Option 3: Remote Ollama Server

Point `OLLAMA_BASE_URL` at any machine running Ollama on your network:

```env
OLLAMA_BASE_URL=http://192.168.1.100:11434
```

This is useful if you have a dedicated GPU machine and want the chatbot API to run on a lighter machine.

---

## Model Recommendations

| Model | Size | Best for | Notes |
|-------|------|----------|-------|
| `llama3.1:8b` | ~5 GB | General use, English Q&A | Good default |
| `mistral:7b` | ~4 GB | Concise, fast answers | Slightly faster than llama3.1 |
| `llama3.1:70b` | ~40 GB | Higher reasoning quality | Needs strong GPU/RAM |
| `deepseek-r1:8b` | ~5 GB | Step-by-step reasoning | Overkill for grounded Q&A |
| `phi3:mini` | ~2 GB | Low-resource environments | Lower quality, very fast |

For most thesis demo scenarios, `llama3.1:8b` or `mistral:7b` is the recommended choice.

Configure via environment variable:

```env
OLLAMA_MODEL=llama3.1
OLLAMA_BASE_URL=http://localhost:11434
```

---

## Fallback Behavior

The system degrades gracefully when Ollama is unavailable:

```
Ollama running?
    │
   YES → Generate natural language answer
    │
    NO → Return raw formatted crop data from context
         (still useful, just unformatted)
```

The `/` health endpoint reports `llm_available: false` when Ollama is not reachable, so clients can surface an appropriate message.

---

## Summary

| Component | Provider | Reason |
|-----------|----------|--------|
| Chat generation | Ollama (local) | Unlimited, free, sufficient for grounded Q&A |
| Query reformulation | Ollama (local) | Cheap call, same provider, no quota risk |
| Crop embeddings | Gemini `embedding-001` | Best retrieval accuracy, cached after first run |
| Crop retrieval | Vector search + keyword fallback | No LLM needed for lookup |
