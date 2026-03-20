"""
Groq Readiness Test
Checks if GROQ_API_KEY is set, the model is accessible, and generates a test response.

Usage:
    python chatbot/test_ollama.py
    python chatbot/test_ollama.py --model llama-3.3-70b-versatile
"""
import argparse
import os
import sys
import time

from dotenv import load_dotenv
from groq import Groq, AuthenticationError, APIConnectionError

# Load .env from chatbot/ directory
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DEFAULT_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")


def print_status(label: str, ok: bool, detail: str = ""):
    icon = "[OK]" if ok else "[FAIL]"
    line = f"  {icon}  {label}"
    if detail:
        line += f"  —  {detail}"
    print(line)


def check_api_key() -> str | None:
    """Step 1: Is GROQ_API_KEY set?"""
    key = os.getenv("GROQ_API_KEY")
    if key:
        print_status("GROQ_API_KEY", True, f"{key[:8]}...")
    else:
        print_status("GROQ_API_KEY", False, "not set")
        print()
        print("  Fix: Add your Groq API key to chatbot/.env:")
        print("    GROQ_API_KEY=gsk_...")
        print("  Get a free key at: https://console.groq.com")
    return key


def check_inference(api_key: str, model: str) -> bool:
    """Step 2: Can the model generate a response? Measure latency."""
    client = Groq(api_key=api_key)
    prompt = "Reply with exactly three words: crops need water."
    print(f"  Running inference test (prompt: \"{prompt}\")")

    start = time.time()
    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=32,
        )
        elapsed = time.time() - start
        response_text = completion.choices[0].message.content.strip()
        usage = completion.usage
        tokens = usage.completion_tokens if usage else "?"
        tok_per_sec = f"{tokens / elapsed:.1f}" if isinstance(tokens, int) else "?"

        print_status(
            "Inference OK",
            True,
            f"{elapsed:.2f}s  |  {tokens} tokens  |  ~{tok_per_sec} tok/s",
        )
        print(f"       Model reply: \"{response_text}\"")
        return True

    except AuthenticationError:
        print_status("Inference OK", False, "invalid API key")
        print()
        print("  Fix: Check your GROQ_API_KEY in chatbot/.env.")
        print("  Generate a new key at: https://console.groq.com")
        return False
    except APIConnectionError as e:
        print_status("Inference OK", False, f"connection error: {e}")
        print()
        print("  Fix: Check your internet connection.")
        return False
    except Exception as e:
        print_status("Inference OK", False, str(e))
        return False


def main():
    parser = argparse.ArgumentParser(description="Test Groq API readiness for the chatbot")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Model to test (default: {DEFAULT_MODEL})")
    args = parser.parse_args()

    print()
    print("=" * 52)
    print("  Groq API Readiness Test")
    print(f"  Model: {args.model}")
    print("=" * 52)
    print()

    # Step 1
    print("Step 1 — Checking GROQ_API_KEY...")
    api_key = check_api_key()
    if not api_key:
        print()
        sys.exit(1)
    print()

    # Step 2
    print("Step 2 — Running inference test...")
    if not check_inference(api_key, args.model):
        print()
        sys.exit(1)
    print()

    print("=" * 52)
    print("  All checks passed. Groq is ready.")
    print("  You can now start the chatbot API.")
    print()
    print("  Start chatbot:")
    print("    uvicorn chatbot.api:app --host 0.0.0.0 --port 8000")
    print("=" * 52)
    print()


if __name__ == "__main__":
    main()
