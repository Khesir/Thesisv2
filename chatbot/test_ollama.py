"""
Ollama Readiness Test
Checks if Ollama is running, the model is available, and generates a test response.

Usage:
    python chatbot/test_ollama.py
    python chatbot/test_ollama.py --model llama3.2:3b
    python chatbot/test_ollama.py --url http://localhost:11434
"""
import argparse
import os
import sys
import time

import requests
from dotenv import load_dotenv

# Load .env from chatbot/ directory
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DEFAULT_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")


def print_status(label: str, ok: bool, detail: str = ""):
    icon = "[OK]" if ok else "[FAIL]"
    line = f"  {icon}  {label}"
    if detail:
        line += f"  —  {detail}"
    print(line)


def check_reachable(base_url: str) -> bool:
    """Step 1: Is Ollama running and reachable?"""
    try:
        r = requests.get(f"{base_url}/api/tags", timeout=5)
        r.raise_for_status()
        return True
    except requests.exceptions.ConnectionError:
        print_status("Ollama reachable", False, f"Cannot connect to {base_url}")
        print()
        print("  Fix: Start Ollama.")
        print("    Native:  Ollama should start automatically after install.")
        print("             If not, open the Ollama app or run: ollama serve")
        print("    Docker:  docker compose -f chatbot/docker-compose.standalone.yml up -d ollama")
        return False
    except Exception as e:
        print_status("Ollama reachable", False, str(e))
        return False


def check_model(base_url: str, model: str) -> bool:
    """Step 2: Is the model downloaded?"""
    try:
        r = requests.get(f"{base_url}/api/tags", timeout=5)
        r.raise_for_status()
        models = [m["name"] for m in r.json().get("models", [])]

        # Match by exact name or base name (e.g. "llama3.2:1b" matches "llama3.2:1b")
        matched = any(m == model or m.startswith(model.split(":")[0]) for m in models)

        if matched:
            print_status("Model available", True, model)
            if models:
                print(f"       Downloaded models: {', '.join(models)}")
        else:
            print_status("Model available", False, f"'{model}' not found")
            print()
            print(f"  Fix: Pull the model first:")
            print(f"    Native:  ollama pull {model}")
            print(f"    Docker:  docker exec chatbot_ollama ollama pull {model}")
            if models:
                print(f"\n  Other available models: {', '.join(models)}")

        return matched
    except Exception as e:
        print_status("Model available", False, str(e))
        return False


def check_inference(base_url: str, model: str) -> bool:
    """Step 3: Can the model generate a response? Measure latency."""
    prompt = "Reply with exactly three words: crops need water."
    print(f"  Running inference test (prompt: \"{prompt}\")")
    print(f"  This may take 15–40 seconds on CPU...")

    start = time.time()
    try:
        r = requests.post(
            f"{base_url}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.0, "num_predict": 32},
            },
            timeout=120,
        )
        r.raise_for_status()
        elapsed = time.time() - start
        response_text = r.json().get("response", "").strip()
        tokens = r.json().get("eval_count", "?")
        tok_per_sec = f"{tokens / elapsed:.1f}" if isinstance(tokens, int) else "?"

        print_status(
            "Inference OK",
            True,
            f"{elapsed:.1f}s  |  {tokens} tokens  |  ~{tok_per_sec} tok/s",
        )
        print(f"       Model reply: \"{response_text}\"")
        return True

    except requests.exceptions.Timeout:
        elapsed = time.time() - start
        print_status("Inference OK", False, f"Timed out after {elapsed:.0f}s")
        print()
        print("  The model is too slow for your hardware.")
        print("  Fix: Switch to a lighter model.")
        print("    Update OLLAMA_MODEL in chatbot/.env:")
        print("      OLLAMA_MODEL=llama3.2:1b   (fastest, recommended for CPU)")
        return False
    except Exception as e:
        print_status("Inference OK", False, str(e))
        return False


def main():
    parser = argparse.ArgumentParser(description="Test Ollama readiness for the chatbot")
    parser.add_argument("--url", default=DEFAULT_URL, help=f"Ollama base URL (default: {DEFAULT_URL})")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Model to test (default: {DEFAULT_MODEL})")
    args = parser.parse_args()

    print()
    print("=" * 52)
    print("  Ollama Readiness Test")
    print(f"  URL:   {args.url}")
    print(f"  Model: {args.model}")
    print("=" * 52)
    print()

    # Step 1
    print("Step 1 — Checking Ollama is running...")
    if not check_reachable(args.url):
        print()
        sys.exit(1)
    print_status("Ollama reachable", True, args.url)
    print()

    # Step 2
    print("Step 2 — Checking model is downloaded...")
    if not check_model(args.url, args.model):
        print()
        sys.exit(1)
    print()

    # Step 3
    print("Step 3 — Running inference test...")
    if not check_inference(args.url, args.model):
        print()
        sys.exit(1)
    print()

    print("=" * 52)
    print("  All checks passed. Ollama is ready.")
    print("  You can now start the chatbot API.")
    print()
    print("  Start chatbot (native):")
    print("    uvicorn chatbot.api:app --host 0.0.0.0 --port 8000")
    print()
    print("  Start chatbot (Docker):")
    print("    docker compose -f chatbot/docker-compose.standalone.yml up -d")
    print("=" * 52)
    print()


if __name__ == "__main__":
    main()
