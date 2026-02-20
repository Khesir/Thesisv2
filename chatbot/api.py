"""
FastAPI Backend for Agricultural RAG Chatbot
"""
import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from .crop_store import CropStore
from .rag_engine import RAGEngine

# Load environment variables
load_dotenv()

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


@app.on_event("startup")
async def startup_event():
    """Load crop data from MongoDB on startup"""
    global rag_engine
    try:
        count = crop_store.load_all()
        rag_engine = RAGEngine(crop_store)
        print(f"Loaded {count} crops from MongoDB. LLM available: {rag_engine.is_available()}")
    except Exception as e:
        print(f"Error during startup: {e}")
        raise


# Request/Response Models
class ChatRequest(BaseModel):
    message: str
    top_k: int = 3
    include_context: bool = False
    api_key: Optional[str] = None  # Optional: use custom API key if backend quota exhausted


class ChatResponse(BaseModel):
    answer: str
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
    based on the extracted agricultural data.
    """
    if not rag_engine:
        raise HTTPException(status_code=503, detail="Service not initialized")

    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    result = rag_engine.chat(
        query=request.message,
        top_k=request.top_k,
        include_context=request.include_context,
        api_key=request.api_key  # Pass optional custom API key
    )

    return ChatResponse(
        answer=result['answer'],
        crops_used=result['crops_used'],
        context=result.get('context'),
        llm_used=result.get('llm_used', False)
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
