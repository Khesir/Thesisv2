"""
PDF Text Extraction Module
Handles extraction of text content from PDF files
"""
import pdfplumber
from typing import Dict, List
import hashlib


class PDFExtractor:
    """Extract text and metadata from PDF files"""

    def __init__(self):
        self.supported_formats = ['.pdf']

    def extract_text(self, pdf_path: str) -> Dict:
        """
        Extract text content from a PDF file

        Args:
            pdf_path: Path to the PDF file

        Returns:
            Dictionary containing extracted text and metadata
        """
        try:
            with pdfplumber.open(pdf_path) as pdf:
                # Extract metadata
                metadata = pdf.metadata or {}

                # Extract text from all pages
                full_text = ""
                page_texts = []

                for page_num, page in enumerate(pdf.pages, 1):
                    page_text = page.extract_text() or ""
                    page_texts.append({
                        'page_number': page_num,
                        'text': page_text
                    })
                    full_text += page_text + "\n\n"

                # Generate content hash
                content_hash = hashlib.sha256(full_text.encode()).hexdigest()

                # Count words
                word_count = len(full_text.split())

                return {
                    'success': True,
                    'file_path': pdf_path,
                    'metadata': {
                        'title': metadata.get('Title', ''),
                        'author': metadata.get('Author', ''),
                        'subject': metadata.get('Subject', ''),
                        'creator': metadata.get('Creator', ''),
                        'producer': metadata.get('Producer', ''),
                        'creation_date': metadata.get('CreationDate', ''),
                        'total_pages': len(pdf.pages),
                        'word_count': word_count
                    },
                    'content': {
                        'full_text': full_text.strip(),
                        'pages': page_texts,
                        'content_hash': content_hash
                    }
                }

        except FileNotFoundError:
            return {
                'success': False,
                'error': f'File not found: {pdf_path}'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error extracting PDF: {str(e)}'
            }

    def extract_tables(self, pdf_path: str) -> List[Dict]:
        """
        Extract tables from PDF (useful for structured agricultural data)

        Args:
            pdf_path: Path to the PDF file

        Returns:
            List of extracted tables with metadata
        """
        try:
            tables_data = []

            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    tables = page.extract_tables()

                    for table_num, table in enumerate(tables, 1):
                        tables_data.append({
                            'page_number': page_num,
                            'table_number': table_num,
                            'data': table
                        })

            return tables_data

        except Exception as e:
            print(f"Error extracting tables: {str(e)}")
            return []
