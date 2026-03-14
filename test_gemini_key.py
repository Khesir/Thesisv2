"""
Gemini API Key Diagnostic Tool
Tests an API key against all known Gemini models using raw HTTP requests.
No SDK required — just Python stdlib.

Usage:
    python test_gemini_key.py
    python test_gemini_key.py AIza...yourkey...
"""

import sys
import json
import urllib.request
import urllib.error

BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

# Models to test — ordered from most likely free-tier to newest
MODELS_TO_TEST = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
]


def list_models(api_key: str) -> list[str]:
    """Fetch all available models from the API."""
    url = f"{BASE_URL}/models?key={api_key}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            models = data.get("models", [])
            return [
                m["name"].replace("models/", "")
                for m in models
                if "generateContent" in m.get("supportedGenerationMethods", [])
                and "gemini" in m.get("name", "").lower()
                and not any(s in m.get("name", "").lower()
                            for s in ("image", "vision", "audio", "video", "tts"))
            ]
    except Exception as e:
        print(f"  Could not list models: {e}")
        return []


def test_model(api_key: str, model: str) -> dict:
    """
    Test a single model with a minimal request.
    Returns { ok, status, error, limit_zero }
    """
    url = f"{BASE_URL}/models/{model}:generateContent?key={api_key}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": "Hi"}]}],
        "generationConfig": {"maxOutputTokens": 1}
    }).encode()

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return {"ok": True, "status": resp.status}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            err = json.loads(body)
            msg = err.get("error", {}).get("message", body)
        except Exception:
            msg = body

        limit_zero = "limit: 0" in body or '"limit":0' in body or "'limit': 0" in body
        quota_err = "quota" in msg.lower() or "resource_exhausted" in msg.lower()
        invalid_key = e.code == 401 or "api_key" in msg.lower() or "invalid" in msg.lower()

        return {
            "ok": False,
            "status": e.code,
            "error": msg[:200],
            "limit_zero": limit_zero,
            "quota_error": quota_err,
            "invalid_key": invalid_key,
        }
    except Exception as e:
        return {"ok": False, "status": 0, "error": str(e), "limit_zero": False}


def main():
    # Get API key
    if len(sys.argv) > 1:
        api_key = sys.argv[1].strip()
    else:
        api_key = input("Enter your Gemini API key: ").strip()

    if not api_key:
        print("No API key provided.")
        sys.exit(1)

    masked = api_key[:8] + "..." + api_key[-4:]
    print(f"\nTesting key: {masked}")
    print("=" * 60)

    # Step 1: List available models
    print("\n[1] Fetching available models from API...")
    available = list_models(api_key)
    if available:
        print(f"    Found {len(available)} text-capable Gemini models:")
        for m in sorted(available):
            print(f"      - {m}")
    else:
        print("    Could not fetch model list (key may be invalid or no network)")

    # Step 2: Test each model
    print("\n[2] Testing each model with a minimal request...")
    print("-" * 60)

    # Combine known list + discovered list, deduplicated
    all_models = list(dict.fromkeys(MODELS_TO_TEST + available))

    working = []
    no_quota = []
    not_found = []
    invalid = []

    for model in all_models:
        print(f"  {model:<35}", end="", flush=True)
        result = test_model(api_key, model)

        if result["ok"]:
            print("✓  WORKS  (free tier quota available)")
            working.append(model)
        elif result.get("invalid_key"):
            print("✗  INVALID KEY")
            invalid.append(model)
            break  # No point testing more
        elif result.get("limit_zero"):
            print("✗  BLOCKED  (limit: 0 — no free-tier quota on this project)")
            no_quota.append(model)
        elif result["status"] == 404:
            print("–  NOT FOUND  (model not available for this key)")
            not_found.append(model)
        elif result.get("quota_error"):
            print("✗  QUOTA ERROR  (may be temporarily rate-limited)")
            no_quota.append(model)
        else:
            print(f"✗  ERROR {result['status']}: {result['error'][:60]}")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    if invalid:
        print("\n✗ API key is INVALID — check the key and try again.")
        sys.exit(1)

    if working:
        print(f"\n✓ Working models ({len(working)}):")
        for m in working:
            print(f"    {m}  ← use this in the app")
    else:
        print("\n✗ No working models found.")

    if no_quota:
        print(f"\n✗ Blocked by limit:0 ({len(no_quota)} models) — project has no free-tier quota:")
        for m in no_quota:
            print(f"    {m}")

    if not_found:
        print(f"\n– Not available for this key ({len(not_found)} models):")
        for m in not_found:
            print(f"    {m}")

    if not working:
        print("\n" + "=" * 60)
        print("DIAGNOSIS")
        print("=" * 60)
        if no_quota:
            print("""
All models show 'limit: 0' on the free tier. This means your Google
Cloud project does not have free-tier Gemini API quota assigned.

Possible causes:
  1. API key was created in Google Cloud Console (not AI Studio)
  2. Your account/region does not have free-tier access
  3. The project has billing enabled but no free-tier quota

What to try:
  A) Go to aistudio.google.com → Get API key → Create in NEW project
     Make sure the project shows "Free tier" in the rate limits table
  B) Enable billing on the project to use paid tier instead
  C) Use Ollama (local, free, no API key needed) — already supported
     in your app: switch provider to 'ollama' in the extraction page
""")
        sys.exit(1)


if __name__ == "__main__":
    main()
