# Ollama Quick Start Guide

Get started with **free, local** LLM processing using Ollama!

## Why Use Ollama?

✅ **Free** - No API costs, unlimited usage
✅ **Private** - Data stays on your machine
✅ **Offline** - Works without internet
✅ **No rate limits** - Process as much as you want

## Installation (5 minutes)

### Windows
1. Download: https://ollama.ai/download/windows
2. Run the installer
3. Ollama starts automatically

### Linux
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve
```

### Mac
1. Download: https://ollama.ai/download/mac
2. Open the DMG and install
3. Ollama runs in background

## Quick Setup

### 1. Pull a Model
```bash
# Recommended: Llama 3.1 (8B)
ollama pull llama3.1

# Check it downloaded
ollama list
```

### 2. Test the Model
```bash
ollama run llama3.1 "Explain agriculture in one sentence"
# Press Ctrl+D to exit
```

### 3. Use with Finder System
```bash
python test_ollama.py
```

If successful, you'll see:
```
✓ Ollama is running!
✓ Extraction successful!
```

## Using Ollama with Your PDFs

### Basic Usage
```bash
python main.py your_document.pdf --provider ollama
```

### Optimized for Speed
```bash
# Use smaller chunks for faster processing
python main.py document.pdf --provider ollama --chunk-size 500
```

### Cost-Optimized Strategy
```bash
# Uses Ollama first, falls back to cloud if needed
python main.py document.pdf --strategy cost_optimized
```

## Recommended Models

| Model | Size | RAM Needed | Best For |
|-------|------|------------|----------|
| **llama3.1** | 4.7GB | 8GB | Balanced (recommended) |
| **phi3** | 2.3GB | 4GB | Fast, small docs |
| **mistral** | 4.1GB | 8GB | Fast, good quality |
| **gemma2** | 5.4GB | 8GB | Google model |
| **mixtral** | 26GB | 32GB | High quality (slow) |

### Pull Different Models
```bash
ollama pull phi3        # Fastest, smallest
ollama pull mistral     # Fast and good
ollama pull gemma2      # Google's model
```

## Using Different Models

### In Code
```python
from finder_system.llm_extractor import OllamaAdapter

# Use Mistral instead of Llama
ollama = OllamaAdapter(model="mistral")

result = ollama.extract_from_text("your text here...")
```

### In Main Script
Currently `main.py` uses the default model. To change it, you can:

1. **Temporary test** - Edit the adapter:
```python
# In llm_orchestrator.py, find OllamaAdapter() and add:
ollama = OllamaAdapter(model="phi3")  # Change model here
```

2. **Or create custom script**:
```python
from finder_system.llm_extractor import OllamaAdapter
from finder_system.pdf_extractor import PDFExtractor
from finder_system.text_processor import TextProcessor

# Use specific model
ollama = OllamaAdapter(model="phi3")

# Process PDF
extractor = PDFExtractor()
result = extractor.extract_text("document.pdf")

processor = TextProcessor()
processed = processor.preprocess(result['content']['full_text'])

# Extract
extraction = ollama.extract_from_chunks(processed['chunks'])
print(extraction.data)
```

## Performance Tuning

### For CPU (No GPU)
```bash
# Use smallest, fastest model
ollama pull phi3

# Use small chunks
python main.py doc.pdf --provider ollama --chunk-size 300
```

### For GPU
```bash
# Ollama automatically uses GPU if available
# You can use larger models:
ollama pull llama3.1:70b  # Needs 40GB+ RAM
```

### Check GPU Usage
```bash
# While Ollama is running:
nvidia-smi  # For NVIDIA GPUs
```

## Troubleshooting

### "Ollama not available"
```bash
# Check if Ollama is running
ollama list

# If not, start it:
# Windows: Already started, try restarting Ollama app
# Linux/Mac: ollama serve
```

### "Model not found"
```bash
# Pull the model first
ollama pull llama3.1
```

### "Too slow"
```bash
# Try a smaller model
ollama pull phi3

# Use smaller chunks
python main.py doc.pdf --provider ollama --chunk-size 300

# Or use cloud providers for speed:
python main.py doc.pdf --strategy performance
```

### "Out of memory"
```bash
# Use smaller model
ollama pull phi3  # Only 2.3GB

# Or smaller chunks
python main.py doc.pdf --chunk-size 200
```

## Advanced: Custom Ollama Configuration

```python
from finder_system.llm_extractor import OllamaAdapter

# Custom configuration
ollama = OllamaAdapter(
    model="llama3.1",
    base_url="http://localhost:11434"  # Default
)

# If running Ollama on different port/host
ollama = OllamaAdapter(
    model="llama3.1",
    base_url="http://192.168.1.100:11434"  # Remote Ollama
)
```

## Comparison: Ollama vs Cloud

| Feature | Ollama (Local) | Claude | Gemini |
|---------|----------------|--------|--------|
| **Cost** | Free | ~$0.50/doc | ~$0.05/doc |
| **Privacy** | 100% private | Cloud | Cloud |
| **Speed** | 5-15 min | 20-40 sec | 30-60 sec |
| **Quality** | Good | Excellent | Very Good |
| **Token Limit** | 4K-128K | 200K | 2M |
| **Offline** | Yes | No | No |

## Best Practices

1. **Start Small**: Test with `phi3` or `llama3.1`
2. **Chunk Wisely**: Use 300-500 tokens for CPU, 1000+ for GPU
3. **Hybrid Approach**: Use Ollama for dev/testing, cloud for production
4. **Cost Strategy**: Use `cost_optimized` to try Ollama first, fallback to cloud
5. **Monitor Resources**: Watch RAM/GPU usage, close other apps if needed

## Next Steps

1. **Test it works**: `python test_ollama.py`
2. **Process a PDF**: `python main.py test.pdf --provider ollama`
3. **Experiment with models**: Try `phi3`, `mistral`, `gemma2`
4. **Hybrid strategy**: `python main.py doc.pdf --strategy cost_optimized`

## Resources

- Ollama Models: https://ollama.ai/library
- Model Cards: https://ollama.ai/library/llama3.1
- GitHub: https://github.com/ollama/ollama

---

**Pro Tip**: Use Ollama for development and testing (free!), then switch to Claude/Gemini for production when you need speed and accuracy.
