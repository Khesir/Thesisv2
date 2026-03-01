"""
RAG Engine
Retrieval-Augmented Generation for agricultural chatbot.
"""
import os
from typing import Dict, List, Optional
from google import genai
from google.genai import types

from .crop_store import CropStore


class RAGEngine:
    """RAG Engine for agricultural Q&A"""

    def __init__(self, crop_store: CropStore, model: str = "gemini-2.5-flash"):
        self.crop_store = crop_store
        self.model_name = model
        self.client = None

        # Initialize Gemini
        api_key = os.getenv('GOOGLE_API_KEY')
        if api_key:
            self.client = genai.Client(api_key=api_key)

    def is_available(self) -> bool:
        """Check if LLM is available"""
        return self.client is not None

    def chat(
        self,
        query: str,
        conversation_history: Optional[List[dict]] = None,
        top_k: int = 3,
        include_context: bool = True,
        api_key: Optional[str] = None,
    ) -> Dict:
        """
        Process a user query with RAG, optionally continuing a conversation.

        Args:
            query: User's question
            conversation_history: List of previous turns [{"role": "user"|"model", "content": str}, ...]
            top_k: Number of crops to retrieve for context
            include_context: Whether to include retrieved context in response
            api_key: Optional custom Google API key (overrides backend default)

        Returns:
            Response dict with answer and metadata
        """
        history = conversation_history or []

        # Step 1: Resolve which client to use
        client_to_use = self.client

        if api_key:
            try:
                client_to_use = genai.Client(api_key=api_key)
            except Exception as e:
                return {
                    'answer': f"Invalid API key provided: {str(e)}\n\nPlease check your API key and try again.",
                    'crops_used': [],
                    'context': None,
                    'llm_used': False,
                    'error': f'Invalid API key: {str(e)}'
                }

        # Step 2: Reformulate vague follow-up queries into standalone search queries
        search_query = (
            self._reformulate_query(query, history, client_to_use)
            if history and client_to_use
            else query
        )

        # Step 3: Retrieve relevant crops using the (possibly reformulated) query
        search_results = self.crop_store.search(search_query, top_k=top_k)

        if not search_results:
            return {
                'answer': "I don't have information about that crop in my database. Please try asking about a different crop.",
                'crops_used': [],
                'context': None
            }

        # Step 4: Build context from retrieved crops
        context_parts = []
        crops_used = []

        for result in search_results:
            crop = result['crop']
            crops_used.append(result['name'])
            summary = self.crop_store.get_crop_summary(crop)
            context_parts.append(f"# {crop['name']}\n{summary}")

        context = '\n\n---\n\n'.join(context_parts)

        # Step 5: Fall back to raw context if no LLM available
        if not client_to_use:
            return {
                'answer': f"Here's what I found:\n\n{context}",
                'crops_used': crops_used,
                'context': context if include_context else None,
                'llm_used': False
            }

        # Step 6: Generate response with full conversation history
        contents = self._build_contents(query, context, history)

        try:
            response = client_to_use.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "You are a helpful agricultural advisor. "
                        "Answer questions based ONLY on the crop information provided in each message. "
                        "Be conversational and include specific numbers when available."
                    ),
                    temperature=0.7,
                    max_output_tokens=1024,
                )
            )

            return {
                'answer': response.text,
                'crops_used': crops_used,
                'context': context if include_context else None,
                'llm_used': True
            }

        except Exception as e:
            error_msg = str(e)
            hint = (
                "\n\nTip: The backend API key quota may be exhausted. Try providing your own API key in the request."
                if 'quota' in error_msg.lower() or 'rate limit' in error_msg.lower()
                else ""
            )

            return {
                'answer': f"Error generating response: {error_msg}{hint}\n\nHere's the raw data:\n\n{context}",
                'crops_used': crops_used,
                'context': context if include_context else None,
                'error': error_msg
            }

    def _reformulate_query(
        self,
        query: str,
        conversation_history: List[dict],
        client,
    ) -> str:
        """
        Rewrite a vague follow-up query into a standalone search query
        using the conversation history, so RAG retrieval is accurate.

        E.g. "What about fertilizer for those?" + history about rice/wheat
          → "fertilizer recommendations for rice and wheat"
        """
        # Summarise the last 3 turns (6 entries) to keep the prompt short
        recent = conversation_history[-6:]
        history_text = "\n".join(
            f"{t['role'].upper()}: {t['content']}" for t in recent
        )

        prompt = (
            "Given the conversation history below and a follow-up question, "
            "rewrite the follow-up as a concise, standalone search query that "
            "includes all relevant crop names and topics. "
            "Output ONLY the reformulated query — no explanation, no punctuation other than what's needed.\n\n"
            f"CONVERSATION HISTORY:\n{history_text}\n\n"
            f"FOLLOW-UP QUESTION: {query}\n\n"
            "STANDALONE SEARCH QUERY:"
        )

        try:
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    max_output_tokens=64,
                ),
            )
            reformulated = response.text.strip()
            return reformulated if reformulated else query
        except Exception:
            return query  # Fall back to original query on any error

    def _build_contents(
        self,
        query: str,
        context: str,
        conversation_history: List[dict],
    ) -> List[types.Content]:
        """
        Build a multi-turn contents list for Gemini.

        Previous turns are included as-is; the current user turn has the
        retrieved crop context prepended so the model always has fresh data.
        """
        contents: List[types.Content] = []

        # Replay previous turns
        for turn in conversation_history:
            contents.append(
                types.Content(
                    role=turn["role"],
                    parts=[types.Part(text=turn["content"])],
                )
            )

        # Current turn: inject RAG context alongside the question
        current_user_text = (
            f"CROP INFORMATION:\n{context}\n\n"
            f"USER QUESTION: {query}"
        )
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part(text=current_user_text)],
            )
        )

        return contents

    def get_crop_info(self, crop_name: str) -> Optional[Dict]:
        """Get detailed info about a specific crop"""
        crop = self.crop_store.get_crop(crop_name)
        if crop:
            return {
                'crop': crop,
                'summary': self.crop_store.get_crop_summary(crop)
            }
        return None
