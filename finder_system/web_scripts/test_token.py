"""
Test an API token validity.
Input: JSON from stdin { provider, api_key }
Output: JSON to stdout { valid, error }
"""

import sys
import json
import os

if getattr(sys, 'frozen', False):
    sys.path.insert(0, sys._MEIPASS)
else:
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))


def test_anthropic(api_key):
    """Test Anthropic API key with a minimal request. Returns the extraction model name."""
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    extraction_model = "claude-3-5-sonnet-20241022"
    client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=1,
        messages=[{"role": "user", "content": "Hi"}],
    )
    return extraction_model


def test_google(api_key):
    """Test Google API key and auto-detect the best available model."""
    import google.generativeai as genai
    from finder_system.llm_extractor.adapter.gemini_adapter import GeminiAdapter
    genai.configure(api_key=api_key)
    # Use same auto-detection as the extraction adapter so the model shown matches what runs
    GeminiAdapter._auto_model_cache = None  # force fresh detection
    model_name = GeminiAdapter._detect_best_model()
    model = genai.GenerativeModel(model_name)
    model.generate_content("Hi", generation_config={"max_output_tokens": 1})
    return model_name


def test_openai(api_key):
    """Test OpenAI API key with a minimal request."""
    import openai
    client = openai.OpenAI(api_key=api_key)
    client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=1,
        messages=[{"role": "user", "content": "Hi"}],
    )
    return True


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        json.dump({"valid": False, "error": f"Invalid JSON input: {str(e)}"}, sys.stdout)
        return

    provider = input_data.get("provider", "")
    api_key = input_data.get("api_key", "")

    if not provider or not api_key:
        json.dump({"valid": False, "error": "Provider and api_key required"}, sys.stdout)
        return

    try:
        testers = {
            "anthropic": test_anthropic,
            "google": test_google,
            "openai": test_openai,
        }

        tester = testers.get(provider)
        if not tester:
            json.dump({"valid": False, "error": f"Unknown provider: {provider}"}, sys.stdout)
            return

        model = tester(api_key)
        json.dump({"valid": True, "model": model}, sys.stdout)
    except Exception as e:
        import traceback
        error_msg = str(e)
        error_lower = error_msg.lower()

        # Rate limit = key is valid, just throttled
        if "429" in error_msg or "rate" in error_lower or "resource_exhausted" in error_lower or "too many requests" in error_lower:
            json.dump({"valid": True, "error": f"Key valid but rate limited: {error_msg}"}, sys.stdout)
        # Invalid/expired key
        elif "401" in error_msg or "invalid" in error_lower or "unauthorized" in error_lower or "api_key_invalid" in error_lower or "not valid" in error_lower:
            json.dump({"valid": False, "error": f"Invalid API key: {error_msg}", "errorType": type(e).__name__}, sys.stdout)
        # Quota/billing issues - key exists but can't be used
        elif "quota" in error_lower or "billing" in error_lower or "credit" in error_lower:
            json.dump({"valid": False, "error": f"Quota or billing issue: {error_msg}", "errorType": type(e).__name__}, sys.stdout)
        else:
            json.dump({"valid": False, "error": error_msg, "errorType": type(e).__name__, "traceback": traceback.format_exc()}, sys.stdout)


if __name__ == "__main__":
    main()
