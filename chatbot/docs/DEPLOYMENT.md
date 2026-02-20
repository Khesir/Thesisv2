# Chatbot API Deployment Guide

Deployment options for the Agricultural RAG Chatbot API.

---

## Table of Contents

- [Option A: Standalone Executable (Recommended for Flutter)](#option-a-standalone-executable-recommended-for-flutter)
- [Option B: Python Script (Development)](#option-b-python-script-development)
- [Option C: Docker](#option-c-docker)
- [Environment Variables](#environment-variables)
- [Flutter Integration](#flutter-integration)
- [Troubleshooting](#troubleshooting)

---

## Option A: Standalone Executable (Recommended for Flutter)

Package the FastAPI server into a single `.exe` that runs alongside the Flutter desktop app on the same device. No Python installation required on the target machine.

### Prerequisites (build machine only)

- Python 3.10+
- PyInstaller: `pip install pyinstaller`
- All chatbot dependencies: `pip install -r chatbot/requirements.txt`

### Build

From the **project root**:

```bash
python build_chatbot.py
```

Output: `python_dist/chatbot_server.exe`

Build time is 3–10 minutes depending on machine. The resulting `.exe` is ~150–300 MB due to bundled numpy and Google AI libraries.

### Deploy

Create a deployment folder with this structure:

```
chatbot_deploy/
├── chatbot_server.exe    ← from python_dist/
└── .env                  ← create this manually (see below)
```

**`.env` file contents:**

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net
MONGODB_NAME=thesis
GOOGLE_API_KEY=your-google-api-key
```

> `.env` must be in the **same directory** as `chatbot_server.exe`. The executable loads it from its own directory automatically.

### Run

Double-click `chatbot_server.exe` or launch from terminal:

```bash
chatbot_server.exe
```

Expected startup output:

```
[chatbot] Loading .env from: C:\...\chatbot_deploy\.env
[chatbot] Starting Agricultural Chatbot API on http://127.0.0.1:8000
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Loaded 45 crops from MongoDB. LLM available: True
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

Verify it's running:

```bash
curl http://127.0.0.1:8000/
```

Expected response:

```json
{
  "status": "healthy",
  "crops_loaded": 45,
  "llm_available": true,
  "embedding_search": true
}
```

---

## Option B: Python Script (Development)

Run directly with Python for development and testing.

### Setup

```bash
# From project root, create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Linux/Mac

# Install dependencies
pip install -r chatbot/requirements.txt
```

### Configure

Copy `.env.example` to `.env` at the project root and fill in:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net
MONGODB_NAME=thesis
GOOGLE_API_KEY=your-google-api-key
```

### Run

```bash
# Using the entry point script
python chatbot_server.py

# Or using uvicorn directly
uvicorn chatbot.api:app --host 127.0.0.1 --port 8000

# Development mode with auto-reload
uvicorn chatbot.api:app --reload --port 8000
```

---

## Option C: Docker

For containerized or server deployments.

### Standalone (chatbot only)

```bash
# Create chatbot/.env with your credentials
cp .env.example chatbot/.env
# Edit chatbot/.env

# Build and run
docker compose -f chatbot/docker-compose.standalone.yml up --build
```

### Full project

```bash
# From project root
docker compose up chatbot-api
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string. Atlas (`mongodb+srv://...`) or local (`mongodb://localhost:27017`) |
| `MONGODB_NAME` | No | Database name. Default: `thesis` |
| `GOOGLE_API_KEY` | No* | Google AI API key for Gemini LLM and embeddings |

> *Without `GOOGLE_API_KEY`: the API still runs but falls back to keyword search. Chat responses return raw crop data instead of AI-generated answers.

### Getting a Google API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click **Get API key** → **Create API key**
3. Copy the key into your `.env` file

### MongoDB URI

- **Atlas (cloud):** Get from MongoDB Atlas dashboard → Connect → Drivers
- **Local:** `mongodb://localhost:27017` (requires [MongoDB Community Server](https://www.mongodb.com/try/download/community) installed)

---

## Flutter Integration

Point your Flutter app's HTTP client to `http://127.0.0.1:8000`.

### Startup Flow (recommended)

For a Flutter desktop app, launch `chatbot_server.exe` as a subprocess on app start and shut it down when the app closes:

```dart
import 'dart:io';

class ChatbotServer {
  Process? _process;

  Future<void> start() async {
    final exePath = 'path/to/chatbot_server.exe';
    _process = await Process.start(exePath, []);

    // Wait for the server to be ready
    await _waitForReady();
  }

  Future<void> _waitForReady({int maxRetries = 20}) async {
    final client = HttpClient();
    for (int i = 0; i < maxRetries; i++) {
      try {
        final request = await client.getUrl(
          Uri.parse('http://127.0.0.1:8000/'),
        );
        final response = await request.close();
        if (response.statusCode == 200) return;
      } catch (_) {
        await Future.delayed(const Duration(seconds: 1));
      }
    }
    throw Exception('Chatbot server failed to start');
  }

  void stop() {
    _process?.kill();
    _process = null;
  }
}
```

### API Base URL

```dart
const String kChatbotBaseUrl = 'http://127.0.0.1:8000';
```

### Example Chat Request

```dart
Future<String> chat(String message) async {
  final response = await http.post(
    Uri.parse('$kChatbotBaseUrl/chat'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'message': message,
      'top_k': 3,
      'include_context': false,
    }),
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return data['answer'] as String;
  }
  throw Exception('Chat request failed: ${response.statusCode}');
}
```

---

## Troubleshooting

### Executable fails to start

**Symptom:** `.exe` crashes immediately or shows a brief console window.

**Fix:** Run from a terminal to see the error:
```bash
cd path\to\chatbot_deploy
chatbot_server.exe
```

Common causes:
- `.env` file missing or in wrong location (must be beside the `.exe`)
- `MONGODB_URI` is unreachable (check network / Atlas IP whitelist)

### `MONGODB_URI` connection error

**Symptom:** `Error during startup: ... ServerSelectionTimeoutError`

**Fix:**
- Verify the URI in your `.env` is correct
- If using MongoDB Atlas, whitelist `0.0.0.0/0` (or your specific IP) in Atlas → Network Access
- Test the URI with [mongosh](https://www.mongodb.com/try/download/shell): `mongosh "your-uri"`

### LLM not available / keyword fallback only

**Symptom:** `LLM available: False` in startup log, chat returns raw data.

**Fix:** Add `GOOGLE_API_KEY` to your `.env` file. The API still works without it but responses are unformatted.

### PyInstaller build fails

**Common fixes:**

```bash
# Upgrade PyInstaller
pip install --upgrade pyinstaller

# Clear old build cache and retry
rmdir /s /q build
python build_chatbot.py
```

If a specific module is missing at runtime (ImportError in the exe), add it to `HIDDEN_IMPORTS` in [build_chatbot.py](../../build_chatbot.py) and rebuild.

### Port 8000 already in use

**Symptom:** `[ERROR] Address already in use`

**Fix:** Kill the existing process:
```bash
# Find and kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <pid> /F
```

Or change the port in [chatbot_server.py](../../chatbot_server.py):
```python
uvicorn.run(app, host="127.0.0.1", port=8001)
```
And update the Flutter base URL accordingly.

### Antivirus blocks the executable

PyInstaller executables are sometimes flagged by Windows Defender.

**Fix:** Add an exclusion in Windows Security → Virus & threat protection → Exclusions → Add `chatbot_server.exe` or the deploy folder.
