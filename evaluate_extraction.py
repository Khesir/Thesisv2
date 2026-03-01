"""
Extraction Evaluation Script
=============================
Computes two metrics from MongoDB data:
  1. Field Coverage Rate  — across ALL extracted records (no annotation needed)
  2. Hallucination Rate   — over a random sample, judged by Gemini

Usage:
    python evaluate_extraction.py
    python evaluate_extraction.py --sample 30   # change sample size for hallucination check
    python evaluate_extraction.py --coverage-only  # skip hallucination (no API key needed)

Requires:
    - MongoDB running with thesis_panel DB (MONGODB_URI in root .env)
    - GOOGLE_API_KEY in root .env (only for hallucination check)
"""

import os
import random
import argparse
from typing import Any
from bson import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv

# Load root .env (GOOGLE_API_KEY) then web-panel/.env.local (MONGODB_URI)
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "web-panel", ".env.local"), override=True)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/thesis_panel")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
DEFAULT_SAMPLE_SIZE = 20

# ---------------------------------------------------------------------------
# Field definitions
# Each entry: (dot-path into extracted record, is_array)
# These map directly to the ExtractedData schema fields that carry real content.
# ---------------------------------------------------------------------------
EXPECTED_FIELDS: list[tuple[str, bool]] = [
    ("cropName",                          False),
    ("scientificName",                    False),
    ("soilRequirements.types",            True),
    ("soilRequirements.ph_range",         False),
    ("soilRequirements.drainage",         False),
    ("climateRequirements.temperature",   False),
    ("climateRequirements.rainfall",      False),
    ("climateRequirements.humidity",      False),
    ("climateRequirements.conditions",    True),
    ("nutrients.nitrogen.rate",           False),
    ("nutrients.phosphorus.rate",         False),
    ("nutrients.potassium.rate",          False),
    ("plantingInfo.season",               False),
    ("plantingInfo.method",               False),
    ("plantingInfo.spacing",              False),
    ("plantingInfo.duration",             False),
    ("farmingPractices",                  True),
    ("pestsDiseases",                     True),
    ("yieldInfo.average",                 False),
    ("yieldInfo.range",                   False),
    ("regionalData",                      True),
    ("recommendations",                   True),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_nested(doc: dict, path: str) -> Any:
    """Traverse a dot-path and return the value, or None if missing."""
    val = doc
    for key in path.split("."):
        if not isinstance(val, dict):
            return None
        val = val.get(key)
    return val


def is_populated(value: Any, is_array: bool) -> bool:
    """Return True if the field contains meaningful data."""
    if value is None:
        return False
    if is_array:
        return isinstance(value, list) and len(value) > 0
    return isinstance(value, str) and value.strip() != ""


def extract_checkable_values(record: dict) -> list[tuple[str, str]]:
    """
    Collect (field_path, value_string) pairs from a record for hallucination checking.
    For arrays, samples the first element to keep Gemini calls manageable.
    """
    pairs: list[tuple[str, str]] = []
    for field, is_array in EXPECTED_FIELDS:
        value = get_nested(record, field)
        if not is_populated(value, is_array):
            continue
        if is_array:
            item = value[0]
            if isinstance(item, str):
                pairs.append((field, item))
            elif isinstance(item, dict):
                for k, v in item.items():
                    if isinstance(v, str) and v.strip():
                        pairs.append((f"{field}[0].{k}", v))
        else:
            pairs.append((field, str(value)))
    return pairs


# ---------------------------------------------------------------------------
# Field Coverage Rate
# ---------------------------------------------------------------------------

def compute_field_coverage(records: list[dict]) -> dict:
    """
    For every extracted record, check which expected fields are populated.
    Returns per-field rates and an overall average.
    """
    total = len(records)
    counts = {field: 0 for field, _ in EXPECTED_FIELDS}

    for record in records:
        for field, is_array in EXPECTED_FIELDS:
            if is_populated(get_nested(record, field), is_array):
                counts[field] += 1

    per_field = {field: count / total for field, count in counts.items()}
    overall = sum(per_field.values()) / len(per_field)

    return {
        "total_records": total,
        "per_field": per_field,
        "overall_coverage_rate": overall,
    }


# ---------------------------------------------------------------------------
# Hallucination Rate (Gemini judge)
# ---------------------------------------------------------------------------

def is_hallucinated(client, chunk_text: str, field: str, value: str) -> bool:
    """
    Ask Gemini whether an extracted value is supported by the source chunk text.
    Returns True if Gemini says NO (i.e., the value is hallucinated).
    """
    from google import genai
    from google.genai import types

    prompt = (
        "You are an extraction auditor reviewing an agricultural document.\n"
        "Given the SOURCE TEXT below, determine if the EXTRACTED VALUE is "
        "directly supported by it. Answer only YES or NO.\n\n"
        f"SOURCE TEXT:\n{chunk_text[:3000]}\n\n"
        f"EXTRACTED FIELD: {field}\n"
        f"EXTRACTED VALUE: {value}\n\n"
        "Is this value supported by the source text? Answer YES or NO only."
    )
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.0, max_output_tokens=5),
        )
        return response.text.strip().upper().startswith("NO")
    except Exception as e:
        print(f"    [warn] Gemini call failed for '{field}': {e}")
        return False  # conservative: don't flag on error


