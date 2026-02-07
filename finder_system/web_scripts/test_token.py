"""
Test an API token validity.
Input: JSON from stdin { provider, api_key }
Output: JSON to stdout { valid, error }
"""

import sys
import json
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))


def test_anthropic(api_key):
    """Test Anthropic API key with a minimal request."""
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=1,
        messages=[{"role": "user", "content": "Hi"}],
    )
    return True


def test_google(api_key):
    """Test Google API key with a minimal request."""
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    model.generate_content("Hi", generation_config={"max_output_tokens": 1})
    return True


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

        tester(api_key)
        json.dump({"valid": True}, sys.stdout)
    except Exception as e:
        error_msg = str(e)
        # Extract useful error messages from API errors
        if "401" in error_msg or "invalid" in error_msg.lower() or "unauthorized" in error_msg.lower():
            json.dump({"valid": False, "error": "Invalid API key"}, sys.stdout)
        elif "429" in error_msg or "rate" in error_msg.lower():
            json.dump({"valid": True, "error": "Key valid but rate limited"}, sys.stdout)
        else:
            json.dump({"valid": False, "error": error_msg}, sys.stdout)


if __name__ == "__main__":
    main()
