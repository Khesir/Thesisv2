"""
Ollama Adapter
Implements LLM extraction using local Ollama models
"""
import json
import requests
from typing import Dict, List, Optional

from ..llm_interface import (
    BaseLLMExtractor,
    ExtractionResult,
    ChunkExtractionResult
)


class OllamaAdapter(BaseLLMExtractor):
    """Adapter for local Ollama models"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "llama3.1",
        base_url: str = "http://localhost:11434",
        **kwargs
    ):
        """
        Initialize Ollama adapter

        Args:
            api_key: Not used for Ollama (kept for interface compatibility)
            model: Ollama model to use (e.g., 'llama3.1', 'mistral', 'mixtral')
            base_url: Ollama API base URL
            **kwargs: Additional configuration options
        """
        self.model = model
        self.base_url = base_url.rstrip('/')
        self.api_endpoint = f"{self.base_url}/api/generate"

        # Token limits for common Ollama models (approximate)
        self.token_limits = {
            'llama3.1': 128000,
            'llama3': 8192,
            'llama2': 4096,
            'mistral': 8192,
            'mixtral': 32768,
            'phi3': 128000,
            'gemma': 8192,
        }

    def get_provider_name(self) -> str:
        """Get provider name"""
        return "ollama"

    def is_available(self) -> bool:
        """Check if Ollama is available"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=2)
            return response.status_code == 200
        except:
            return False

    def get_token_limit(self) -> int:
        """Get token limit for current model"""
        # Extract base model name (e.g., 'llama3.1' from 'llama3.1:latest')
        base_model = self.model.split(':')[0]
        return self.token_limits.get(base_model, 8192)

    def extract_from_text(
        self,
        text: str,
        max_tokens: Optional[int] = None
    ) -> ExtractionResult:
        """
        Extract agricultural information using Ollama

        Args:
            text: Text to analyze
            max_tokens: Maximum tokens for response

        Returns:
            ExtractionResult object
        """
        if not self.is_available():
            return ExtractionResult(
                success=False,
                error=f"Ollama not available at {self.base_url}. Make sure Ollama is running.",
                provider=self.get_provider_name()
            )

        try:
            prompt = self.create_extraction_prompt(text)

            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "format": "json"  # Request JSON output
            }

            response = requests.post(
                self.api_endpoint,
                json=payload,
                timeout=120  # Ollama can be slow on CPU
            )

            if response.status_code != 200:
                return ExtractionResult(
                    success=False,
                    error=f"Ollama API error: {response.status_code} - {response.text}",
                    provider=self.get_provider_name()
                )

            response_data = response.json()
            response_text = response_data.get('response', '')

            # Parse JSON response
            try:
                extracted_data = json.loads(response_text)
            except json.JSONDecodeError as e:
                # Try to extract JSON from the response
                if "```json" in response_text:
                    json_start = response_text.find("```json") + 7
                    json_end = response_text.find("```", json_start)
                    response_text = response_text[json_start:json_end].strip()
                    extracted_data = json.loads(response_text)
                elif "{" in response_text and "}" in response_text:
                    # Try to extract JSON object
                    json_start = response_text.find("{")
                    json_end = response_text.rfind("}") + 1
                    response_text = response_text[json_start:json_end]
                    extracted_data = json.loads(response_text)
                else:
                    raise e

            # Calculate approximate token usage (Ollama doesn't provide exact counts)
            estimated_input_tokens = len(prompt.split()) * 1.3  # Rough estimate
            estimated_output_tokens = len(response_text.split()) * 1.3

            return ExtractionResult(
                success=True,
                data=extracted_data,
                provider=self.get_provider_name(),
                model=self.model,
                usage={
                    'input_tokens': int(estimated_input_tokens),
                    'output_tokens': int(estimated_output_tokens),
                    'total_tokens': int(estimated_input_tokens + estimated_output_tokens),
                    'estimated': True  # Flag that these are estimates
                }
            )

        except json.JSONDecodeError as e:
            return ExtractionResult(
                success=False,
                error=f'Failed to parse JSON response: {str(e)}',
                provider=self.get_provider_name(),
                raw_response=response_text if 'response_text' in locals() else None
            )
        except requests.Timeout:
            return ExtractionResult(
                success=False,
                error='Ollama request timeout. The model might be too slow or the text too long.',
                provider=self.get_provider_name()
            )
        except Exception as e:
            return ExtractionResult(
                success=False,
                error=f'Ollama extraction failed: {str(e)}',
                provider=self.get_provider_name()
            )

    def extract_from_chunks(
        self,
        chunks: List[Dict],
        combine_results: bool = True
    ) -> ChunkExtractionResult:
        """
        Extract information from multiple text chunks

        Args:
            chunks: List of text chunks with metadata
            combine_results: Whether to combine results from all chunks

        Returns:
            ChunkExtractionResult object
        """
        if not self.is_available():
            return ChunkExtractionResult(
                success=False,
                error="Ollama not available",
                provider=self.get_provider_name()
            )

        results = []
        total_input_tokens = 0
        total_output_tokens = 0

        for chunk in chunks:
            chunk_text = chunk.get('text', '')
            chunk_id = chunk.get('chunk_id', 0)

            extraction_result = self.extract_from_text(chunk_text)

            if extraction_result.success:
                results.append({
                    'chunk_id': chunk_id,
                    'data': extraction_result.data,
                    'usage': extraction_result.usage
                })
                total_input_tokens += extraction_result.usage['input_tokens']
                total_output_tokens += extraction_result.usage['output_tokens']

        if not results:
            return ChunkExtractionResult(
                success=False,
                error="Failed to extract data from any chunks",
                provider=self.get_provider_name()
            )

        if combine_results:
            combined_data = self._combine_chunk_results(results)
            return ChunkExtractionResult(
                success=True,
                data=combined_data,
                total_chunks_processed=len(results),
                total_usage={
                    'input_tokens': total_input_tokens,
                    'output_tokens': total_output_tokens,
                    'total_tokens': total_input_tokens + total_output_tokens,
                    'estimated': True
                },
                provider=self.get_provider_name()
            )
        else:
            return ChunkExtractionResult(
                success=True,
                chunk_results=results,
                total_chunks_processed=len(results),
                total_usage={
                    'input_tokens': total_input_tokens,
                    'output_tokens': total_output_tokens,
                    'total_tokens': total_input_tokens + total_output_tokens,
                    'estimated': True
                },
                provider=self.get_provider_name()
            )
