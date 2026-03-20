"""
FastAPI Backend for Agricultural RAG Chatbot
"""
import logging
import os
import uuid
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from .crop_store import CropStore
from .rag_engine import RAGEngine

# Load environment variables
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Agricultural Chatbot API",
    description="RAG-powered chatbot for crop recommendations and agricultural advice",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize crop store and RAG engine
crop_store = CropStore()
rag_engine: Optional[RAGEngine] = None

# In-memory session store: session_id -> list of {"role": "user"|"model", "content": str}
sessions: Dict[str, List[dict]] = {}


@app.on_event("startup")
async def startup_event():
    """Check all dependencies and load crop data on startup."""
    global rag_engine

    sep = "-" * 52
    logger.info(sep)
    logger.info("Agricultural Chatbot API — Dependency Check")
    logger.info(sep)

    all_ok = True

    # --- 1. MongoDB ---
    try:
        count = crop_store.load_all()
        logger.info(f"[OK]  MongoDB        — connected, {count} crops loaded")
    except Exception as e:
        logger.error(f"[FAIL] MongoDB       — {e}")
        logger.error("       Set MONGODB_URI in chatbot/.env and verify the cluster is reachable.")
        all_ok = False

    # --- 2. Groq API key ---
    groq_key = os.getenv("GROQ_API_KEY")
    groq_model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    if groq_key:
        logger.info(f"[OK]  Groq API key   — present, model: {groq_model}")
    else:
        logger.warning("[WARN] Groq API key  — not set, LLM chat disabled")
        logger.warning("       Set GROQ_API_KEY in chatbot/.env (get one at https://console.groq.com)")

    # --- 3. Gemini API key (optional — for embeddings) ---
    google_key = os.getenv("GOOGLE_API_KEY")
    if google_key:
        logger.info("[OK]  Gemini API key — present (semantic embedding enabled)")
    else:
        logger.warning("[WARN] Gemini API key — not set, falling back to keyword search")
        logger.warning("       Set GOOGLE_API_KEY in chatbot/.env to enable vector search")

    # --- Init RAG engine ---
    try:
        rag_engine = RAGEngine(crop_store)
    except Exception as e:
        logger.error(f"[FAIL] RAG engine    — {e}")
        all_ok = False

    _finish_startup(rag_engine, all_ok, sep)


def _finish_startup(rag_engine, all_ok: bool, sep: str):
    logger.info(sep)
    if all_ok:
        logger.info("All checks passed. Chatbot API is ready.")
    else:
        logger.warning("One or more checks failed. See errors above.")
        logger.warning("The API will start but some features may not work.")
    logger.info(sep)


# Request/Response Models
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None  # Omit to start a new session; include to continue one
    top_k: int = 3
    include_context: bool = False
    api_key: Optional[str] = None  # Optional: use custom API key if backend quota exhausted


class ChatResponse(BaseModel):
    answer: str
    session_id: str  # Always returned so client can continue the session
    crops_used: List[str]
    context: Optional[str] = None
    llm_used: bool = False


class CropListResponse(BaseModel):
    crops: List[str]
    count: int


class CropDetailResponse(BaseModel):
    name: str
    scientific_name: Optional[str]
    category: Optional[str]
    data: dict
    summary: str


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5


class SearchResult(BaseModel):
    name: str
    score: float
    category: Optional[str]


class HealthResponse(BaseModel):
    status: str
    crops_loaded: int
    llm_available: bool
    embedding_search: bool


# Endpoints
@app.get("/", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "crops_loaded": len(crop_store.crop_index),
        "llm_available": rag_engine.is_available() if rag_engine else False,
        "embedding_search": crop_store.embedding_search_available
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat with the agricultural advisor.

    Send a question about crops and get a conversational response
    based on the extracted agricultural data. Pass `session_id` from
    a previous response to continue the same conversation thread.
    """
    if not rag_engine:
        raise HTTPException(status_code=503, detail="Service not initialized")

    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Resolve or create session
    session_id = request.session_id or str(uuid.uuid4())
    history = sessions.setdefault(session_id, [])

    result = rag_engine.chat(
        query=request.message,
        conversation_history=history,
        top_k=request.top_k,
        include_context=request.include_context,
        api_key=request.api_key,
    )

    # Persist this turn into session history
    history.append({"role": "user", "content": request.message})
    history.append({"role": "assistant", "content": result['answer']})

    return ChatResponse(
        answer=result['answer'],
        session_id=session_id,
        crops_used=result['crops_used'],
        context=result.get('context'),
        llm_used=result.get('llm_used', False),
    )


@app.get("/crops", response_model=CropListResponse)
async def list_crops():
    """List all available crops in the database"""
    crops = crop_store.list_crops()
    return {
        "crops": sorted(crops),
        "count": len(crops)
    }


@app.get("/crops/{crop_name}", response_model=CropDetailResponse)
async def get_crop(crop_name: str):
    """Get detailed information about a specific crop"""
    if not rag_engine:
        raise HTTPException(status_code=503, detail="Service not initialized")

    info = rag_engine.get_crop_info(crop_name)

    if not info:
        raise HTTPException(status_code=404, detail=f"Crop '{crop_name}' not found")

    crop = info['crop']
    return {
        "name": crop.get('name', crop_name),
        "scientific_name": crop.get('scientific_name'),
        "category": crop.get('category'),
        "data": crop,
        "summary": info['summary']
    }


@app.post("/search", response_model=List[SearchResult])
async def search_crops(request: SearchRequest):
    """Search for crops by keyword"""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    results = crop_store.search(request.query, top_k=request.top_k)

    return [
        {
            "name": r['name'],
            "score": r['score'],
            "category": r['crop'].get('category')
        }
        for r in results
    ]


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Return the conversation history for a session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session_id": session_id, "history": sessions[session_id]}


@app.delete("/sessions/{session_id}")
async def clear_session(session_id: str):
    """Clear (reset) a session's conversation history"""
    sessions.pop(session_id, None)
    return {"session_id": session_id, "cleared": True}


@app.get("/sources")
async def get_sources():
    """Get list of source documents used"""
    return {
        "sources": crop_store.sources,
        "count": len(crop_store.sources)
    }


# Run with: uvicorn chatbot.api:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
