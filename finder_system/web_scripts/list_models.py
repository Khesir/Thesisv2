"""
List available models for a given provider and API key.
Input: JSON from stdin { provider, api_key }
Output: JSON to stdout { models: [{ id, name, description? }] }
"""

import sys
import json
import os

if getattr(sys, 'frozen', False):
    sys.path.insert(0, sys._MEIPASS)
else:
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))


def list_anthropic(api_key):
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    response = client.models.list()
    models = []
    for m in response.data:
        models.append({"id": m.id, "name": m.display_name if hasattr(m, "display_name") else m.id})
    # Sort: newest first (by id string, which encodes date)
    models.sort(key=lambda m: m["id"], reverse=True)
    return models


def list_google(api_key):
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    models = []
    for m in genai.list_models():
        if "generateContent" not in getattr(m, "supported_generation_methods", []):
            continue
        model_id = m.name.replace("models/", "") if m.name.startswith("models/") else m.name
        models.append({
            "id": model_id,
            "name": getattr(m, "display_name", model_id),
        })
    # Sort: gemini models first, then alphabetically
    def sort_key(m):
        mid = m["id"].lower()
        # Prefer non-preview/non-exp for ordering (but still show them)
        is_preview = "preview" in mid or "exp" in mid or "latest" in mid
        # Prefer flash over others for speed
        return (is_preview, mid)
    models.sort(key=sort_key)
    return models


def list_ollama(api_key):
    import urllib.request
    import urllib.error
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    try:
        req = urllib.request.urlopen(f"{base_url}/api/tags", timeout=5)
        data = json.loads(req.read().decode())
        models = []
        for m in data.get("models", []):
            name = m.get("name", "")
            models.append({"id": name, "name": name})
        return models
    except Exception as e:
        raise RuntimeError(f"Cannot reach Ollama at {base_url}: {e}")


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        json.dump({"success": False, "error": f"Invalid JSON input: {str(e)}"}, sys.stdout)
        return

    provider = input_data.get("provider", "")
    api_key = input_data.get("api_key", "")

    if not provider:
        json.dump({"success": False, "error": "Provider required"}, sys.stdout)
        return

    try:
        listers = {
            "anthropic": list_anthropic,
            "google": list_google,
            "ollama": list_ollama,
        }

        lister = listers.get(provider)
        if not lister:
            json.dump({"success": False, "error": f"Unknown provider: {provider}"}, sys.stdout)
            return

        models = lister(api_key)
        json.dump({"success": True, "models": models}, sys.stdout)
    except Exception as e:
        import traceback
        json.dump({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
        }, sys.stdout)


if __name__ == "__main__":
    main()
