"""
Extract text from a PDF file.
Input: PDF file path as command line argument
Output: JSON to stdout { success, metadata, content, error }
"""

import sys
import json
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from finder_system.pdf_extractor import PDFExtractor


def main():
    if len(sys.argv) < 2:
        json.dump({"success": False, "error": "No file path provided"}, sys.stdout)
        return

    pdf_path = sys.argv[1]

    if not os.path.exists(pdf_path):
        json.dump({"success": False, "error": f"File not found: {pdf_path}"}, sys.stdout)
        return

    try:
        extractor = PDFExtractor()
        result = extractor.extract_text(pdf_path)

        if result.get("success"):
            json.dump({
                "success": True,
                "text": result["content"]["full_text"],
                "metadata": result.get("metadata", {}),
                "pages": result["content"].get("pages", []),
            }, sys.stdout)
        else:
            json.dump({
                "success": False,
                "error": result.get("error", "Unknown extraction error"),
            }, sys.stdout)
    except Exception as e:
        json.dump({"success": False, "error": str(e)}, sys.stdout)


if __name__ == "__main__":
    main()
