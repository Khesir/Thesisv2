"""
Build the Chatbot API FastAPI server into a standalone Windows executable.

Output: python_dist/chatbot_server.exe

Usage:
    python build_chatbot.py

Requirements:
    pip install pyinstaller
"""

import os
import subprocess
import sys

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "python_dist")
ENTRY_POINT = os.path.join(PROJECT_ROOT, "chatbot_server.py")
CHATBOT_SRC = os.path.join(PROJECT_ROOT, "chatbot")
ENV_FILE = os.path.join(PROJECT_ROOT, ".env")

# ---------------------------------------------------------------------------
# Hidden imports: modules PyInstaller cannot auto-detect via static analysis
# ---------------------------------------------------------------------------
HIDDEN_IMPORTS = [
    # uvicorn internals (dynamically loaded at runtime)
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.protocols.websockets.websockets_impl",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    # anyio backends (uvicorn uses anyio)
    "anyio",
    "anyio._backends._asyncio",
    # fastapi / starlette
    "fastapi",
    "fastapi.middleware",
    "fastapi.middleware.cors",
    "starlette.middleware.cors",
    # pydantic
    "pydantic",
    "pydantic.v1",
    # pymongo
    "pymongo",
    "pymongo.uri_parser",
    "pymongo.ssl_support",
    "pymongo.srv",
    # google generative ai
    "google",
    "google.generativeai",
    "google.ai",
    "google.ai.generativelanguage",
    "google.api_core",
    "google.auth",
    "google.auth.transport",
    "google.auth.transport.requests",
    "google.protobuf",
    # chatbot package modules (relative imports resolved here)
    "chatbot",
    "chatbot.api",
    "chatbot.rag_engine",
    "chatbot.crop_store",
    "chatbot.db_connection",
    # stdlib modules sometimes missed
    "email.mime.text",
    "email.mime.multipart",
    "multiprocessing",
    "multiprocessing.freeze_support",
]

# ---------------------------------------------------------------------------
# Collect-all: packages with data files / dynamic sub-imports
# ---------------------------------------------------------------------------
COLLECT_ALL = [
    "numpy",
    "google.generativeai",
    "google.ai",
    "google.api_core",
    "google.auth",
    "google.protobuf",
    "starlette",
    "fastapi",
    "uvicorn",
    "pydantic",
    "pymongo",
]


def build() -> bool:
    print("=" * 60)
    print("Building: chatbot_server.exe")
    print("=" * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Path separator for --add-data differs by OS (';' on Windows, ':' on Unix)
    sep = os.pathsep

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--console",
        "--name", "chatbot_server",
        "--distpath", OUTPUT_DIR,
        "--workpath", os.path.join(PROJECT_ROOT, "build", "chatbot_server"),
        "--specpath", os.path.join(PROJECT_ROOT, "build"),
        # Bundle the chatbot package so relative imports work inside the exe
        "--add-data", f"{CHATBOT_SRC}{sep}chatbot",
    ]

    # Bundle .env into the exe so no external file is needed at runtime
    if os.path.exists(ENV_FILE):
        cmd.extend(["--add-data", f"{ENV_FILE}{sep}."])
        print(f"  Bundling .env from: {ENV_FILE}")
    else:
        print(f"  [WARNING] No .env found at {ENV_FILE}")
        print("            The exe will require a .env beside it at runtime.")

    for imp in HIDDEN_IMPORTS:
        cmd.extend(["--hidden-import", imp])

    for pkg in COLLECT_ALL:
        cmd.extend(["--collect-all", pkg])

    cmd.append(ENTRY_POINT)

    result = subprocess.run(cmd, cwd=PROJECT_ROOT)

    if result.returncode == 0:
        exe_path = os.path.join(OUTPUT_DIR, "chatbot_server.exe")
        print("\n" + "=" * 60)
        print("BUILD SUCCESS")
        print("=" * 60)
        print(f"  Executable : {exe_path}")
        print()
        if os.path.exists(ENV_FILE):
            print("Deployment steps:")
            print("  1. Copy python_dist/chatbot_server.exe to your Flutter project")
            print("  2. Run chatbot_server.exe  (.env is embedded - no separate file needed)")
            print("  3. API is available at http://127.0.0.1:8000")
            print()
            print("  Optional: place a .env beside the .exe to override embedded values")
        else:
            print("Deployment steps:")
            print("  1. Copy python_dist/chatbot_server.exe to your deploy folder")
            print("  2. Create a .env file in the SAME folder as the .exe:")
            print("       MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net")
            print("       MONGODB_NAME=thesis")
            print("       GOOGLE_API_KEY=your-google-api-key")
            print("  3. Run chatbot_server.exe")
            print("  4. API is available at http://127.0.0.1:8000")
        return True
    else:
        print("\nBUILD FAILED - check output above for errors")
        return False


if __name__ == "__main__":
    success = build()
    sys.exit(0 if success else 1)
