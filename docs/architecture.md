# System Architecture

## High-Level Overview

```
┌────────────────────────┐    ┌────────────────────────┐    ┌──────────────┐
│   Web Panel            │    │   Chatbot API          │    │   MongoDB    │
│   (Next.js 15)         │    │   (FastAPI)            │    │  (Docker)    │
│   Port: 3000           │───►│   Port: 8000           │◄──►│  Port: 27017 │
└────────┬───────────────┘    └────────────────────────┘    └──────────────┘
         │ child_process
         ▼
┌────────────────────────┐
│   finder_system        │
│   (Python Scripts)     │
└────────────────────────┘
```

## Components

### 1. Web Panel (`web-panel/`)

Next.js 15 dashboard for managing the entire extraction pipeline. Provides a UI for uploading PDFs, managing text chunks, running LLM extraction, validating results, and viewing extracted crop data.

**Key characteristics:**
- Server-side API routes that call Python scripts via `child_process.spawn`
- Client-side SWR hooks for data fetching
- Electron packaging support for desktop distribution
- Token rotation service for managing multiple LLM API keys

### 2. Finder System (`finder_system/`)

Python backend that handles the core data processing pipeline. Not a standalone server; instead, individual scripts are invoked by the web panel as child processes communicating via stdin/stdout JSON.

**Key characteristics:**
- PDF text extraction using `pdfplumber`
- Text cleaning, chunking, and preprocessing
- LLM-powered structured data extraction with multi-provider support
- Orchestrator with failover, round-robin, cost-optimized, and performance strategies

### 3. Chatbot API (`chatbot/`)

Lightweight FastAPI service providing a conversational interface to the extracted crop data. Uses Retrieval-Augmented Generation (RAG) to answer agricultural questions.

**Key characteristics:**
- Reads extracted data from the same MongoDB database
- Keyword-based retrieval with LLM-enhanced responses (Gemini)
- Serves as the gateway for frontend/mobile applications

### 4. MongoDB

Shared database used by both the web panel and chatbot. Stores chunks, extracted data, and API tokens across 3 collections.

## Data Flow

```
PDF Document
    │
    ▼
┌─────────────────┐
│  extract_text.py │  ← pdfplumber extracts raw text
└────────┬────────┘
         ▼
┌─────────────────┐
│ create_chunks.py │  ← TextProcessor cleans and chunks text
└────────┬────────┘
         ▼
┌─────────────────┐
│ extract_chunk.py │  ← LLM extracts structured crop data
└────────┬────────┘
         ▼
┌─────────────────┐
│   Validation     │  ← User reviews in web panel
└────────┬────────┘
         ▼
┌─────────────────┐
│  Chatbot / API   │  ← Extracted data served via RAG
└─────────────────┘
```

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js | 15.5.x |
| UI Framework | React | 19.x |
| Styling | Tailwind CSS | v4 |
| Components | shadcn/ui + Radix UI | latest |
| Data Fetching | SWR | 2.4.x |
| Charts | Recharts | 2.15.x |
| Database | MongoDB (Mongoose) | 9.x |
| PDF Processing | pdfplumber | latest |
| LLM Providers | Claude, Gemini, Ollama | various |
| Chatbot Framework | FastAPI | latest |
| Desktop | Electron | 33.x |
| Package Bundler | electron-builder | 25.x |
| Python Bundler | PyInstaller | latest |
| Containerization | Docker Compose | latest |

## Directory Structure

```
Thesisv2/
├── finder_system/              # Python extraction engine
│   ├── pdf_extractor.py        # PDF text extraction
│   ├── text_processor.py       # Text cleaning and chunking
│   ├── llm_orchestrator.py     # Multi-provider orchestration
│   ├── llm_extractor/          # LLM extraction interface
│   │   ├── llm_extractor.py    # Base interface & result types
│   │   ├── llm_interface.py    # Abstract interface
│   │   └── adapter/            # Provider adapters
│   │       ├── claude_adapter.py
│   │       ├── gemini_adapter.py
│   │       └── ollama_adapter.py
│   └── web_scripts/            # Scripts called by web panel
│       ├── extract_text.py     # PDF → text
│       ├── create_chunks.py    # Text → chunks
│       ├── extract_chunk.py    # Chunk → structured data
│       └── test_token.py       # API key validation
├── web-panel/                  # Next.js dashboard
│   ├── app/                    # Pages and API routes
│   ├── components/             # UI components (shadcn/ui)
│   ├── lib/                    # Database, types, utilities
│   │   ├── db/                 # Database connection
│   │   └── entities/           # Entity definitions (model + types)
│   │       ├── chunk/
│   │       ├── extracted-data/
│   │       └── api-token/
│   ├── services/               # Business logic services
│   ├── hooks/                  # React hooks
│   ├── scripts/                # Migration and seed scripts
│   └── electron/               # Electron main process
├── chatbot/                    # FastAPI chatbot
│   ├── api.py                  # FastAPI endpoints
│   ├── rag_engine.py           # RAG logic
│   ├── crop_store.py           # MongoDB-backed crop store
│   └── db_connection.py        # MongoDB connection singleton
├── docs/                       # Project documentation
├── docker-compose.yml          # Dev: MongoDB + Mongo Express
├── docker-compose.prod.yml     # Prod: standalone Next.js container
├── requirements.txt            # Python dependencies
└── build_python.py             # PyInstaller build script
```
