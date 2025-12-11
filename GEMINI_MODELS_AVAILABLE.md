# Your Available Gemini Models

Based on your API check, you have access to the **newer Gemini 2.0 and 2.5 models**!

## ✅ Models You Can Use

| Model | Input Tokens | Output Tokens | Best For |
|-------|--------------|---------------|----------|
| **gemini-2.5-flash** ⭐ | 1,048,576 | 65,536 | Fast, efficient (DEFAULT) |
| **gemini-2.5-pro** | 1,048,576 | 65,536 | Best quality |
| **gemini-2.0-flash** | 1,048,576 | 8,192 | Fast processing |
| **gemini-2.0-flash-exp** | 1,048,576 | 8,192 | Experimental features |

⭐ = Default model now configured in the system

## 🚀 Updated Configuration

The system has been updated to use **`gemini-2.5-flash`** as the default model.

## 📊 Model Comparison

### Gemini 2.5 Flash (Default)
- **Speed**: Very Fast ⚡
- **Quality**: Excellent
- **Input**: 1M tokens (~750,000 words!)
- **Output**: 65K tokens
- **Best for**: Most use cases, large PDFs

### Gemini 2.5 Pro
- **Speed**: Fast
- **Quality**: Best
- **Input**: 1M tokens
- **Output**: 65K tokens
- **Best for**: When you need highest quality extraction

### Gemini 2.0 Flash
- **Speed**: Fastest ⚡⚡
- **Quality**: Very Good
- **Input**: 1M tokens
- **Output**: 8K tokens (smaller)
- **Best for**: Quick processing, many small documents

## 🎯 Usage

### Basic (Uses gemini-2.5-flash by default)
```bash
python main.py your_document.pdf --provider gemini
```

### Use Different Model
```bash
# For best quality
python main.py document.pdf --provider gemini
# Then manually edit gemini_adapter.py to change model to "gemini-2.5-pro"
```

### In Code
```python
from finder_system.llm_extractor import GeminiAdapter

# Use Pro for best quality
gemini_pro = GeminiAdapter(model="gemini-2.5-pro")

# Use Flash for speed (default)
gemini_flash = GeminiAdapter(model="gemini-2.5-flash")

# Extract
result = gemini_flash.extract_from_text("your text...")
```

## 💡 Recommendations

### For Your Agricultural PDFs

**Small PDFs (1-20 pages):**
```bash
python main.py doc.pdf --provider gemini --chunk-size 1000
```
Uses: `gemini-2.5-flash` ⚡ Fast and efficient

**Large PDFs (20-100 pages):**
```bash
python main.py large_doc.pdf --provider gemini --chunk-size 2000
```
Uses: `gemini-2.5-flash` with larger chunks (1M token limit!)

**Critical Documents (Need Best Quality):**
Edit `gemini_adapter.py` to use `gemini-2.5-pro`
```bash
python main.py important.pdf --provider gemini
```

## 🔧 Switching Models

### Temporary (for testing)
```python
from finder_system.llm_extractor import GeminiAdapter

# Try different models
models_to_test = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"]

for model_name in models_to_test:
    gemini = GeminiAdapter(model=model_name)
    result = gemini.extract_from_text("Rice grows in tropical regions...")
    print(f"{model_name}: {result.success}")
```

### Permanent (change default)
Edit: `finder_system/llm_extractor/adapter/gemini_adapter.py`

Line 23:
```python
model: str = "gemini-2.5-pro",  # Change to any model you prefer
```

## 🆚 Token Limit Comparison

**Your Gemini Models**: 1,048,576 tokens input
- That's about **750,000 words** or **~300-500 page PDF**!

**Comparison**:
- Claude 3.5: 200,000 tokens
- Ollama (llama3.1): 128,000 tokens

**Gemini has the largest context window!** Perfect for big agricultural documents.

## 💰 Cost Estimate

Gemini 2.5 Flash pricing (approximate):
- Input: ~$0.000075 per 1K tokens
- Output: ~$0.00030 per 1K tokens

**Example**: 50-page agricultural PDF
- ~25,000 input tokens = $0.0019
- ~5,000 output tokens = $0.0015
- **Total**: ~$0.0034 per document

Very affordable! 💵

## ✅ Current Status

- ✅ Default model updated to `gemini-2.5-flash`
- ✅ Token limits configured correctly
- ✅ Error messages updated
- ✅ All 4 models available in your account

## 🧪 Test It Now

```bash
# Should work perfectly now!
python main.py your_document.pdf --provider gemini
```

You should see:
```
✓ Gemini configured (model: gemini-2.5-flash)
Using provider: GEMINI
[Gemini] Processing chunk 1/X...
✓ Extraction successful!
```

## 📈 Performance Tips

1. **Large documents**: Use `--chunk-size 3000` (you have 1M token limit!)
2. **Best quality**: Edit default to `gemini-2.5-pro`
3. **Fastest**: Edit default to `gemini-2.0-flash`
4. **Cost-effective**: Current default (`gemini-2.5-flash`) is perfect!

## 🎉 You're All Set!

Your Finder System is now configured with the latest Gemini models. Try processing a PDF now! 🚀
