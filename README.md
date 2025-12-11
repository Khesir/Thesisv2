# Data Collection Process
## Prerequisites

- Python 3.10 or higher
- Anthropic API key ([Get one here](https://console.anthropic.com/))
- A PDF file with agricultural content

## Installation

### 1. Set up virtual environment

```bash
# Create virtual environment
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate

# On Linux/Mac:
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure API key

Create a `.env` file in the project root:

```bash
GOOGLE_API_KEY=your_google_api_key_here
```

## Usage

### Process a PDF file

```bash
python main.py ".\docs\FAO-Crop Soil Requirements.pdf"
```

This will:
1. Extract text from the PDF
2. Process and chunk the text
3. Extract agricultural information using AI
4. Save results to `your_document_extracted.json`

## Example Output

The system will create a JSON file like this:

```json
{
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
      "rainfall": "1500-2000mm"
    },
    "recommendations": [
      "Plant during rainy season",
      "Use certified seeds"
    ]
  }
}
```

## What Gets Extracted?

The system automatically extracts:

- ✅ Crop names and types
- ✅ Soil requirements
- ✅ Climate conditions
- ✅ Growing periods
- ✅ Pests and diseases
- ✅ Farming practices
- ✅ Fertilizer recommendations
- ✅ Yield data
- ✅ Regional information
- ✅ Best practices

## Troubleshooting

### "API key required" error

Make sure you've created a `.env` file with your API key:

```bash
echo ANTHROPIC_API_KEY=your_key_here > .env
```

### "File not found" error

Use the full path to your PDF file:

```bash
python process_pdf.py C:\Users\YourName\Documents\file.pdf
```

### Import errors

Make sure the virtual environment is activated:

```bash
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```
