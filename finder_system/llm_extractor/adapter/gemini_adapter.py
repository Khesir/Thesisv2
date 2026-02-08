"""
Google Gemini Adapter
Implements LLM extraction using Google's Gemini API
"""
import json
import os
import re
from typing import Dict, List, Optional
import google.generativeai as genai

from ..llm_interface import (
    BaseLLMExtractor,
    ExtractionResult,
    ChunkExtractionResult
)


def repair_json(text: str) -> str:
    """
    Attempt to repair common JSON issues from LLM output.

    Args:
        text: Potentially malformed JSON string

    Returns:
        Repaired JSON string
    """
    # Remove any leading/trailing whitespace
    text = text.strip()

    # Remove markdown code blocks if present
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    # Find the JSON object boundaries
    start_idx = text.find('{')
    if start_idx == -1:
        return text

    # Count brackets to find the proper end
    bracket_count = 0
    end_idx = -1
    in_string = False
    escape_next = False

    for i, char in enumerate(text[start_idx:], start_idx):
        if escape_next:
            escape_next = False
            continue
        if char == '\\':
            escape_next = True
            continue
        if char == '"' and not escape_next:
            in_string = not in_string
            continue
        if not in_string:
            if char == '{':
                bracket_count += 1
            elif char == '}':
                bracket_count -= 1
                if bracket_count == 0:
                    end_idx = i
                    break

    # If we found valid boundaries, extract just that part
    if end_idx > start_idx:
        text = text[start_idx:end_idx + 1]
    else:
        # Try to fix unclosed JSON by adding closing brackets
        text = text[start_idx:]
        # Count open vs close brackets
        open_braces = text.count('{') - text.count('}')
        open_brackets = text.count('[') - text.count(']')

        # Add missing closing brackets
        text = text + (']' * open_brackets) + ('}' * open_braces)

    # Fix common issues

    # Remove trailing commas before ] or }
    text = re.sub(r',\s*([}\]])', r'\1', text)

    # Fix unescaped quotes inside strings (common LLM issue)
    # This is tricky - we try to fix obvious cases

    # Fix missing commas between array elements or object properties
    # Pattern: }" followed by "{ or "[ or string
    text = re.sub(r'}\s*{', '},{', text)
    text = re.sub(r']\s*\[', '],[', text)
    text = re.sub(r'"\s*"', '","', text)

    # Fix missing comma after values before new keys
    text = re.sub(r'(null|true|false|\d+)\s*"', r'\1,"', text)

    return text


def safe_json_parse(text: str) -> Dict:
    """
    Safely parse JSON with multiple fallback strategies.

    Args:
        text: JSON string to parse

    Returns:
        Parsed dictionary

    Raises:
        json.JSONDecodeError: If all parsing attempts fail
    """
    # Strategy 1: Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy 2: Repair and parse
    try:
        repaired = repair_json(text)
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    # Strategy 3: Extract from markdown code block
    if "```" in text:
        try:
            if "```json" in text:
                json_start = text.find("```json") + 7
            else:
                json_start = text.find("```") + 3
            json_end = text.find("```", json_start)
            if json_end > json_start:
                extracted = text[json_start:json_end].strip()
                repaired = repair_json(extracted)
                return json.loads(repaired)
        except json.JSONDecodeError:
            pass

    # Strategy 4: Find and extract JSON object
    try:
        # Find first { and try to extract valid JSON from there
        start = text.find('{')
        if start >= 0:
            # Try progressively shorter substrings
            for end in range(len(text), start, -1):
                try:
                    substr = text[start:end]
                    repaired = repair_json(substr)
                    result = json.loads(repaired)
                    if isinstance(result, dict):
                        return result
                except:
                    continue
    except:
        pass

    # All strategies failed, raise the original error
    raise json.JSONDecodeError("Failed to parse JSON after all repair attempts", text, 0)


