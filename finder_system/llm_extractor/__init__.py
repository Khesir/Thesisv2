"""
LLM Extractor Module
Provides multi-provider LLM extraction with adapter pattern
"""

# Base interfaces and data classes
from .llm_interface import (
    LLMExtractorInterface,
    BaseLLMExtractor,
    ExtractionResult,
    ChunkExtractionResult,
)

# Adapter implementations
from .adapter import (
    ClaudeAdapter,
    GeminiAdapter,
    OllamaAdapter,
)

# Legacy single-provider extractor (if exists)
try:
    from .llm_extractor import LLMExtractor
except ImportError:
    LLMExtractor = None

__all__ = [
    # Interfaces
    'LLMExtractorInterface',
    'BaseLLMExtractor',
    'ExtractionResult',
    'ChunkExtractionResult',

    # Adapters
    'ClaudeAdapter',
    'GeminiAdapter',
    'OllamaAdapter',

    # Legacy
    'LLMExtractor',
]
