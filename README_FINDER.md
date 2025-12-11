# Agricultural Information Extraction - Finder System

This system extracts structured agricultural information from PDF documents using LLM technology.

## Setup

### 1. Virtual Environment

Create and activate the virtual environment:

```bash
# Create venv
python -m venv venv

# Activate on Windows
venv\Scripts\activate

# Activate on Linux/Mac
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure API Key

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=your_actual_api_key_here
```

Alternatively, you can set the environment variable directly:

```bash
# Windows
set ANTHROPIC_API_KEY=your_api_key_here

# Linux/Mac
export ANTHROPIC_API_KEY=your_api_key_here
```

## Usage

### Basic Usage

Process a PDF and extract agricultural information:

```bash
python process_pdf.py path/to/your/document.pdf
```

This will create a JSON file named `document_extracted.json` in the current directory.

### Specify Output File

```bash
python process_pdf.py path/to/document.pdf -o output/results.json
```

### Pass API Key Directly

```bash
python process_pdf.py document.pdf --api-key your_api_key_here
```

### Adjust Chunk Size

```bash
python process_pdf.py document.pdf --chunk-size 1500
```

## Output Format

The system generates a JSON file with the following structure:

```json
{
  "document_info": {
    "file_path": "path/to/document.pdf",
    "file_name": "document.pdf",
    "processed_date": "2024-12-08T10:30:00",
    "metadata": {
      "title": "Document Title",
      "author": "Author Name",
      "total_pages": 15,
      "word_count": 5000
    },
    "content_hash": "sha256_hash"
  },
  "processing_info": {
    "total_chunks": 5,
    "chunks_processed": 5,
    "model_used": "claude-3-5-sonnet-20241022",
    "total_usage": {
      "input_tokens": 12000,
      "output_tokens": 3000
    }
  },
  "extracted_data": {
    "crops": [
      {
        "name": "Rice",
        "scientific_name": "Oryza sativa",
        "category": "cereal"
      }
    ],
    "soil_types": ["clay", "loam"],
    "climate_conditions": {
      "temperature_range": "20-35°C",
      "rainfall": "1500-2000mm",
      "sunlight": "full sun",
      "other_conditions": []
    },
    "growing_conditions": {
      "soil_ph": "6.0-7.0",
      "planting_season": "June-July",
      "growing_period": "120-150 days"
    },
    "pests_diseases": [
      {
        "name": "rice blast",
        "type": "disease",
        "affected_crops": ["rice"]
      }
    ],
    "farming_practices": ["transplanting", "direct seeding"],
    "fertilizers": ["NPK", "organic compost"],
    "yield_information": {
      "average_yield": "4-5 tons",
      "unit": "tons/hectare"
    },
    "regional_data": {
      "region": "Davao Region, Philippines",
      "specific_recommendations": []
    },
    "recommendations": [
      "Plant during rainy season",
      "Use certified seeds"
    ],
    "summaries": [
      "Summary of agricultural information from each chunk"
    ]
  }
}
```

## System Architecture

The Finder System consists of three main components:

### 1. PDF Extractor (`pdf_extractor.py`)
- Extracts text from PDF files
- Preserves metadata (title, author, pages)
- Handles multi-page documents
- Generates content hash for deduplication

### 2. Text Processor (`text_processor.py`)
- Cleans and normalizes extracted text
- Segments text into processable chunks
- Identifies document sections
- Prepares text for LLM processing

### 3. LLM Extractor (`llm_extractor.py`)
- Uses Claude AI to extract structured information
- Processes text chunks in parallel
- Combines results from multiple chunks
- Returns structured JSON data

## Processing Flow

```
PDF File → Extract Text → Clean & Chunk → LLM Extraction → JSON Output
```

1. **Extract**: Read PDF and extract raw text
2. **Preprocess**: Clean text and split into chunks
3. **Extract**: Use LLM to identify agricultural information
4. **Combine**: Merge results from all chunks
5. **Save**: Output structured JSON file

## Extracted Information

The system extracts:

- **Crops**: Names, scientific names, categories
- **Soil Types**: Soil classifications and properties
- **Climate Conditions**: Temperature, rainfall, sunlight
- **Growing Conditions**: pH levels, planting seasons, duration
- **Pests & Diseases**: Names, types, affected crops
- **Farming Practices**: Techniques and methods
- **Fertilizers**: Types and applications
- **Yield Data**: Production statistics
- **Regional Information**: Location-specific data
- **Recommendations**: Best practices and advice

## Troubleshooting

### API Key Not Found
```
Error: API key required. Set ANTHROPIC_API_KEY env var or pass api_key parameter
```
**Solution**: Create a `.env` file with your API key or set the environment variable.

### PDF Not Found
```
Error: PDF file not found: path/to/file.pdf
```
**Solution**: Check the file path and ensure the PDF exists.

### Import Errors
```
ModuleNotFoundError: No module named 'pdfplumber'
```
**Solution**: Ensure virtual environment is activated and run `pip install -r requirements.txt`

## Cost Estimation

The system uses Claude 3.5 Sonnet. Approximate costs:
- Small document (5-10 pages): ~$0.10-$0.30
- Medium document (20-30 pages): ~$0.50-$1.00
- Large document (50+ pages): ~$1.50-$3.00

Costs depend on:
- Document length
- Text density
- Chunk size settings

## Next Steps

To integrate with the full data collection pipeline:

1. Connect to MongoDB for storage
2. Add embedding generation for vector search
3. Implement batch processing for multiple PDFs
4. Add validation and quality checks
5. Create web scraping integration

## License

This is part of the Agricultural Information Extraction System thesis project.
