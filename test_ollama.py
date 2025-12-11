"""
Test script for Ollama integration
"""
from finder_system.llm_extractor import OllamaAdapter

print("="*60)
print("Testing Ollama Integration")
print("="*60)

# Test 1: Check if Ollama is available
print("\n[1/4] Checking Ollama availability...")
ollama = OllamaAdapter(model="llama3.1")

if ollama.is_available():
    print("  ✓ Ollama is running!")
    print(f"  - Provider: {ollama.get_provider_name()}")
    print(f"  - Model: {ollama.model}")
    print(f"  - Base URL: {ollama.base_url}")
    print(f"  - Token Limit: {ollama.get_token_limit():,}")
else:
    print("  ✗ Ollama not available")
    print("  Please install and start Ollama:")
    print("    1. Download from https://ollama.ai/download")
    print("    2. Run: ollama serve")
    print("    3. Run: ollama pull llama3.1")
    exit(1)

# Test 2: Extract from sample text
print("\n[2/4] Testing extraction with sample text...")
sample_text = """
Rice (Oryza sativa) is a staple cereal crop. It grows best in clay and loam
soils with pH 6.0-7.0. The crop needs temperatures between 20-35°C and
1500-2000mm rainfall. Common pests include rice blast and brown planthopper.
Expected yields: 4-5 tons per hectare.
"""

print(f"  Sample text: {len(sample_text)} characters")
print("  Extracting information...")

result = ollama.extract_from_text(sample_text)

if result.success:
    print("  ✓ Extraction successful!")
    print(f"  - Provider: {result.provider}")
    print(f"  - Model: {result.model}")

    data = result.data

    if data.get('crops'):
        print(f"\n  Crops found:")
        for crop in data['crops']:
            print(f"    - {crop.get('name', 'Unknown')}")

    if data.get('soil_types'):
        print(f"\n  Soil types: {', '.join(data['soil_types'])}")

    if data.get('climate_conditions'):
        cc = data['climate_conditions']
        if cc.get('temperature_range'):
            print(f"\n  Temperature: {cc['temperature_range']}")
        if cc.get('rainfall'):
            print(f"  Rainfall: {cc['rainfall']}")

    if data.get('yield_information'):
        yi = data['yield_information']
        if yi.get('average_yield'):
            print(f"\n  Yield: {yi['average_yield']} {yi.get('unit', '')}")

    # Show token usage
    if result.usage:
        print(f"\n  Token usage:")
        print(f"    - Input: ~{result.usage.get('input_tokens', 0):,}")
        print(f"    - Output: ~{result.usage.get('output_tokens', 0):,}")
        estimated = result.usage.get('estimated', False)
        print(f"    - {'(Estimated)' if estimated else '(Actual)'}")
else:
    print(f"  ✗ Extraction failed: {result.error}")

# Test 3: Test with chunks
print("\n[3/4] Testing chunk processing...")
chunks = [
    {
        'chunk_id': 0,
        'text': "Corn requires well-drained soil and full sunlight. Plant in spring.",
        'token_count': 50
    },
    {
        'chunk_id': 1,
        'text': "Tomatoes need regular watering and support structures. Harvest when red.",
        'token_count': 50
    }
]

print(f"  Processing {len(chunks)} chunks...")
chunk_result = ollama.extract_from_chunks(chunks, combine_results=True)

if chunk_result.success:
    print("  ✓ Chunk processing successful!")
    print(f"  - Chunks processed: {chunk_result.total_chunks_processed}")

    if chunk_result.data.get('crops'):
        print(f"  - Crops found: {len(chunk_result.data['crops'])}")
else:
    print(f"  ✗ Chunk processing failed: {chunk_result.error}")

# Test 4: Performance tip
print("\n[4/4] Performance tips...")
print("  For faster processing:")
print("    - Use smaller chunk sizes (300-500 tokens)")
print("    - Use smaller models: phi3, gemma2:2b")
print("    - Consider GPU acceleration if available")

print("\n" + "="*60)
print("Ollama test complete!")
print("="*60)
print("\nNext steps:")
print("  1. Test with real PDF:")
print("     python main.py your_document.pdf --provider ollama")
print("  2. Adjust chunk size for performance:")
print("     python main.py document.pdf --provider ollama --chunk-size 500")
print("  3. Try different models:")
print("     ollama pull mistral")
print("     (Edit main.py or create custom OllamaAdapter with different model)")
