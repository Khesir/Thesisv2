"""
Extract structured data from a chunk using LLM.
Input: JSON from stdin { content, provider, api_key, model, strategy }
Output: JSON to stdout { success, data, usage, provider, error }
"""

import sys
import json
import os
import ast

if getattr(sys, 'frozen', False):
    sys.path.insert(0, sys._MEIPASS)
else:
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from finder_system.llm_extractor.adapter import ClaudeAdapter, GeminiAdapter, OllamaAdapter
from finder_system.llm_orchestrator import create_orchestrator


def _try_parse_object(value):
    """Try to parse a value into a dict using json.loads then ast.literal_eval."""
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        return None
    # Try standard JSON first
    try:
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            return parsed
    except (json.JSONDecodeError, ValueError):
        pass
    # Fall back to ast.literal_eval (handles Python-style single-quoted dicts)
    try:
        parsed = ast.literal_eval(value)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass
    return None


def _normalize_object_list(value):
    """
    Normalize a field that should be a list of dicts.
    Handles: already-correct list, stringified JSON list, Python-repr list,
    or a list whose elements are themselves strings (the LLM-hallucination case).
    """
    if not value:
        return []

    # If the whole thing is a string, try to parse it into a list first
    if isinstance(value, str):
        for parser in (json.loads, ast.literal_eval):
            try:
                parsed = parser(value)
                if isinstance(parsed, list):
                    value = parsed
                    break
                if isinstance(parsed, dict):
                    return [parsed]
            except Exception:
                pass
        else:
            return []  # unparseable string → drop

    if not isinstance(value, list):
        return []

    result = []
    for item in value:
        if isinstance(item, dict):
            result.append(item)
            continue
        if isinstance(item, str):
            # Item might be the entire list as a string (LLM wraps it in an array)
            for parser in (json.loads, ast.literal_eval):
                try:
                    parsed = parser(item)
                    if isinstance(parsed, list):
                        result.extend(d for d in parsed if isinstance(d, dict))
                        break
                    if isinstance(parsed, dict):
                        result.append(parsed)
                        break
                except Exception:
                    pass
    return result


def sanitize_extraction_data(data):
    """
    Walk the extraction result and normalize fields that the LLM sometimes
    returns as Python-style strings instead of proper JSON arrays of objects.
    """
    if not isinstance(data, dict):
        return data

    crops = data.get("crops")
    if isinstance(crops, list):
        for crop in crops:
            if not isinstance(crop, dict):
                continue
            # Fields that must be lists of dicts
            for field in ("pests_diseases", "regional_data"):
                if field in crop:
                    crop[field] = _normalize_object_list(crop[field])
            # Fields that must be lists of strings — flatten any nested lists
            for field in ("farming_practices", "recommendations"):
                raw = crop.get(field)
                if isinstance(raw, str):
                    try:
                        parsed = ast.literal_eval(raw)
                        crop[field] = parsed if isinstance(parsed, list) else [raw]
                    except Exception:
                        crop[field] = []
    return data


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
                "data": sanitize_extraction_data(result.data),
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
        import traceback
        json.dump({
            "success": False,
            "error": str(e),
            "errorType": type(e).__name__,
            "traceback": traceback.format_exc(),
        }, sys.stdout)


if __name__ == "__main__":
    main()
