"""
Create chunks from text.
Input: JSON from stdin { text, chunk_size, source_name }
Output: JSON to stdout { success, chunks: [{ index, content, tokenCount }], error }
"""

import sys
import json
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from finder_system.text_processor import TextProcessor


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        json.dump({"success": False, "error": f"Invalid JSON input: {str(e)}"}, sys.stdout)
        return

    text = input_data.get("text", "")
    chunk_size = input_data.get("chunk_size", 1000)
    source_name = input_data.get("source_name", "unknown")

    if not text:
        json.dump({"success": False, "error": "No text provided"}, sys.stdout)
        return

    try:
        processor = TextProcessor()
        result = processor.preprocess(text)
        chunks = result.get("chunks", [])

        # Re-chunk if custom chunk_size provided
        if chunk_size != 1000:
            chunks = processor.segment_text(result["cleaned_text"], max_chunk_size=chunk_size)

        formatted_chunks = []
        for i, chunk in enumerate(chunks):
            formatted_chunks.append({
                "index": i,
                "content": chunk.get("text", ""),
                "tokenCount": chunk.get("token_count", 0),
            })

        json.dump({
            "success": True,
            "chunks": formatted_chunks,
            "source": source_name,
            "totalChunks": len(formatted_chunks),
        }, sys.stdout)
    except Exception as e:
        json.dump({"success": False, "error": str(e)}, sys.stdout)


if __name__ == "__main__":
    main()
