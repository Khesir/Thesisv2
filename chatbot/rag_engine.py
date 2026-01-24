"""
RAG Engine
Retrieval-Augmented Generation for agricultural chatbot.
"""
import os
from typing import Dict, List, Optional
import google.generativeai as genai

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
            genai.configure(api_key=api_key)
            self.client = genai.GenerativeModel(self.model_name)

    def is_available(self) -> bool:
        """Check if LLM is available"""
        return self.client is not None

    def chat(
        self,
        query: str,
        top_k: int = 3,
        include_context: bool = True
    ) -> Dict:
        """
        Process a user query with RAG.

        Args:
            query: User's question
            top_k: Number of crops to retrieve for context
            include_context: Whether to include retrieved context in response

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
            context_parts.append(summary)

        context = '\n\n---\n\n'.join(context_parts)

        # Step 3: Generate response using LLM
        if not self.is_available():
            # Fallback: return raw context if LLM not available
            return {
                'answer': f"Here's what I found:\n\n{context}",
                'crops_used': crops_used,
                'context': context if include_context else None,
                'llm_used': False
            }

        prompt = self._create_prompt(query, context)

        try:
            response = self.client.generate_content(
                prompt,
                generation_config={
                    'temperature': 0.7,
                    'max_output_tokens': 1024,
                }
            )

            return {
                'answer': response.text,
                'crops_used': crops_used,
                'context': context if include_context else None,
                'llm_used': True
            }

        except Exception as e:
            return {
                'answer': f"Error generating response: {str(e)}\n\nHere's the raw data:\n\n{context}",
                'crops_used': crops_used,
                'context': context if include_context else None,
                'error': str(e)
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
- If the information doesn't fully answer the question, say what you know and note what's missing
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
