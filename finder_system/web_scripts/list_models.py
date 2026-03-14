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
    from google import genai
    # Segments that indicate vision/image/audio/video models — not suitable for text extraction
    _EXCLUDED = ("image", "vision", "audio", "video", "tts", "native")
    client = genai.Client(api_key=api_key)
    models = []
    for m in client.models.list():
        name = getattr(m, "name", "") or ""
        model_id = name.replace("models/", "") if name.startswith("models/") else name
        if not model_id.startswith("gemini"):
            continue
        if any(seg in model_id.lower() for seg in _EXCLUDED):
            continue
        display = getattr(m, "display_name", None) or model_id
        models.append({"id": model_id, "name": display})
    # Stable models first (no preview/exp/latest), then alphabetical
    models.sort(key=lambda m: (
        any(s in m["id"] for s in ("preview", "exp", "experimental", "latest")),
        m["id"],
    ))
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
