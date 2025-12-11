# Gemini API Setup Guide

Quick guide to fix the Gemini model configuration issue and get started.

## ✅ Fix Applied

The default model has been changed from `gemini-1.5-pro-latest` to `gemini-1.5-pro`.

## 🔧 Quick Fix Steps

### 1. Check Available Models
```bash
python check_gemini_models.py
```

This will:
- Verify your API key works
- List all available Gemini models
- Test generation with a simple prompt

### 2. Try Processing Again
```bash
python main.py your_document.pdf --provider gemini
```

## 📋 Correct Model Names

| Model Name | Token Limit | Best For |
|-----------|-------------|----------|
| `gemini-1.5-pro` | 2M tokens | Large documents, best quality |
| `gemini-1.5-flash` | 1M tokens | Faster processing, good quality |
| `gemini-pro` | 32K tokens | Older model, smaller context |

**Note**: Do NOT use `-latest` suffix (e.g., ~~`gemini-1.5-pro-latest`~~)

## 🎯 Usage Examples

### Default (Auto-detect)
```bash
# Uses gemini-1.5-pro by default
python main.py document.pdf --provider gemini
```

### Specify Different Model
```python
from finder_system.llm_extractor import GeminiAdapter

# Use Flash for faster processing
gemini = GeminiAdapter(model="gemini-1.5-flash")
result = gemini.extract_from_text("your text here...")
```

### In Main Script
To change the default model permanently, edit:
`finder_system/llm_extractor/adapter/gemini_adapter.py`

```python
def __init__(
    self,
    api_key: Optional[str] = None,
    model: str = "gemini-1.5-flash",  # Change here
    **kwargs
):
```

## 🔑 API Key Setup

### 1. Get API Key
Visit: https://makersuite.google.com/app/apikey

### 2. Add to .env
```bash
GOOGLE_API_KEY=AIza...your_key_here
```

### 3. Verify
```bash
python check_gemini_models.py
```

## 🐛 Troubleshooting

### Error: "404 model not found"
**Solution**: Model name is wrong. Use `gemini-1.5-pro` (without `-latest`)

```bash
# Check which models are available
python check_gemini_models.py
```

### Error: "API key invalid"
**Solution**:
1. Check your API key at https://makersuite.google.com/app/apikey
2. Make sure `.env` file exists with correct key
3. Reload environment: restart your terminal or run `load_dotenv()`

### Error: "Quota exceeded"
**Solution**:
1. Check usage at https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com
2. Free tier has limits, may need to enable billing
3. Wait for quota to reset (usually daily)
4. Use fallback: `python main.py doc.pdf --strategy failover`

### Error: "Invalid JSON response"
**Solution**: The model might be returning markdown. This is handled automatically, but if it persists:
1. Try a different model: `gemini-1.5-flash`
2. Reduce chunk size: `--chunk-size 800`

## 💡 Performance Tips

### For Large Documents (100+ pages)
```bash
# Gemini has 2M token limit!
python main.py large_doc.pdf --provider gemini --chunk-size 3000
```

### For Speed
```bash
# Use Flash model
python main.py doc.pdf --provider gemini
# Then edit gemini_adapter.py to use "gemini-1.5-flash"
```

### Cost Optimization
Gemini pricing (as of Dec 2024):
- `gemini-1.5-pro`: ~$0.00125 per 1K input tokens
- `gemini-1.5-flash`: ~$0.000075 per 1K input tokens

Flash is **~17x cheaper** than Pro!

## 🧪 Test Script

Create a test file to verify Gemini works:

```python
from finder_system.llm_extractor import GeminiAdapter

# Test
gemini = GeminiAdapter(model="gemini-1.5-pro")

if gemini.is_available():
    result = gemini.extract_from_text("""
        Rice grows in tropical regions with 1500-2000mm rainfall.
        Best soil pH is 6.0-7.0. Common pest: rice blast.
    """)

    if result.success:
        print("✓ Gemini working!")
        print(f"Crops: {result.data.get('crops')}")
    else:
        print(f"✗ Error: {result.error}")
else:
    print("✗ Gemini not configured")
```

## 📊 Model Comparison

| Feature | gemini-1.5-pro | gemini-1.5-flash | gemini-pro |
|---------|----------------|------------------|------------|
| Quality | Best | Very Good | Good |
| Speed | Medium | Fast | Medium |
| Tokens | 2M | 1M | 32K |
| Cost | $$ | $ | $ |
| Recommended | Large docs | Most cases | Small docs |

## ✅ Verification Checklist

- [ ] API key in `.env` file
- [ ] Run `python check_gemini_models.py` successfully
- [ ] Model name is `gemini-1.5-pro` (not `-latest`)
- [ ] Can process a test PDF: `python main.py test.pdf --provider gemini`

## 🔗 Resources

- Get API Key: https://makersuite.google.com/app/apikey
- Pricing: https://ai.google.dev/pricing
- Model Docs: https://ai.google.dev/models/gemini
- API Console: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com

---

**Quick Test**: `python check_gemini_models.py && python main.py your_doc.pdf --provider gemini`
