"""
RAG Engine
Retrieval-Augmented Generation for agricultural chatbot.
Uses local Ollama for free, quota-free chat inference.
Gemini is retained in crop_store.py solely for embedding generation (cached).
"""
import os
import requests
from typing import Dict, List, Optional

from .crop_store import CropStore

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")


class RAGEngine:
    """RAG Engine for agricultural Q&A using Ollama for generation."""

    def __init__(self, crop_store: CropStore, model: str = DEFAULT_MODEL):
        self.crop_store = crop_store
        self.model_name = model
        self.base_url = OLLAMA_BASE_URL.rstrip("/")

    def is_available(self) -> bool:
        """Check if Ollama is running and reachable."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=2)
            return response.status_code == 200
        except Exception:
            return False

    def chat(
        self,
        query: str,
        conversation_history: Optional[List[dict]] = None,
        top_k: int = 3,
        include_context: bool = True,
        api_key: Optional[str] = None,  # Kept for API schema compatibility; unused by Ollama
    ) -> Dict:
        """
        Process a user query with RAG, optionally continuing a conversation.

        Args:
            query: User's question
            conversation_history: Previous turns [{"role": "user"|"assistant", "content": str}, ...]
            top_k: Number of crops to retrieve for context
            include_context: Whether to include raw context in response
            api_key: Unused — kept for backwards API compatibility

        Returns:
            Response dict with answer and metadata
        """
        history = conversation_history or []

        # Step 1: Reformulate vague follow-up into a standalone search query
        # (only when there is prior conversation history to reference)
        search_query = (
            self._reformulate_query(query, history)
            if history
            else query
        )

        # Step 2: Retrieve relevant crops using the (possibly reformulated) query
        search_results = self.crop_store.search(search_query, top_k=top_k)

        if not search_results:
            return {
                "answer": "I don't have information about that crop in my database. Please try asking about a different crop.",
                "crops_used": [],
                "context": None,
                "llm_used": False,
            }

        # Step 3: Build context from retrieved crops
        context_parts = []
        crops_used = []
        for result in search_results:
            crop = result["crop"]
            crops_used.append(result["name"])
            summary = self.crop_store.get_crop_summary(crop)
            context_parts.append(f"# {crop['name']}\n{summary}")
        context = "\n\n---\n\n".join(context_parts)

        # Step 4: Fall back to raw context if Ollama is unavailable
        if not self.is_available():
            return {
                "answer": f"Here's what I found:\n\n{context}",
                "crops_used": crops_used,
                "context": context if include_context else None,
                "llm_used": False,
            }

        # Step 5: Generate response via Ollama /api/chat
        messages = self._build_messages(query, context, history)

        try:
            response = requests.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model_name,
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": 512,
                    },
                },
                timeout=300,
            )
            response.raise_for_status()
            answer = response.json()["message"]["content"]

            return {
                "answer": answer,
                "crops_used": crops_used,
                "context": context if include_context else None,
                "llm_used": True,
            }

        except Exception as e:
            return {
                "answer": (
                    f"Error generating response: {e}\n\n"
                    "Make sure Ollama is running (`ollama serve`) and the model is pulled "
                    f"(`ollama pull {self.model_name}`).\n\n"
                    f"Here's the raw data:\n\n{context}"
                ),
                "crops_used": crops_used,
                "context": context if include_context else None,
                "llm_used": False,
                "error": str(e),
            }

    def _reformulate_query(self, query: str, conversation_history: List[dict]) -> str:
        """
        Rewrite a vague follow-up query into a standalone search query
        using recent conversation history, so RAG retrieval stays accurate.

        E.g. "What about fertilizer for those?" + history about rice/wheat
          → "fertilizer recommendations for rice and wheat"

        Uses Ollama /api/generate with a very low token budget (64 tokens)
        since this is a simple rewriting task.
        """
        recent = conversation_history[-6:]
        history_text = "\n".join(
            f"{t['role'].upper()}: {t['content']}" for t in recent
        )
        prompt = (
            "Given the conversation history below and a follow-up question, "
            "rewrite the follow-up as a concise, standalone search query that "
            "includes all relevant crop names and topics. "
            "Output ONLY the reformulated query in English — no explanation.\n\n"
            f"CONVERSATION HISTORY:\n{history_text}\n\n"
            f"FOLLOW-UP QUESTION: {query}\n\n"
            "STANDALONE SEARCH QUERY:"
        )
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.0, "num_predict": 64},
                },
                timeout=60,
            )
            response.raise_for_status()
            result = response.json().get("response", "").strip()
            return result if result else query
        except Exception:
            return query  # Fall back to original query on any error

    def _build_messages(
        self,
        query: str,
        context: str,
        conversation_history: List[dict],
    ) -> List[dict]:
        """
        Build an Ollama-compatible messages list for multi-turn chat.

        Structure:
          - system: agricultural advisor instruction
          - [prior turns replayed as user/assistant pairs]
          - user: current question with injected RAG context
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a helpful Philippine agricultural advisor. "
                    "All crop data you receive is sourced from the Philippines. "
                    "Assume all farming conditions, seasons, regions, and practices are Philippine-based. "
                    "Answer questions based ONLY on the crop information provided in each message. "
                    "Be conversational and include specific numbers when available."
                    "IMPORTANT: Always respond in English only, regardless of the language "
                    "used in the user's question or the crop data provided."                  
                ),
            }
        ]

        # Replay prior conversation turns
        for turn in conversation_history:
            messages.append({"role": turn["role"], "content": turn["content"]})

        # Current turn: inject retrieved crop context alongside the question
        messages.append({
            "role": "user",
            "content": f"CROP INFORMATION:\n{context}\n\nUSER QUESTION: {query}",
        })

        return messages

    def get_crop_info(self, crop_name: str) -> Optional[Dict]:
        """Get detailed info about a specific crop."""
        crop = self.crop_store.get_crop(crop_name)
        if crop:
            return {"crop": crop, "summary": self.crop_store.get_crop_summary(crop)}
        return None
