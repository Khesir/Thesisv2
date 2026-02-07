"""
Extract structured data from a chunk using LLM.
Input: JSON from stdin { content, provider, api_key, model, strategy }
Output: JSON to stdout { success, data, usage, provider, error }
"""

import sys
import json
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from finder_system.llm_extractor.adapter import ClaudeAdapter, GeminiAdapter, OllamaAdapter
from finder_system.llm_orchestrator import create_orchestrator


def create_single_provider(provider, api_key, model=None):
    """Create a single provider adapter."""
    if provider == "anthropic":
        kwargs = {"api_key": api_key}
        if model:
            kwargs["model"] = model
        return ClaudeAdapter(**kwargs)
    elif provider == "google":
        kwargs = {"api_key": api_key}
        if model:
            kwargs["model"] = model
        return GeminiAdapter(**kwargs)
    elif provider == "ollama":
        kwargs = {}
        if model:
            kwargs["model"] = model
        return OllamaAdapter(**kwargs)
    else:
        raise ValueError(f"Unknown provider: {provider}")


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        json.dump({"success": False, "error": f"Invalid JSON input: {str(e)}"}, sys.stdout)
        return

    content = input_data.get("content", "")
    provider = input_data.get("provider", "auto")
    api_key = input_data.get("api_key", "")
    model = input_data.get("model")
    strategy = input_data.get("strategy", "failover")

    if not content:
        json.dump({"success": False, "error": "No content provided"}, sys.stdout)
        return

    try:
        chunks = [{"chunk_id": 0, "text": content, "token_count": len(content.split())}]

        if provider == "auto":
            orchestrator = create_orchestrator(strategy=strategy)
            result = orchestrator.extract_from_chunks(chunks, combine_results=True)
        else:
            adapter = create_single_provider(provider, api_key, model)
            result = adapter.extract_from_chunks(chunks, combine_results=True)

        if result.success:
            json.dump({
                "success": True,
                "data": result.data,
                "usage": result.total_usage,
                "provider": result.provider,
            }, sys.stdout)
        else:
            json.dump({
                "success": False,
                "error": result.error or "Extraction failed",
                "provider": result.provider,
            }, sys.stdout)
    except Exception as e:
        json.dump({"success": False, "error": str(e)}, sys.stdout)


if __name__ == "__main__":
    main()
