"""
Chatbot API Server - Standalone Entry Point
Used by PyInstaller to build chatbot_server.exe

Run directly:   python chatbot_server.py
Run as exe:     chatbot_server.exe

.env loading priority (first found wins):
  1. Bundled .env inside the exe (embedded at build time via --add-data)
  2. External .env beside the exe (optional override)
  3. Project root .env (when running as plain script)
"""
import multiprocessing
import os
import sys


def _load_env() -> str:
    """
    Load .env with priority: bundled inside exe > external beside exe > script dir.
    Returns a description of which source was used.
    """
    from dotenv import load_dotenv

    if getattr(sys, 'frozen', False):
        # --- Running as compiled exe ---
        # sys._MEIPASS is the temp folder where PyInstaller extracts bundled files
        bundled_env = os.path.join(sys._MEIPASS, '.env')
        external_env = os.path.join(os.path.dirname(sys.executable), '.env')

        if os.path.exists(bundled_env):
            load_dotenv(bundled_env, override=False)   # load bundled defaults
            if os.path.exists(external_env):
                load_dotenv(external_env, override=True)  # external can override
                return f"bundled (overrides from {external_env})"
            return "bundled inside exe"
        elif os.path.exists(external_env):
            load_dotenv(external_env, override=True)
            return external_env
        else:
            return "none found - using system environment variables"
    else:
        # --- Running as plain script ---
        script_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
        load_dotenv(script_env, override=True)
        return script_env


def main():
    # Must be called before any other multiprocessing code on Windows
    multiprocessing.freeze_support()

    env_source = _load_env()

    # Validate required env vars before starting
    if not os.getenv('GOOGLE_API_KEY'):
        print("[WARNING] GOOGLE_API_KEY not set - LLM and embeddings will be unavailable.")

    if not os.getenv('MONGODB_URI'):
        print("[WARNING] MONGODB_URI not set - using default mongodb://localhost:27017")

    # Import after env vars are loaded
    import uvicorn
    from chatbot.api import app  # noqa: F401 - import triggers module loading

    print(f"[chatbot] Config source : {env_source}")
    print("[chatbot] Starting Agricultural Chatbot API on http://127.0.0.1:8000")
    print("[chatbot] Press CTRL+C to stop")

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
        # Single worker - multiprocessing doesn't work in --onefile exe
        workers=1,
    )


if __name__ == "__main__":
    main()
