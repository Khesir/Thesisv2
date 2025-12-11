# Multi-Provider LLM Architecture Guide

The Finder System now supports multiple LLM providers with automatic failover and load balancing to handle tokenization limits and extend processing sessions.

## Supported Providers

### 1. Claude (Anthropic)
- **Models**: claude-3-5-sonnet, claude-3-opus, claude-3-haiku
- **Token Limit**: 200,000 tokens
- **Cost**: ~$3-15 per 1M tokens (varies by model)
- **Best for**: High accuracy, structured output
- **Setup**: Requires ANTHROPIC_API_KEY

### 2. Google Gemini
- **Models**: gemini-1.5-pro, gemini-1.5-flash
- **Token Limit**: Up to 2,000,000 tokens
- **Cost**: Free tier available, ~$0.35-7 per 1M tokens
- **Best for**: Large documents, cost-effective processing
- **Setup**: Requires GOOGLE_API_KEY

### 3. Ollama (Local)
- **Models**: llama3.1, mistral, mixtral, phi3, etc.
- **Token Limit**: Varies (4K-128K depending on model)
- **Cost**: Free (runs locally)
- **Best for**: Privacy, offline processing, unlimited usage
- **Setup**: Install Ollama and start service

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           LLM Orchestrator                      │
│  ┌──────────────────────────────────────────┐   │
│  │  Strategy Engine                         │   │
│  │  - Failover                              │   │
│  │  - Round Robin                           │   │
│  │  - Cost Optimized                        │   │
│  │  - Performance                           │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Claude  │  │  Gemini  │  │  Ollama  │      │
│  │ Adapter  │  │ Adapter  │  │ Adapter  │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────┘
          │              │              │
          ▼              ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ Anthropic│   │  Google  │   │   Local  │
   │   API    │   │   API    │   │  Ollama  │
   └──────────┘   └──────────┘   └──────────┘
```

## Setup Instructions

### 1. Install Dependencies

```bash
# Activate virtual environment
venv\Scripts\activate

# Install/update dependencies
pip install -r requirements.txt
```

### 2. Configure Providers

Create a `.env` file with your API keys:

```bash
# Claude (recommended for best quality)
ANTHROPIC_API_KEY=sk-ant-...

# Gemini (recommended for large documents)
GOOGLE_API_KEY=AIza...

# Ollama runs locally, no API key needed
```

### 3. Install Ollama (Optional but Recommended)

For Windows:
```bash
# Download from https://ollama.ai/download
# Or use winget
winget install Ollama.Ollama
```

For Linux/Mac:
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

Start Ollama and pull a model:
```bash
ollama serve
ollama pull llama3.1
```

## Usage Examples

### Basic Usage (Auto-configured)

The system automatically detects and uses available providers:

```bash
python process_pdf_v2.py document.pdf
```

### Specify Strategy

#### Failover Strategy (Default)
Uses providers in order until one succeeds:

```bash
python process_pdf_v2.py document.pdf --strategy failover
```

#### Cost-Optimized Strategy
Prioritizes cheapest providers first (Ollama → Gemini → Claude):

```bash
python process_pdf_v2.py document.pdf --strategy cost_optimized
```

#### Performance Strategy
Prioritizes best quality/speed (Claude → Gemini → Ollama):

```bash
python process_pdf_v2.py document.pdf --strategy performance
```

#### Round Robin Strategy
Distributes load across all available providers:

```bash
python process_pdf_v2.py document.pdf --strategy round_robin
```

### Force Specific Provider

```bash
# Use only Claude
python process_pdf_v2.py document.pdf --provider claude

# Use only Gemini
python process_pdf_v2.py document.pdf --provider gemini

# Use only Ollama
python process_pdf_v2.py document.pdf --provider ollama
```

### Adjust Chunk Size

For providers with larger token limits:

```bash
# Larger chunks for Gemini
python process_pdf_v2.py document.pdf --provider gemini --chunk-size 5000

# Smaller chunks for Ollama
python process_pdf_v2.py document.pdf --provider ollama --chunk-size 500
```

## Programmatic Usage

### Basic Example

```python
from finder_system.pdf_extractor import PDFExtractor
from finder_system.text_processor import TextProcessor
from finder_system.llm_orchestrator import create_orchestrator

# Extract and process PDF
extractor = PDFExtractor()
result = extractor.extract_text("document.pdf")

processor = TextProcessor()
processed = processor.preprocess(result['content']['full_text'])

# Create orchestrator with failover strategy
orchestrator = create_orchestrator(strategy="failover")

# Extract information
extraction = orchestrator.extract_from_chunks(processed['chunks'])

if extraction.success:
    print(f"Provider used: {extraction.provider}")
    print(f"Data: {extraction.data}")
