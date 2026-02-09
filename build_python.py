"""
Build Python scripts into standalone executables using PyInstaller.
Output: python_dist/*.exe
"""

import subprocess
import sys
import os

SCRIPTS = [
    "finder_system/web_scripts/extract_text.py",
    "finder_system/web_scripts/create_chunks.py",
    "finder_system/web_scripts/extract_chunk.py",
    "finder_system/web_scripts/test_token.py",
]

HIDDEN_IMPORTS = [
    "anthropic",
    "google.generativeai",
    "openai",
    "pdfplumber",
    "nltk",
    "pdfminer",
    "pdfminer.high_level",
]

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "python_dist")
PROJECT_ROOT = os.path.dirname(__file__)


def build_script(script_path: str) -> bool:
    script_name = os.path.splitext(os.path.basename(script_path))[0]
    print(f"\n{'='*60}")
    print(f"Building: {script_name}")
    print(f"{'='*60}")

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--console",
        "--name", script_name,
        "--distpath", OUTPUT_DIR,
        "--workpath", os.path.join(PROJECT_ROOT, "build", script_name),
        "--specpath", os.path.join(PROJECT_ROOT, "build"),
        "--add-data", f"finder_system{os.pathsep}finder_system",
    ]

    for imp in HIDDEN_IMPORTS:
        cmd.extend(["--hidden-import", imp])

    cmd.append(script_path)

    result = subprocess.run(cmd, cwd=PROJECT_ROOT)
    if result.returncode != 0:
        print(f"FAILED: {script_name}")
        return False

    print(f"SUCCESS: {script_name}")
    return True


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    results = []
    for script in SCRIPTS:
        success = build_script(script)
        results.append((script, success))

    print(f"\n{'='*60}")
    print("Build Summary")
    print(f"{'='*60}")
    for script, success in results:
        status = "OK" if success else "FAILED"
        print(f"  [{status}] {os.path.basename(script)}")

    failed = [s for s, ok in results if not ok]
    if failed:
        print(f"\n{len(failed)} script(s) failed to build.")
        sys.exit(1)
    else:
        print(f"\nAll {len(results)} scripts built successfully.")
        print(f"Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
