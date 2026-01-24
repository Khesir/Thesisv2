"""
Text Preprocessing Module
Handles cleaning and preprocessing of extracted text
"""
import re
from typing import List, Dict


class TextProcessor:
    """Clean and preprocess text for information extraction"""

    def __init__(self):
        self.chunk_size = 1000  # tokens per chunk
        self.overlap = 200  # overlap between chunks

    def clean_text(self, text: str) -> str:
        """
        Clean and normalize text

        Args:
            text: Raw text to clean

        Returns:
            Cleaned text
        """
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)

        # Remove special characters but keep agricultural terms
        # Keep letters, numbers, basic punctuation, and degree symbol
        text = re.sub(r'[^\w\s.,;:()\-°%/]', '', text)

        # Normalize line breaks
        text = re.sub(r'\n+', '\n', text)

        # Remove leading/trailing whitespace
        text = text.strip()

        return text

    def segment_text(self, text: str, max_chunk_size: int = None) -> List[Dict]:
        """
        Split text into chunks for processing

        Args:
            text: Text to segment
            max_chunk_size: Maximum tokens per chunk

        Returns:
            List of text chunks with metadata
        """
        if max_chunk_size is None:
            max_chunk_size = self.chunk_size

        # Calculate max characters based on token estimate (1 token ≈ 4 characters)
        max_chars = max_chunk_size * 4

        # Try splitting by paragraphs first
        paragraphs = text.split('\n\n')

        # If no paragraph breaks found (single large block), split by sentences or fixed size
        if len(paragraphs) == 1 and len(text) > max_chars:
            return self._segment_by_sentences(text, max_chunk_size)

        chunks = []
        current_chunk = ""
        chunk_num = 0

        for paragraph in paragraphs:
            # Approximate token count (rough estimate: 1 token ≈ 4 characters)
            paragraph_tokens = len(paragraph) / 4
            current_tokens = len(current_chunk) / 4

            # If a single paragraph exceeds max size, split it further
            if paragraph_tokens > max_chunk_size:
                # Save current chunk if not empty
                if current_chunk:
                    chunks.append({
                        'chunk_id': chunk_num,
                        'text': current_chunk.strip(),
                        'token_count': int(current_tokens)
                    })
                    chunk_num += 1
                    current_chunk = ""

                # Split the large paragraph
                sub_chunks = self._segment_by_sentences(paragraph, max_chunk_size)
                for sub_chunk in sub_chunks:
                    sub_chunk['chunk_id'] = chunk_num
                    chunks.append(sub_chunk)
                    chunk_num += 1
                continue

            if current_tokens + paragraph_tokens > max_chunk_size and current_chunk:
                # Save current chunk
                chunks.append({
                    'chunk_id': chunk_num,
                    'text': current_chunk.strip(),
                    'token_count': int(current_tokens)
                })
                chunk_num += 1
                current_chunk = paragraph
            else:
                # Add to current chunk
                current_chunk += "\n\n" + paragraph if current_chunk else paragraph

        # Add the last chunk
        if current_chunk:
            chunks.append({
                'chunk_id': chunk_num,
                'text': current_chunk.strip(),
                'token_count': int(len(current_chunk) / 4)
            })

        return chunks

    def _segment_by_sentences(self, text: str, max_chunk_size: int) -> List[Dict]:
        """
        Split text by sentences when paragraph splitting isn't possible

        Args:
            text: Text to segment
            max_chunk_size: Maximum tokens per chunk

        Returns:
            List of text chunks with metadata
        """
        # Split by sentence-ending punctuation
        sentences = re.split(r'(?<=[.!?])\s+', text)

        chunks = []
        current_chunk = ""
        chunk_num = 0
        max_chars = max_chunk_size * 4

        for sentence in sentences:
            sentence_len = len(sentence)
            current_len = len(current_chunk)

            # If single sentence exceeds max, split by character count with word boundaries
            if sentence_len > max_chars:
                if current_chunk:
                    chunks.append({
                        'chunk_id': chunk_num,
                        'text': current_chunk.strip(),
                        'token_count': int(current_len / 4)
                    })
                    chunk_num += 1
                    current_chunk = ""

                # Split long sentence by words
                words = sentence.split()
                for word in words:
                    if len(current_chunk) + len(word) + 1 > max_chars and current_chunk:
                        chunks.append({
                            'chunk_id': chunk_num,
                            'text': current_chunk.strip(),
                            'token_count': int(len(current_chunk) / 4)
                        })
                        chunk_num += 1
                        current_chunk = word
                    else:
                        current_chunk += " " + word if current_chunk else word
                continue

            if current_len + sentence_len + 1 > max_chars and current_chunk:
                chunks.append({
                    'chunk_id': chunk_num,
                    'text': current_chunk.strip(),
                    'token_count': int(current_len / 4)
                })
                chunk_num += 1
                current_chunk = sentence
            else:
                current_chunk += " " + sentence if current_chunk else sentence

        if current_chunk:
            chunks.append({
                'chunk_id': chunk_num,
                'text': current_chunk.strip(),
                'token_count': int(len(current_chunk) / 4)
            })

        return chunks

    def extract_sections(self, text: str) -> Dict[str, str]:
        """
        Attempt to identify and extract document sections

        Args:
            text: Full document text

        Returns:
            Dictionary of section names to content
        """
        sections = {}

        # Common section headers in agricultural documents
        section_patterns = [
            r'(?i)(introduction|abstract|summary)',
            r'(?i)(materials and methods|methodology)',
            r'(?i)(results|findings)',
            r'(?i)(discussion)',
            r'(?i)(conclusion|recommendations)',
            r'(?i)(references|bibliography)'
        ]

        # Simple section extraction (can be improved)
        lines = text.split('\n')
        current_section = 'main'
        sections[current_section] = ""

        for line in lines:
            # Check if line is a section header
            is_header = False
            for pattern in section_patterns:
                if re.match(pattern, line.strip()) and len(line.strip()) < 50:
                    current_section = line.strip().lower()
                    sections[current_section] = ""
                    is_header = True
                    break

            if not is_header:
                sections[current_section] += line + "\n"

        return sections

    def preprocess(self, raw_text: str) -> Dict:
        """
        Complete preprocessing pipeline

        Args:
            raw_text: Raw extracted text

        Returns:
            Dictionary with cleaned text, chunks, and sections
        """
        # Clean text
        cleaned_text = self.clean_text(raw_text)

        # Extract sections
        sections = self.extract_sections(cleaned_text)

        # Create chunks
        chunks = self.segment_text(cleaned_text)

        return {
            'cleaned_text': cleaned_text,
            'sections': sections,
            'chunks': chunks,
            'total_chunks': len(chunks)
        }
