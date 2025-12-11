"""
Check available Gemini models with your API key
"""
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

print("="*60)
print("Checking Available Gemini Models")
print("="*60)

# Get API key
api_key = os.getenv('GOOGLE_API_KEY')

if not api_key:
    print("\n❌ Error: GOOGLE_API_KEY not found in .env file")
    print("\nPlease add your Gemini API key to .env:")
    print("GOOGLE_API_KEY=your_api_key_here")
    print("\nGet an API key from: https://makersuite.google.com/app/apikey")
    exit(1)

print(f"\n✓ API key found: {api_key[:10]}...{api_key[-4:]}")

# Configure Gemini
try:
    genai.configure(api_key=api_key)
    print("✓ Successfully configured Gemini API")
except Exception as e:
    print(f"❌ Failed to configure Gemini: {e}")
    exit(1)

# List available models
print("\n" + "="*60)
print("Available Models:")
print("="*60)

try:
    models = genai.list_models()

    gemini_models = []
    for model in models:
        # Filter for generative models that support generateContent
        if 'generateContent' in model.supported_generation_methods:
            gemini_models.append(model)
            print(f"\n✓ {model.name}")
            print(f"  Display Name: {model.display_name}")
            print(f"  Description: {model.description[:100]}...")

            # Check input/output token limits
            if hasattr(model, 'input_token_limit'):
                print(f"  Input Token Limit: {model.input_token_limit:,}")
            if hasattr(model, 'output_token_limit'):
                print(f"  Output Token Limit: {model.output_token_limit:,}")

    if not gemini_models:
        print("\n⚠️  No models found that support generateContent")
    else:
        print("\n" + "="*60)
        print(f"Total Models Available: {len(gemini_models)}")
        print("="*60)

        # Recommended models
        print("\n📌 Recommended Models:")

        recommended = {
            'models/gemini-1.5-pro': 'Best quality, 2M token context',
            'models/gemini-1.5-flash': 'Faster, 1M token context',
            'models/gemini-pro': 'Older model, 32K tokens'
        }

        for model_name, desc in recommended.items():
            if any(model_name in m.name for m in gemini_models):
                print(f"  ✓ {model_name.split('/')[-1]}: {desc}")
            else:
                print(f"  ✗ {model_name.split('/')[-1]}: Not available")

        # Test a simple generation
        print("\n" + "="*60)
        print("Testing Generation:")
        print("="*60)

        # Use the first available model
        test_model_name = gemini_models[0].name
        print(f"\nTesting with: {test_model_name}")

        try:
            model = genai.GenerativeModel(test_model_name)
            response = model.generate_content("Say 'Hello, agricultural AI!' in one sentence.")

            print(f"✓ Test successful!")
            print(f"Response: {response.text}")

        except Exception as e:
            print(f"❌ Test failed: {e}")

except Exception as e:
    print(f"\n❌ Error listing models: {e}")
    print("\nThis might mean:")
    print("  1. Invalid API key")
    print("  2. API quota exceeded")
    print("  3. Network connection issue")

print("\n" + "="*60)
print("Model Check Complete")
print("="*60)

print("\n💡 To use a specific model in your code:")
print("   from finder_system.llm_extractor import GeminiAdapter")
print("   gemini = GeminiAdapter(model='gemini-1.5-pro')")
print("\nOr update the default in gemini_adapter.py")
