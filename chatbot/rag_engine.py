"""
RAG Engine
Retrieval-Augmented Generation for agricultural chatbot.
Uses Groq API for fast, free-tier-friendly chat inference.
Gemini is retained in crop_store.py solely for embedding generation (cached).
"""
import os
from typing import Dict, List, Optional

from groq import Groq

from .crop_store import CropStore

DEFAULT_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")


class RAGEngine:
    """RAG Engine for agricultural Q&A using Groq for generation."""

    def __init__(self, crop_store: CropStore, model: str = DEFAULT_MODEL):
        self.crop_store = crop_store
        self.model_name = model
        api_key = os.getenv("GROQ_API_KEY")
        self._client = Groq(api_key=api_key) if api_key else None

    def is_available(self) -> bool:
        """Check if Groq client is configured."""
        return self._client is not None

    def chat(
        self,
        query: str,
        conversation_history: Optional[List[dict]] = None,
        top_k: int = 2,
        include_context: bool = True,
        api_key: Optional[str] = None,  # Kept for API schema compatibility
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

        # Step 4: Fall back to raw context if Groq is unavailable
        if not self.is_available():
            return {
                "answer": f"Here's what I found:\n\n{context}",
                "crops_used": crops_used,
                "context": context if include_context else None,
                "llm_used": False,
            }

        # Step 5: Generate response via Groq
        messages = self._build_messages(query, context, history)

        try:
            completion = self._client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.7,
                max_tokens=1024,
            )
            answer = completion.choices[0].message.content

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
                    "Make sure GROQ_API_KEY is set in your .env file.\n\n"
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
        """
        # Already specific enough — don't touch it
        if len(query.split()) >= 6:
            return query

        # Gather recent history text for crop name extraction
        recent = conversation_history[-6:]
        history_text = " ".join(t["content"] for t in recent).lower()

        # Match against known crop names from the store
        known_crops = self.crop_store.list_crops()
        query_lower = query.lower()

        mentioned_crops = [
            crop for crop in known_crops
            if crop.lower() in history_text
            and crop.lower() not in query_lower
        ]

        if mentioned_crops:
            crops_str = " and ".join(mentioned_crops[:3])
            return f"{query} for {crops_str}"

        return query

    def _build_messages(
        self,
        query: str,
        context: str,
        conversation_history: List[dict],
    ) -> List[dict]:
        """
        Build a Groq-compatible messages list for multi-turn chat.

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
                    "Answer questions based ONLY on the crops listed in the CROP INFORMATION section. "
                    "If the user asks about a crop that is NOT listed in the CROP INFORMATION, "
                    "respond that you do not have information about that crop in your database — "
                    "do NOT guess, infer, or fabricate data about unlisted crops. "
                    "Never mention or reference where your information comes from — "
                    "do not say phrases like 'based on the provided data', 'according to the context', "
                    "'from the information given', 'based on the crop information', or similar. "
                    "Just answer naturally and directly. "
                    "Be conversational and include specific numbers when available. "
                    "Always respond in English only, regardless of the language "
                    "used in the user's question or the crop data provided. "
                    "Answer concisely and keep all relevant context."
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