def compute_hallucination_rate(
    records: list[dict],
    chunks_col,
    sample_size: int,
) -> dict:
    """
    Sample N records, fetch their source chunk text, then ask Gemini
    whether each extracted value is grounded in the chunk.
    """
    from google import genai

    client = genai.Client(api_key=GOOGLE_API_KEY)
    sample = random.sample(records, min(sample_size, len(records)))

    total_values = 0
    hallucinated_values = 0
    per_record_results = []

    for i, record in enumerate(sample):
        crop = record.get("cropName") or "unknown"
        chunk_id = record.get("chunkId")

        # chunkId is stored as a string; chunk _id may be ObjectId or string
        chunk = chunks_col.find_one({"_id": chunk_id})
        if chunk is None:
            try:
                chunk = chunks_col.find_one({"_id": ObjectId(chunk_id)})
            except Exception:
                pass

        if chunk is None:
            print(f"  [{i+1}/{len(sample)}] Skipping '{crop}' — chunk not found")
            continue

        chunk_text = chunk.get("content", "")
        field_values = extract_checkable_values(record)

        print(f"  [{i+1}/{len(sample)}] Checking {len(field_values)} fields — crop: '{crop}'")

        flagged = []
        for field, value in field_values:
            total_values += 1
            if is_hallucinated(client, chunk_text, field, value):
                hallucinated_values += 1
                flagged.append({"field": field, "value": value})

        per_record_results.append({
            "record_id": str(record["_id"]),
            "crop_name": crop,
            "hallucinated_fields": flagged,
        })

    rate = hallucinated_values / total_values if total_values > 0 else 0.0
    return {
        "sample_size": len(sample),
        "total_values_checked": total_values,
        "hallucinated_values": hallucinated_values,
        "hallucination_rate": rate,
        "per_record": per_record_results,
    }


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def print_coverage_report(coverage: dict) -> None:
    print("\n" + "=" * 62)
    print("  FIELD COVERAGE RATE")
    print("=" * 62)
    print(f"  Total records evaluated: {coverage['total_records']}\n")
    print(f"  {'Field':<44} {'Rate':>7}")
    print("  " + "-" * 54)
    for field, rate in coverage["per_field"].items():
        bar = "█" * int(rate * 20)
        print(f"  {field:<44} {rate*100:>5.1f}%  {bar}")
    print("  " + "-" * 54)
    overall = coverage["overall_coverage_rate"]
    print(f"  {'OVERALL FIELD COVERAGE RATE':<44} {overall*100:>5.1f}%")
    print("=" * 62)


