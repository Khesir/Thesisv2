# LLM Extractor Module

This module provides a flexible, multi-provider architecture for LLM-based information extraction using the Adapter Pattern.

## Structure

```
llm_extractor/
├── __init__.py              # Module exports
├── llm_interface.py         # Abstract interfaces and base classes
├── llm_extractor.py         # Legacy single-provider (deprecated)
└── adapter/
    ├── __init__.py          # Adapter exports
    ├── claude_adapter.py    # Anthropic Claude implementation
    ├── gemini_adapter.py    # Google Gemini implementation
    └── ollama_adapter.py    # Local Ollama implementation
```

## Usage

### Quick Import

```python
# Clean imports with __init__.py
from finder_system.llm_extractor import (
    ClaudeAdapter,
    GeminiAdapter,
    OllamaAdapter,
    LLMExtractorInterface,
    ExtractionResult
)
```

### Using Individual Adapters

```python
from finder_system.llm_extractor import ClaudeAdapter

# Initialize adapter
claude = ClaudeAdapter(api_key="your_key", model="claude-3-5-sonnet-20241022")

# Check availability
if claude.is_available():
    print(f"Token limit: {claude.get_token_limit()}")

# Extract from text
result = claude.extract_from_text("agricultural text here...")

if result.success:
    print(result.data)
```

### Using with Orchestrator

```python
from finder_system.llm_orchestrator import create_orchestrator

# Auto-configure with available providers
orchestrator = create_orchestrator(strategy="failover")

# Extract from chunks
result = orchestrator.extract_from_chunks(chunks)
```

## Components

### 1. Abstract Interface (`llm_interface.py`)

**Classes:**
- `LLMExtractorInterface`: Abstract base class defining the contract
- `BaseLLMExtractor`: Base implementation with common functionality
- `ExtractionResult`: Standardized result for single extraction
- `ChunkExtractionResult`: Standardized result for multi-chunk extraction

**Key Methods:**
```python
get_provider_name() -> str
is_available() -> bool
get_token_limit() -> int
extract_from_text(text: str) -> ExtractionResult
extract_from_chunks(chunks: List[Dict]) -> ChunkExtractionResult
```

### 2. Adapters (`adapter/`)

#### Claude Adapter
```python
from finder_system.llm_extractor import ClaudeAdapter

adapter = ClaudeAdapter(
    api_key="sk-ant-...",  # or set ANTHROPIC_API_KEY
    model="claude-3-5-sonnet-20241022"
)
```

**Features:**
- Token Limit: 200,000
- Best for: High accuracy, structured output
- Requires: `ANTHROPIC_API_KEY`

#### Gemini Adapter
```python
from finder_system.llm_extractor import GeminiAdapter

adapter = GeminiAdapter(
    api_key="AIza...",  # or set GOOGLE_API_KEY
    model="gemini-1.5-pro"
)
```

**Features:**
- Token Limit: 2,000,000
- Best for: Large documents
- Requires: `GOOGLE_API_KEY`

#### Ollama Adapter
```python
from finder_system.llm_extractor import OllamaAdapter

adapter = OllamaAdapter(
    model="llama3.1",
    base_url="http://localhost:11434"
)
```

**Features:**
- Token Limit: 4K-128K (model dependent)
- Best for: Privacy, offline, free
- Requires: Ollama service running

## Creating Custom Adapters

To add a new LLM provider:

```python
from finder_system.llm_extractor import BaseLLMExtractor, ExtractionResult

class MyCustomAdapter(BaseLLMExtractor):
    def __init__(self, api_key=None, **kwargs):
        self.api_key = api_key
        # Initialize your provider

    def get_provider_name(self) -> str:
        return "my_provider"

    def is_available(self) -> bool:
        # Check if provider is configured
        return self.api_key is not None

    def get_token_limit(self) -> int:
        return 100000

    def extract_from_text(self, text: str) -> ExtractionResult:
        # Implement extraction logic
        try:
            # Your API call here
            result = your_api_call(text)

            return ExtractionResult(
                success=True,
                data=result,
                provider=self.get_provider_name()
            )
        except Exception as e:
            return ExtractionResult(
                success=False,
                error=str(e),
                provider=self.get_provider_name()
            )

    def extract_from_chunks(self, chunks, combine_results=True):
        # Use base implementation or override
        return super().extract_from_chunks(chunks, combine_results)
```

Then register it:

```python
# Add to adapter/__init__.py
from .my_custom_adapter import MyCustomAdapter

__all__ = [
    'ClaudeAdapter',
    'GeminiAdapter',
    'OllamaAdapter',
    'MyCustomAdapter',  # Add your adapter
]
```

## Import Examples

### Option 1: Import from llm_extractor (Recommended)
```python
from finder_system.llm_extractor import ClaudeAdapter, GeminiAdapter
```

### Option 2: Import from adapter submodule
```python
from finder_system.llm_extractor.adapter import ClaudeAdapter, GeminiAdapter
```

### Option 3: Direct import (verbose)
```python
from finder_system.llm_extractor.adapter.claude_adapter import ClaudeAdapter
```

All three methods work, but **Option 1** is cleanest thanks to the `__init__.py` files.

## Benefits of This Structure

1. **Clean Imports**: Use `from finder_system.llm_extractor import ClaudeAdapter`
2. **Organized Code**: Adapters in their own folder
3. **Easy Extension**: Add new adapters without touching existing code
4. **Clear Interface**: All adapters implement the same interface
5. **Encapsulation**: Internal details hidden behind clean API

## Integration with Orchestrator

The orchestrator uses these adapters automatically:

```python
from finder_system.llm_orchestrator import create_orchestrator

# Auto-detects and configures all available adapters
orchestrator = create_orchestrator()

# Orchestrator internally uses:
# - ClaudeAdapter (if ANTHROPIC_API_KEY is set)
# - GeminiAdapter (if GOOGLE_API_KEY is set)
# - OllamaAdapter (if Ollama service is running)
```

## Testing Adapters

```python
# Test individual adapter
from finder_system.llm_extractor import ClaudeAdapter

adapter = ClaudeAdapter()
print(f"Available: {adapter.is_available()}")
print(f"Provider: {adapter.get_provider_name()}")
print(f"Token Limit: {adapter.get_token_limit():,}")

# Test extraction
sample_text = "Rice grows in tropical climates..."
result = adapter.extract_from_text(sample_text)

if result.success:
    print(f"Provider used: {result.provider}")
    print(f"Data: {result.data}")
else:
    print(f"Error: {result.error}")
```

## See Also

- `../llm_orchestrator.py` - Multi-provider orchestration
- `../../MULTI_PROVIDER_GUIDE.md` - Complete usage guide
- `../../ARCHITECTURE_SUMMARY.md` - Architecture details
