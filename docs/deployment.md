# Deployment Guide

## Development Workflow

### Docker Compose (Dev)

The development setup uses `docker-compose.yml` to run MongoDB and Mongo Express:

```yaml
services:
  mongodb:
    image: mongo:7.0
    container_name: thesis_mongodb
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=thesis_panel

  mongo-express:
    image: mongo-express:latest
    container_name: thesis_mongo_express
    ports:
      - "8081:8081"
    environment:
      ME_CONFIG_MONGODB_URL: mongodb://mongodb:27017
    depends_on:
      - mongodb
```

**Start/stop:**
```bash
# From web-panel/
npm run docker:dev        # Start
npm run docker:dev:down   # Stop
```

The web panel runs on the host machine with `npm run dev` and connects to the Dockerized MongoDB.

### Dev Server

```bash
cd web-panel
npm run dev    # Next.js dev server on port 3000
```

## Production Docker Build

The production setup uses `docker-compose.prod.yml` to containerize the web panel:

```yaml
services:
  web-panel:
    build:
      context: ./web-panel
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=${MONGODB_URI}
      - PYTHON_PATH=${PYTHON_PATH:-python}
    volumes:
      - ./finder_system:/app/finder_system
```

The Next.js app is built with `output: "standalone"` in `next.config.ts`, producing a self-contained build that doesn't need `node_modules` at runtime.

**Start:**
```bash
npm run docker:prod
```

> **Note:** The `finder_system/` directory is mounted as a volume so Python scripts are accessible from within the container.

## Electron Desktop Build

The web panel can be packaged as a desktop application using Electron.

### Configuration (`electron-builder.yml`)

```yaml
appId: com.thesis.panel
productName: Thesis Againn

files:
  - dist-electron/**/*
  - electron/connect.html
  - electron/connect.css
  - electron/connect.js

extraResources:
  - from: .next/standalone    → app/standalone     # Next.js standalone build
  - from: .next/static        → app/standalone/.next/static
  - from: public              → app/standalone/public
  - from: ../python_dist      → app/python          # PyInstaller executables
  - from: electron/connect.*  → app/electron/

win:
  target: nsis (x64)
  icon: build_resources/icon.ico
```

### Build Steps

```bash
cd web-panel

# 1. Build Python scripts into standalone executables
npm run build:python   # Runs build_python.py → ../python_dist/*.exe

# 2. Build Next.js + Electron
npm run build:electron # next build && tsc electron/ && electron-builder

# 3. Output in web-panel/dist/
```

### How It Works

In packaged mode (`ELECTRON_PACKAGED=true`):
- The Next.js standalone server runs embedded within Electron
- Python scripts are bundled as `.exe` files via PyInstaller
- `python-runner.ts` detects packaged mode and runs `.exe` directly instead of `python script.py`
- A connection screen (`connect.html`) shows while the embedded server starts

### Development Mode

```bash
cd web-panel
npm run electron:dev   # Runs Next.js dev + Electron concurrently
```

## Environment Configuration

### Development

| Service | Host | Port |
|---------|------|------|
| Web Panel | localhost | 3000 |
| MongoDB | localhost (Docker) | 27017 |
| Mongo Express | localhost (Docker) | 8081 |
| Chatbot API | localhost | 8000 |

### Production (Docker)

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | Set via environment or `.env` |
| `PYTHON_PATH` | `python` (default) |

### Electron (Packaged)

| Variable | Value |
|----------|-------|
| `ELECTRON_PACKAGED` | `true` |
| `MONGODB_URI` | User-configured connection string |

## Build Outputs

| Command | Output | Description |
|---------|--------|-------------|
| `npm run build` | `web-panel/.next/` | Next.js standalone build |
| `npm run build:python` | `python_dist/*.exe` | PyInstaller executables |
| `npm run electron:build` | `web-panel/dist/` | Electron installer (NSIS) |
| `docker compose -f docker-compose.prod.yml build` | Docker image | Production container |
