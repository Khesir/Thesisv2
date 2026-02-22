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
        top_k: int = 3,
        include_context: bool = True,
        api_key: Optional[str] = None
    ) -> Dict:
        """
        Process a user query with RAG.

        Args:
            query: User's question
            top_k: Number of crops to retrieve for context
            include_context: Whether to include retrieved context in response
            api_key: Optional custom Google API key (overrides backend default)

        Returns:
            Response dict with answer and metadata
        """
        # Step 1: Retrieve relevant crops
        search_results = self.crop_store.search(query, top_k=top_k)

        if not search_results:
            return {
                'answer': "I don't have information about that crop in my database. Please try asking about a different crop.",
                'crops_used': [],
                'context': None
            }

        # Step 2: Build context from retrieved crops
        context_parts = []
        crops_used = []

        for result in search_results:
            crop = result['crop']
            crops_used.append(result['name'])

            summary = self.crop_store.get_crop_summary(crop)
            context_parts.append(f"# {crop['name']}\n{summary}")

        context = '\n\n---\n\n'.join(context_parts)

        # Step 3: Generate response using LLM
        # Determine which client to use (custom API key or default)
        client_to_use = self.client

        if api_key:
            # User provided a custom API key - use it for this request only
            try:
                client_to_use = genai.Client(api_key=api_key)
            except Exception as e:
                return {
                    'answer': f"Invalid API key provided: {str(e)}\n\nPlease check your API key and try again.",
                    'crops_used': crops_used,
                    'context': context if include_context else None,
                    'llm_used': False,
                    'error': f'Invalid API key: {str(e)}'
                }
        elif not self.is_available():
            # No custom key and no default backend key available
            return {
                'answer': f"Here's what I found:\n\n{context}",
                'crops_used': crops_used,
                'context': context if include_context else None,
                'llm_used': False
            }

        prompt = self._create_prompt(query, context)

        try:
            response = client_to_use.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
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
            # Check if it's a quota error
            if 'quota' in error_msg.lower() or 'rate limit' in error_msg.lower():
                hint = "\n\nTip: The backend API key quota may be exhausted. Try providing your own API key in the request."
            else:
                hint = ""

            return {
                'answer': f"Error generating response: {error_msg}{hint}\n\nHere's the raw data:\n\n{context}",
                'crops_used': crops_used,
                'context': context if include_context else None,
                'error': error_msg
            }

    def _create_prompt(self, query: str, context: str) -> str:
        """Create the prompt for the LLM"""
        return f"""You are a helpful agricultural advisor. Answer the user's question based on the crop information provided below.

CROP INFORMATION:
{context}

USER QUESTION: {query}

INSTRUCTIONS:
- Answer based ONLY on the information provided above
- Be conversational and helpful
- Include specific numbers (fertilizer rates, yields, pH ranges) when available
- Keep your response concise but informative

ANSWER:"""

    def get_crop_info(self, crop_name: str) -> Optional[Dict]:
        """Get detailed info about a specific crop"""
        crop = self.crop_store.get_crop(crop_name)
        if crop:
            return {
                'crop': crop,
                'summary': self.crop_store.get_crop_summary(crop)
            }
        return None