```

### Custom Provider Configuration

```python
from finder_system.llm_orchestrator import LLMOrchestrator, ProviderStrategy
from finder_system.claude_adapter import ClaudeAdapter
from finder_system.gemini_adapter import GeminiAdapter
from finder_system.ollama_adapter import OllamaAdapter

# Initialize specific providers
claude = ClaudeAdapter(model="claude-3-5-sonnet-20241022")
gemini = GeminiAdapter(model="gemini-1.5-pro")
ollama = OllamaAdapter(model="llama3.1")

# Create orchestrator with custom providers
orchestrator = LLMOrchestrator(
    providers=[claude, gemini, ollama],
    strategy=ProviderStrategy.COST_OPTIMIZED
)

# Check status
orchestrator.print_status()

# Use orchestrator
result = orchestrator.extract_from_chunks(chunks)
```

### Handle Token Limits

```python
from finder_system.text_processor import TextProcessor

processor = TextProcessor()

# Get provider's token limit
orchestrator = create_orchestrator()
available_providers = orchestrator.get_available_providers()

if available_providers:
    provider = available_providers[0]
    token_limit = provider.get_token_limit()

    # Adjust chunk size based on limit
    # Use ~20% of limit for safety
    optimal_chunk_size = int(token_limit * 0.2 / 4)  # /4 for word to token ratio
    processor.chunk_size = optimal_chunk_size

    print(f"Using chunk size: {optimal_chunk_size} tokens")
```

## Strategy Comparison

| Strategy | Best For | Behavior |
|----------|----------|----------|
| **Failover** | Reliability | Try providers in order until success |
| **Round Robin** | Load distribution | Rotate through providers evenly |
| **Cost Optimized** | Budget-conscious | Use cheapest provider first |
| **Performance** | Quality-first | Use best provider first |

## Cost Comparison

Approximate costs for a 50-page agricultural document:

| Provider | Model | Cost | Processing Time |
|----------|-------|------|----------------|
| Ollama | llama3.1 | $0 | 5-15 min (CPU) |
| Gemini | gemini-1.5-flash | ~$0.05 | 30-60 sec |
| Claude | claude-3-5-sonnet | ~$0.50 | 20-40 sec |

## Troubleshooting

### No Providers Available

```
⚠️ Warning: No LLM providers available!
```

**Solution**: Configure at least one provider:
1. Set `ANTHROPIC_API_KEY` for Claude
2. Set `GOOGLE_API_KEY` for Gemini
3. Install and start Ollama

### Provider Timeout

```
Ollama request timeout. The model might be too slow...
```

**Solution**:
- Use smaller chunk sizes: `--chunk-size 500`
- Switch to faster provider: `--provider claude`
- Use GPU-accelerated Ollama if available

### Token Limit Exceeded

```
Error: Input too long for model
```

**Solution**:
- Reduce chunk size
- Switch to provider with larger limit (Gemini)
- Process document in smaller sections

### API Rate Limits

If you hit API rate limits with one provider, the orchestrator will automatically failover to the next available provider.

## Best Practices

1. **Configure Multiple Providers**: Have at least 2 providers configured for redundancy

2. **Match Strategy to Use Case**:
   - Research/Testing: `cost_optimized`
   - Production/Critical: `performance`
   - High Volume: `round_robin`

3. **Optimize Chunk Sizes**:
   - Claude/Gemini: 1000-2000 tokens
   - Ollama (CPU): 300-500 tokens
   - Ollama (GPU): 1000-1500 tokens

4. **Monitor Costs**:
   - Start with `cost_optimized` strategy
   - Use Ollama for development
   - Reserve Claude/Gemini for production

5. **Handle Failures Gracefully**:
   - The orchestrator handles failover automatically
   - Check `result.provider` to see which provider was used
   - Log errors for debugging

## API Key Management

### Get API Keys

**Claude**: https://console.anthropic.com/
**Gemini**: https://makersuite.google.com/app/apikey

### Security Best Practices

1. Never commit `.env` file to version control
2. Use environment variables in production
3. Rotate API keys regularly
4. Monitor usage and set spending limits

## Performance Tips

1. **Use Gemini for Large Documents**: 2M token limit handles very large PDFs
2. **Use Ollama for Privacy**: No data sent to external APIs
3. **Use Claude for Accuracy**: Best structured output quality
4. **Batch Processing**: Use `round_robin` to distribute load
5. **Cache Results**: Save extracted JSON to avoid re-processing

## Next Steps

- Experiment with different strategies
- Test with your agricultural PDFs
- Monitor costs and adjust provider priority
- Consider setting up Ollama with GPU for faster local processing

For more details, see:
- `README_FINDER.md` - Full system documentation
- `example_usage.py` - Code examples
- `llm_interface.py` - Adapter interface details
