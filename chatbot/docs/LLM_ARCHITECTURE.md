# LLM Architecture: Grounded Q&A with Groq

This document explains the LLM design decisions behind the agricultural RAG chatbot — specifically why Groq API is used for chat generation, while Gemini is retained for embeddings.

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
│    Groq LLM     │  ← Reads context + question, writes a natural answer
└────────┬────────┘
         │
         ▼
     AI Answer
```

This is fundamentally different from open-ended generation tasks (creative writing, code generation, complex reasoning) where model capability matters much more.

---

## Why Groq for Chat Generation?

### The Key Insight: Retrieval Does the Heavy Lifting

In a RAG pipeline, the quality of the final answer depends mostly on:

1. **Retrieval accuracy** — did we fetch the right crops? (handled by embeddings + vector search)
2. **Context completeness** — is the crop data rich enough? (handled by the extraction pipeline)
3. **Response formatting** — can the model read the context and write a clear answer?

Step 3 is what the chat LLM handles. For this task, `llama-3.1-8b-instant` is more than capable. The model does not need to know anything about agriculture on its own — the answer is handed to it in the prompt.

### Practical Advantages of Groq

| Concern | Gemini (cloud) | Groq (cloud) |
|---------|---------------|--------------|
| API quota | Hits limit after ~2 queries on free tier | Generous free tier (14,400 req/day) |
| Cost at scale | Accumulates per-token charges | Pay-per-token (very cheap) |
| Latency | Network round-trip (~1–3s) | Extremely fast (~200–500ms via LPU) |
| Privacy | Data leaves the machine | Data sent to Groq servers |
| Availability | Requires internet + valid API key | Requires internet + valid API key |
| Setup | Just an API key | Just an API key |

For a thesis prototype, Groq's free tier is more than sufficient and eliminates the need to run a local Ollama server.

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

**The split is deliberate:** use Gemini's strengths (embeddings) where they matter most and have near-zero ongoing cost; use Groq (fast cloud inference) where the volume is high (every chat query).

---

## The 2-Call Pattern per Query

Each chat message triggers up to two model calls:

```
User sends follow-up: "What about fertilizer for those?"
                │
                ▼
  ┌─────────────────────────┐
  │  Call 1: Reformulation  │  → "fertilizer recommendations for rice and wheat"
  │  (keyword match, 0 tok) │     (only if conversation history exists; no LLM call)
  └─────────────┬───────────┘
                │ standalone search query
                ▼
         Vector/keyword search
                │ top-k crop context
                ▼
  ┌─────────────────────────┐
  │  Call 2: Chat response  │  → Natural language answer
  │  (Groq, 256 tok)        │
  └─────────────────────────┘
```

**Why reformulate?** Follow-up questions like "what about those?" or "how do I apply it?" don't contain enough keywords for retrieval. Without reformulation, the vector search would return irrelevant crops. The reformulation step uses local keyword matching (no LLM call) and then the single Groq call handles the final answer.

---

## Conversation History Design

Session history is stored **in-memory** in the FastAPI process:

```python
sessions: Dict[str, List[dict]] = {}
# { "session-uuid": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}] }
```

Each turn is appended after a successful response. The full history is passed to the LLM on every request, allowing natural follow-up questions.

**Role convention:** `"user"` and `"assistant"` (standard OpenAI-compatible format — Groq uses the same schema).

**Limitations:**
- Sessions are lost on server restart (no database persistence)
- History grows unboundedly — very long conversations increase token usage per request
- No session expiry / cleanup

For the current thesis scope, in-memory sessions are acceptable. A future improvement would persist sessions to MongoDB and cap history to the last N turns.

---

## Groq Setup

### Get an API Key

1. Sign up at [console.groq.com](https://console.groq.com)
2. Navigate to **API Keys** → **Create API Key**
3. Copy the key into `chatbot/.env`:

```env
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-8b-instant
```

### Available Models

| Model | Context | Best for |
|-------|---------|----------|
| `llama-3.1-8b-instant` | 128k | Default — fast, free-tier friendly |
| `llama-3.3-70b-versatile` | 128k | Higher quality answers |
| `mixtral-8x7b-32768` | 32k | Alternative MoE model |
| `gemma2-9b-it` | 8k | Lightweight, fast |

Configure via environment variable:

```env
GROQ_MODEL=llama-3.1-8b-instant
```

---

## Fallback Behavior

The system degrades gracefully when Groq is unavailable (no API key set):

```
GROQ_API_KEY set?
    │
   YES → Generate natural language answer via Groq
    │
    NO → Return raw formatted crop data from context
         (still useful, just unformatted)
```

The `/` health endpoint reports `llm_available: false` when the Groq client is not configured, so clients can surface an appropriate message.

---

## Summary

| Component | Provider | Reason |
|-----------|----------|--------|
| Chat generation | Groq (`llama-3.1-8b-instant`) | Fast, free tier, sufficient for grounded Q&A |
| Query reformulation | Local keyword matching | Zero cost, no API call needed |
| Crop embeddings | Gemini `embedding-001` | Best retrieval accuracy, cached after first run |
| Crop retrieval | Vector search + keyword fallback | No LLM needed for lookup |
