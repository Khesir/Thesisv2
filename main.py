import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

from finder_system.pdf_extractor import PDFExtractor
from finder_system.text_processor import TextProcessor
from finder_system.llm_orchestrator import create_orchestrator, ProviderStrategy

load_dotenv()

def process_pdf(
    pdf_path: str,
    output_path: str = None,
    chunk_size: int = 1000,
    strategy: str = "failover",
    provider: str = None
) -> dict:
    """
    Process a PDF file and extract agricultural information

    Args:
        pdf_path: Path to the PDF file
        output_path: Path to save the JSON output (optional)
        chunk_size: Size of text chunks for processing
        strategy: LLM selection strategy (failover, round_robin, cost_optimized, performance)
        provider: Force specific provider (claude, gemini, ollama) or None for auto

    Returns:
        Dictionary containing extraction results
    """
    print(f"\n{'='*60}")
    print(f"Agricultural Information Extraction System v2")
    print(f"{'='*60}\n")

    # Step 1: Extract text from PDF
    print(f"[1/4] Extracting text from PDF: {pdf_path}")
    pdf_extractor = PDFExtractor()
    extraction_result = pdf_extractor.extract_text(pdf_path)

    if not extraction_result['success']:
        print(f"Error: {extraction_result['error']}")
        return extraction_result

    print(f"  ✓ Extracted {extraction_result['metadata']['total_pages']} pages")
    print(f"  ✓ Total words: {extraction_result['metadata']['word_count']}")

    # Step 2: Preprocess text
    print(f"\n[2/4] Preprocessing text...")
    text_processor = TextProcessor()
    text_processor.chunk_size = chunk_size

    preprocessed = text_processor.preprocess(extraction_result['content']['full_text'])

    print(f"  ✓ Text cleaned and segmented")
    print(f"  ✓ Total chunks: {preprocessed['total_chunks']}")

    # Step 3: Extract information using LLM orchestrator
    print(f"\n[3/4] Extracting agricultural information using LLM...")

    # Create orchestrator with configured strategy
    orchestrator = create_orchestrator(strategy=strategy)

    # If specific provider requested, filter to only that provider
    if provider:
        orchestrator.providers = [
            p for p in orchestrator.providers
            if p.get_provider_name() == provider.lower()
        ]
        if not orchestrator.providers:
            error_msg = f"Provider '{provider}' not available or not configured"
            print(f"\nError: {error_msg}")
            return {'success': False, 'error': error_msg}

    # Show orchestrator status
    orchestrator.print_status()

    try:
        llm_result = orchestrator.extract_from_chunks(
            preprocessed['chunks'],
            combine_results=True
        )

        if not llm_result.success:
            print(f"\nError during LLM extraction: {llm_result.error}")
            return {'success': False, 'error': llm_result.error}

        print(f"  ✓ Processed {llm_result.total_chunks_processed} chunks")
        print(f"  ✓ Provider used: {llm_result.provider.upper()}")

        if llm_result.total_usage:
            total_tokens = llm_result.total_usage.get('total_tokens', 0)
            print(f"  ✓ Total tokens used: {total_tokens:,}")

    except Exception as e:
        print(f"\nError: {str(e)}")
        return {'success': False, 'error': str(e)}

    # Step 4: Prepare final output
    print(f"\n[4/4] Preparing output...")

    final_output = {
        'document_info': {
            'file_path': pdf_path,
            'file_name': os.path.basename(pdf_path),
            'processed_date': datetime.now().isoformat(),
            'metadata': extraction_result['metadata'],
            'content_hash': extraction_result['content']['content_hash']
        },
        'processing_info': {
            'total_chunks': preprocessed['total_chunks'],
            'chunks_processed': llm_result.total_chunks_processed,
            'provider_used': llm_result.provider,
            'strategy': strategy,
            'total_usage': llm_result.total_usage
        },
        'extracted_data': llm_result.data
    }

    # Save to file if output path provided
    if output_path:
        # Create output directory if it doesn't exist
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(final_output, f, indent=2, ensure_ascii=False)

        print(f"  ✓ Results saved to: {output_path}")
    else:
        # Generate default output filename
        pdf_name = Path(pdf_path).stem
        output_path = f"{pdf_name}_extracted.json"

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(final_output, f, indent=2, ensure_ascii=False)

        print(f"  ✓ Results saved to: {output_path}")

    # Print summary
    print(f"\n{'='*60}")
    print(f"Extraction Summary")
    print(f"{'='*60}")

    data = final_output['extracted_data']

    if data.get('crops'):
        print(f"\nCrops found: {len(data['crops'])}")
        for crop in data['crops'][:5]:  # Show first 5
            print(f"  - {crop.get('name', 'Unknown')}")

    if data.get('soil_types'):
        print(f"\nSoil types: {', '.join(data['soil_types'][:5])}")

    if data.get('pests_diseases'):
        print(f"\nPests/Diseases found: {len(data['pests_diseases'])}")

    if data.get('recommendations'):
        print(f"\nRecommendations: {len(data['recommendations'])}")

    print(f"\n{'='*60}\n")

    return final_output


def main():
    """Main entry point for command-line usage"""
    parser = argparse.ArgumentParser(
        description='Extract agricultural information from PDF files using multiple LLM providers'
    )
    parser.add_argument(
        'pdf_path',
        help='Path to the PDF file to process'
    )
    parser.add_argument(
        '-o', '--output',
        help='Output JSON file path (default: <pdf_name>_extracted.json)'
    )
    parser.add_argument(
        '--chunk-size',
        type=int,
        default=1000,
        help='Text chunk size for processing (default: 1000)'
    )
    parser.add_argument(
        '--strategy',
        choices=['failover', 'round_robin', 'cost_optimized', 'performance'],
        default='failover',
        help='Provider selection strategy (default: failover)'
    )
    parser.add_argument(
        '--provider',
        choices=['claude', 'gemini', 'ollama'],
        help='Force specific provider (optional)'
    )

    args = parser.parse_args()

    # Check if PDF exists
    if not os.path.exists(args.pdf_path):
        print(f"Error: PDF file not found: {args.pdf_path}")
        sys.exit(1)

    # Process the PDF
    result = process_pdf(
        pdf_path=args.pdf_path,
        output_path=args.output,
        chunk_size=args.chunk_size,
        strategy=args.strategy,
        provider=args.provider
    )

    # Exit with appropriate code
    sys.exit(0 if result.get('success', True) else 1)


if __name__ == '__main__':
    main()