def print_hallucination_report(result: dict) -> None:
    print("\n" + "=" * 62)
    print("  HALLUCINATION RATE")
    print("=" * 62)
    print(f"  Sample size:          {result['sample_size']} records")
    print(f"  Total values checked: {result['total_values_checked']}")
    print(f"  Hallucinated values:  {result['hallucinated_values']}")
    print(f"  Hallucination Rate:   {result['hallucination_rate'] * 100:.2f}%")

    flagged = [r for r in result["per_record"] if r["hallucinated_fields"]]
    if flagged:
        print(f"\n  Records with flagged fields ({len(flagged)}):")
        for r in flagged:
            print(f"\n    Crop: {r['crop_name']}  (id: {r['record_id']})")
            for h in r["hallucinated_fields"]:
                print(f"      - {h['field']}: \"{h['value']}\"")
    else:
        print("\n  No hallucinated fields detected in sample.")
    print("=" * 62)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def check_crop_hallucination(crop_name: str, extracted_col, chunks_col) -> None:
    """
    Check hallucination rate for all records matching a specific crop name.
    Fetches every record for that crop and checks all field values against
    the source chunk — no sampling, covers the full crop.
    """
    if not GOOGLE_API_KEY:
        print("\nGOOGLE_API_KEY not set in .env — cannot run hallucination check.")
        return

    # Case-insensitive search across cropName variations
    query = {"cropName": {"$regex": f"^{crop_name}$", "$options": "i"}}
    records = list(extracted_col.find(query))

    if not records:
        print(f"\nNo records found for crop '{crop_name}'.")
        print("Tip: crop names are case-insensitive but must match exactly (e.g. 'Rice', 'Corn').")
        return

    print(f"\nFound {len(records)} record(s) for crop '{crop_name}'.")
    print("Running hallucination check on all records (no sampling)...")

    from google import genai
    client = genai.Client(api_key=GOOGLE_API_KEY)

    total_values = 0
    hallucinated_values = 0
    per_record_results = []

    for i, record in enumerate(records):
        chunk_id = record.get("chunkId")
        chunk = chunks_col.find_one({"_id": chunk_id})
        if chunk is None:
            try:
                chunk = chunks_col.find_one({"_id": ObjectId(chunk_id)})
            except Exception:
                pass

        if chunk is None:
            print(f"  [{i+1}/{len(records)}] Skipping — chunk not found")
            continue

        chunk_text = chunk.get("content", "")
        field_values = extract_checkable_values(record)
        print(f"  [{i+1}/{len(records)}] Checking {len(field_values)} fields...")

        flagged = []
        for field, value in field_values:
            total_values += 1
            if is_hallucinated(client, chunk_text, field, value):
                hallucinated_values += 1
                flagged.append({"field": field, "value": value})

        per_record_results.append({
            "record_id": str(record["_id"]),
            "crop_name": record.get("cropName"),
            "hallucinated_fields": flagged,
        })

    rate = hallucinated_values / total_values if total_values > 0 else 0.0
    print_hallucination_report({
        "sample_size": len(records),
        "total_values_checked": total_values,
        "hallucinated_values": hallucinated_values,
        "hallucination_rate": rate,
        "per_record": per_record_results,
    })


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate extraction quality from MongoDB.")
    parser.add_argument("--sample", type=int, default=DEFAULT_SAMPLE_SIZE,
                        help="Number of records to sample for hallucination check (default: 20)")
    parser.add_argument("--coverage-only", action="store_true",
                        help="Only compute field coverage rate, skip hallucination check")
    parser.add_argument("--crop", type=str, default=None,
                        help="Check hallucination rate for a specific crop name only (e.g. --crop Rice)")
    args = parser.parse_args()

    print("Connecting to MongoDB...")
    mongo = MongoClient(MONGODB_URI)
    from pymongo.uri_parser import parse_uri
    parsed = parse_uri(MONGODB_URI)
    db_name = parsed.get("database") or "test"
    db = mongo[db_name]
    extracted_col = db["extracteddatas"]
    chunks_col = db["chunks"]

    # --- Crop-specific hallucination check ---
    if args.crop:
        check_crop_hallucination(args.crop, extracted_col, chunks_col)
        mongo.close()
        return

    records = list(extracted_col.find({}))
    print(f"Found {len(records)} extracted records in '{db_name}.extracteddatas'.")

    if not records:
        print("No records found. Make sure the extraction pipeline has been run.")
        return

    # 1. Field Coverage Rate (all records)
    print("\nComputing Field Coverage Rate (all records)...")
    coverage = compute_field_coverage(records)
    print_coverage_report(coverage)

    # 2. Hallucination Rate (sampled, Gemini judge)
    if args.coverage_only:
        print("\n--coverage-only flag set. Skipping hallucination check.")
        return

    if not GOOGLE_API_KEY:
        print("\nGOOGLE_API_KEY not set in .env — skipping hallucination check.")
        print("Set it and re-run without --coverage-only to enable it.")
        return

    print(f"\nComputing Hallucination Rate (sampling {args.sample} records)...")
    hallucination = compute_hallucination_rate(records, chunks_col, args.sample)
    print_hallucination_report(hallucination)

    mongo.close()


if __name__ == "__main__":
    main()