class GeminiAdapter(BaseLLMExtractor):
    """Adapter for Google's Gemini API"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-2.5-flash",
        **kwargs
    ):
        """
        Initialize Gemini adapter

        Args:
            api_key: Google API key (or set GOOGLE_API_KEY env var)
            model: Gemini model to use
            **kwargs: Additional configuration options
        """
        self.api_key = api_key or os.getenv('GOOGLE_API_KEY')
        self.model_name = model
        self.client = None

        # Token limits for different Gemini models
        self.token_limits = {
            # Gemini 2.5 (newer, stable)
            'gemini-2.5-pro': 1048576,
            'gemini-2.5-flash': 1048576,
            # Gemini 2.0
            'gemini-2.0-flash': 1048576,
            'gemini-2.0-flash-exp': 1048576,
            # Legacy 1.5 models (if available)
            'gemini-1.5-pro': 2000000,
            'gemini-1.5-flash': 1000000,
            'gemini-pro': 32000,
        }
        # Initialize client if API key is available
        if self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.client = genai.GenerativeModel(self.model_name)
            except Exception:
                pass

    def get_provider_name(self) -> str:
        """Get provider name"""
        return "gemini"

    def is_available(self) -> bool:
        """Check if Gemini is available"""
        return self.client is not None and self.api_key is not None

    def get_token_limit(self) -> int:
        """Get token limit for current model"""
        return self.token_limits.get(self.model_name, 32760)

    def extract_from_text(
        self,
        text: str,
        max_tokens: Optional[int] = None
    ) -> ExtractionResult:
        """
        Extract agricultural information using Gemini

        Args:
            text: Text to analyze
            max_tokens: Maximum tokens for response

        Returns:
            ExtractionResult object
        """
        if not self.is_available():
            return ExtractionResult(
                success=False,
                error="Gemini API not configured. Set GOOGLE_API_KEY environment variable.",
                provider=self.get_provider_name()
            )

        try:
            prompt = self.create_extraction_prompt(text)

            # Configure generation settings with JSON mode
            generation_config = {
                'temperature': 0.1,
                'max_output_tokens': max_tokens or 8192,
                'response_mime_type': 'application/json',  # Force JSON output
            }

            response = self.client.generate_content(
                prompt,
                generation_config=generation_config
            )

            # Extract the text content from response
            response_text = response.text

            # Parse JSON response with robust error handling
            extracted_data = safe_json_parse(response_text)

            # Get token usage if available
            usage = {}
            if hasattr(response, 'usage_metadata'):
                usage = {
                    'input_tokens': response.usage_metadata.prompt_token_count,
                    'output_tokens': response.usage_metadata.candidates_token_count,
                    'total_tokens': response.usage_metadata.total_token_count
                }
            else:
                # Estimate if not available
                estimated_input = len(prompt.split()) * 1.3
                estimated_output = len(response_text.split()) * 1.3
                usage = {
                    'input_tokens': int(estimated_input),
                    'output_tokens': int(estimated_output),
                    'total_tokens': int(estimated_input + estimated_output),
                    'estimated': True
                }

            return ExtractionResult(
                success=True,
                data=extracted_data,
                provider=self.get_provider_name(),
                model=self.model_name,
                usage=usage
            )

        except json.JSONDecodeError as e:
            return ExtractionResult(
                success=False,
                error=f'Failed to parse JSON response: {str(e)}',
                provider=self.get_provider_name(),
                raw_response=response_text if 'response_text' in locals() else None
            )
        except Exception as e:
            error_msg = str(e)

            # Provide helpful error messages for common issues
            if '404' in error_msg and 'not found' in error_msg:
                error_msg = f"Model '{self.model_name}' not found. Try 'gemini-2.5-flash', 'gemini-2.5-pro', or 'gemini-2.0-flash'. Run 'python check_gemini_models.py' to see available models."
            elif 'API key' in error_msg:
                error_msg = "Invalid or missing API key. Check GOOGLE_API_KEY in .env file."
            elif 'quota' in error_msg.lower():
                error_msg = "API quota exceeded. Check your usage at https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com"
            else:
                error_msg = f'Gemini extraction failed: {error_msg}'

            return ExtractionResult(
                success=False,
                error=error_msg,
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
                error="Gemini API not configured",
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
