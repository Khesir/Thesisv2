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


def _score_gemini_model(name: str) -> tuple:
    """
    Score a Gemini model name for ranking. Higher score = better/newer model.
    Prefers stable flash models, avoids preview/exp/legacy variants.

    Returns a tuple used for sorting: (major, minor, tier, is_stable)
    """
    import re

    # Tier scores: flash > flash-lite > pro (pro is slower/costlier for bulk extraction)
    tier_score = 0
    if 'flash-lite' in name:
        tier_score = 1
    elif 'flash' in name:
        tier_score = 2
    elif 'pro' in name:
        tier_score = 0

    # Stability: prefer stable over preview/exp
    is_stable = 0 if any(s in name for s in ('preview', 'exp', 'experimental', 'rc')) else 1

    # Parse version number (e.g. gemini-2.5-flash → major=2, minor=5)
    match = re.search(r'gemini-(\d+)\.(\d+)', name)
    major = int(match.group(1)) if match else 0
    minor = int(match.group(2)) if match else 0

    return (major, minor, tier_score, is_stable)


class GeminiAdapter(BaseLLMExtractor):
    """Adapter for Google's Gemini API"""

    # Class-level cache so model detection runs only once per process
    _auto_model_cache: Optional[str] = None

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize Gemini adapter

        Args:
            api_key: Google API key (or set GOOGLE_API_KEY env var)
            model: Gemini model to use. If None, auto-detects the best available model.
            **kwargs: Additional configuration options
        """
        self.api_key = api_key or os.getenv('GOOGLE_API_KEY')
        self.client = None

        # Initialize client first so we can call list_models for auto-detection
        if self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                # Auto-detect model if not explicitly provided
                if model is None:
                    model = self._detect_best_model()
                self.model_name = model
                self.client = genai.GenerativeModel(self.model_name)
            except Exception:
                self.model_name = model or "gemini-2.5-flash-lite"
        else:
            self.model_name = model or "gemini-2.5-flash-lite"

    @classmethod
    def _detect_best_model(cls) -> str:
        """
        Query the Gemini API for available models and pick the best one.
        Result is cached at the class level so it only runs once per process.
        Falls back to 'gemini-2.5-flash-lite' if detection fails.
        """
        if cls._auto_model_cache is not None:
            return cls._auto_model_cache

        fallback = "gemini-2.5-flash-lite"
        try:
            available = [
                m.name.replace("models/", "")
                for m in genai.list_models()
                if "generateContent" in (m.supported_generation_methods or [])
                and "gemini" in m.name.lower()
            ]

            if not available:
                return fallback

            # Rank and pick the best model
            best = max(available, key=_score_gemini_model)
            cls._auto_model_cache = best
            return best
        except Exception:
            return fallback

    def get_provider_name(self) -> str:
        """Get provider name"""
        return "gemini"

    def is_available(self) -> bool:
        """Check if Gemini is available"""
        return self.client is not None and self.api_key is not None

    def get_token_limit(self) -> int:
        """Get token limit for current model. All modern Gemini models support 1M tokens."""
        # Legacy small models
        if self.model_name == 'gemini-pro':
            return 32000
        if self.model_name == 'gemini-1.5-flash':
            return 1000000
        # All gemini-1.5+, 2.x, 3.x models support 1M+ context
        return 1048576

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
                error_msg = f"Model '{self.model_name}' not found. Try 'gemini-2.5-flash-lite', 'gemini-2.5-flash', or 'gemini-2.0-flash'. Run 'python check_gemini_models.py' to see available models."
            elif 'API key' in error_msg or '401' in error_msg or 'authentication' in error_msg.lower():
                error_msg = f"Invalid or expired API key: {error_msg}"
            elif 'quota' in error_msg.lower() or '429' in error_msg or 'resource_exhausted' in error_msg.lower():
                error_msg = f"API quota exceeded or rate limited: {error_msg}"
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
        errors = []
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
            else:
                errors.append(f"chunk {chunk_id}: {extraction_result.error}")

        if not results:
            last_error = errors[-1] if errors else "Unknown error"
            return ChunkExtractionResult(
                success=False,
                error=f"Failed to extract data from any chunks. {last_error}",
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
