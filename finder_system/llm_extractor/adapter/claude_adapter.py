"""
Claude (Anthropic) Adapter
Implements LLM extraction using Anthropic's Claude API
"""
import json
import os
from typing import Dict, List, Optional
from anthropic import Anthropic

from ..llm_interface import (
    BaseLLMExtractor,
    ExtractionResult,
    ChunkExtractionResult
)


class ClaudeAdapter(BaseLLMExtractor):
    """Adapter for Anthropic's Claude API"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "claude-3-5-sonnet-20241022",
        **kwargs
    ):
        """
        Initialize Claude adapter

        Args:
            api_key: Anthropic API key (or set ANTHROPIC_API_KEY env var)
            model: Claude model to use
            **kwargs: Additional configuration options
        """
        self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
        self.model = model
        self.client = None

        # Token limits for different Claude models
        self.token_limits = {
            'claude-3-5-sonnet-20241022': 200000,
            'claude-3-opus-20240229': 200000,
            'claude-3-sonnet-20240229': 200000,
            'claude-3-haiku-20240307': 200000,
        }

        # Initialize client if API key is available
        if self.api_key:
            try:
                self.client = Anthropic(api_key=self.api_key)
            except Exception as e:
                print(f"Warning: Failed to initialize Claude client: {e}")

    def get_provider_name(self) -> str:
        """Get provider name"""
        return "claude"

    def is_available(self) -> bool:
        """Check if Claude is available"""
        return self.client is not None and self.api_key is not None

    def get_token_limit(self) -> int:
        """Get token limit for current model"""
        return self.token_limits.get(self.model, 200000)

    def extract_from_text(
        self,
        text: str,
        max_tokens: Optional[int] = None
    ) -> ExtractionResult:
        """
        Extract agricultural information using Claude

        Args:
            text: Text to analyze
            max_tokens: Maximum tokens for response

        Returns:
            ExtractionResult object
        """
        if not self.is_available():
            return ExtractionResult(
                success=False,
                error="Claude API not configured. Set ANTHROPIC_API_KEY environment variable.",
                provider=self.get_provider_name()
            )

        try:
            prompt = self.create_extraction_prompt(text)

            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens or 4096,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            # Extract the text content from response
            response_text = response.content[0].text

            # Parse JSON response
            try:
                extracted_data = json.loads(response_text)
            except json.JSONDecodeError as e:
                # Try to extract JSON from markdown code blocks
                if "```json" in response_text:
                    json_start = response_text.find("```json") + 7
                    json_end = response_text.find("```", json_start)
                    response_text = response_text[json_start:json_end].strip()
                    extracted_data = json.loads(response_text)
                else:
                    raise e

            return ExtractionResult(
                success=True,
                data=extracted_data,
                provider=self.get_provider_name(),
                model=self.model,
                usage={
                    'input_tokens': response.usage.input_tokens,
                    'output_tokens': response.usage.output_tokens,
                    'total_tokens': response.usage.input_tokens + response.usage.output_tokens
                }
            )

        except json.JSONDecodeError as e:
            return ExtractionResult(
                success=False,
                error=f'Failed to parse JSON response: {str(e)}',
                provider=self.get_provider_name(),
                raw_response=response_text if 'response_text' in locals() else None
            )
        except Exception as e:
            return ExtractionResult(
                success=False,
                error=f'Claude extraction failed: {str(e)}',
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
                error="Claude API not configured",
                provider=self.get_provider_name()
            )

        results = []
        total_input_tokens = 0
        total_output_tokens = 0

        for chunk in chunks:
            chunk_text = chunk.get('text', '')
            chunk_id = chunk.get('chunk_id', 0)

            print(f"[Claude] Processing chunk {chunk_id + 1}/{len(chunks)}...")

            extraction_result = self.extract_from_text(chunk_text)

            if extraction_result.success:
                results.append({
                    'chunk_id': chunk_id,
                    'data': extraction_result.data,
                    'usage': extraction_result.usage
                })
                total_input_tokens += extraction_result.usage['input_tokens']
                total_output_tokens += extraction_result.usage['output_tokens']
            else:
                print(f"Warning: Chunk {chunk_id} extraction failed: {extraction_result.error}")

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
                    'total_tokens': total_input_tokens + total_output_tokens
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
                    'total_tokens': total_input_tokens + total_output_tokens
                },
                provider=self.get_provider_name()
            )
