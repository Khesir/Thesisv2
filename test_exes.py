"""
Test Python executables for missing module errors.
Runs each .exe and checks if it crashes on import.
"""

import subprocess
import os
import json
import sys

DIST_DIR = os.path.join(os.path.dirname(__file__), "python_dist")

TESTS = [
    {
        "exe": "extract_text.exe",
        "args": ["nonexistent.pdf"],  # Will fail on file not found, but that's OK — we just check imports
        "expect_import_error": False,
    },
    {
        "exe": "create_chunks.exe",
        "stdin": json.dumps({"text": "hello world", "chunk_size": 100, "source_name": "test.pdf"}),
        "expect_import_error": False,
    },
    {
        "exe": "extract_chunk.exe",
        "name": "extract_chunk (anthropic)",
        "stdin": json.dumps({"content": "test", "provider": "anthropic", "api_key": "fake", "strategy": "failover"}),
        "expect_import_error": False,
    },
    {
        "exe": "extract_chunk.exe",
        "name": "extract_chunk (google)",
        "stdin": json.dumps({"content": "test", "provider": "google", "api_key": "fake", "strategy": "failover"}),
        "expect_import_error": False,
    },
    {
        "exe": "extract_chunk.exe",
        "name": "extract_chunk (openai)",
        "stdin": json.dumps({"content": "test", "provider": "openai", "api_key": "fake", "strategy": "failover"}),
        "expect_import_error": False,
    },
    {
        "exe": "test_token.exe",
        "name": "test_token (anthropic)",
        "stdin": json.dumps({"provider": "anthropic", "api_key": "fake-key"}),
        "expect_import_error": False,
    },
    {
        "exe": "test_token.exe",
        "name": "test_token (google)",
        "stdin": json.dumps({"provider": "google", "api_key": "fake-key"}),
        "expect_import_error": False,
    },
    {
        "exe": "test_token.exe",
        "name": "test_token (openai)",
        "stdin": json.dumps({"provider": "openai", "api_key": "fake-key"}),
        "expect_import_error": False,
    },
]


def test_exe(test: dict) -> tuple[bool, str]:
    exe_path = os.path.join(DIST_DIR, test["exe"])

    if not os.path.exists(exe_path):
        return False, "NOT BUILT"

    cmd = [exe_path] + test.get("args", [])
    stdin_data = test.get("stdin")

    try:
        result = subprocess.run(
            cmd,
            input=stdin_data,
            capture_output=True,
            text=True,
            timeout=30,
        )

        stderr = result.stderr.strip()
        stdout = result.stdout.strip()

        # Check for ModuleNotFoundError in stderr
        if "ModuleNotFoundError" in stderr:
            module = "unknown"
            for line in stderr.split("\n"):
                if "No module named" in line:
                    module = line.split("No module named")[-1].strip().strip("'\"")
                    break
            return False, f"MISSING MODULE: {module}"

        # Check for other import errors
        if "ImportError" in stderr:
            return False, f"IMPORT ERROR: {stderr[:200]}"

        # If we got valid JSON output, check for module errors in the response
        if stdout:
            try:
                data = json.loads(stdout)
                # Check if the app caught a ModuleNotFoundError internally
                error_str = json.dumps(data).lower()
                if "modulenotfounderror" in error_str or "no module named" in error_str:
                    module = data.get("error", "unknown")
                    return False, f"MISSING MODULE (caught): {module}"
                return True, f"OK (output: {json.dumps(data)[:100]})"
            except json.JSONDecodeError:
                pass

        # Non-zero exit but no import error = imports are fine, just runtime error
        if result.returncode != 0 and "ModuleNotFoundError" not in stderr:
            return True, f"OK (imports fine, runtime exit code {result.returncode})"

        return True, "OK"

    except subprocess.TimeoutExpired:
        return True, "OK (timed out, but no import error)"
    except Exception as e:
        return False, f"ERROR: {e}"


def main():
    print(f"Testing executables in: {DIST_DIR}\n")

    all_passed = True
    for test in TESTS:
        passed, detail = test_exe(test)
        status = "PASS" if passed else "FAIL"
        icon = "✓" if passed else "✗"
        label = test.get("name", test["exe"])
        print(f"  {icon} [{status}] {label}: {detail}")
        if not passed:
            all_passed = False

    print()
    if all_passed:
        print("All executables passed import checks!")
    else:
        print("Some executables have missing modules. Rebuild with updated hidden imports.")
        sys.exit(1)


if __name__ == "__main__":
    main()
