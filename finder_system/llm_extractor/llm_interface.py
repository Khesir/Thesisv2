"""
Abstract Base Class for LLM Extractors
Defines the interface that all LLM adapters must implement
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class ExtractionResult:
    """Standardized result format for all LLM extractors"""
    success: bool
    data: Optional[Dict] = None
    error: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    usage: Optional[Dict] = None
    raw_response: Optional[str] = None


@dataclass
class ChunkExtractionResult:
    """Result for multi-chunk extraction"""
    success: bool
    data: Optional[Dict] = None
    chunk_results: Optional[List[Dict]] = None
    total_chunks_processed: int = 0
    total_usage: Optional[Dict] = None
    provider: Optional[str] = None
    error: Optional[str] = None


class LLMExtractorInterface(ABC):
    """
    Abstract base class for LLM-based information extractors.
    All LLM adapters must implement this interface.
    """

    @abstractmethod
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None, **kwargs):
        """
        Initialize the LLM extractor

        Args:
            api_key: API key for the service (if required)
            model: Model identifier to use
            **kwargs: Additional provider-specific configuration
        """
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """
        Get the name of the LLM provider

        Returns:
            Provider name (e.g., 'claude', 'ollama', 'gemini')
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if this provider is available and properly configured

        Returns:
            True if the provider can be used, False otherwise
        """
        pass

    @abstractmethod
    def get_token_limit(self) -> int:
        """
        Get the maximum token limit for this provider/model

        Returns:
            Maximum number of tokens allowed
        """
        pass

    @abstractmethod
    def create_extraction_prompt(self, text: str) -> str:
        """
        Create a prompt for agricultural information extraction

        Args:
            text: Text chunk to analyze

        Returns:
            Formatted prompt string
        """
        pass

    @abstractmethod
    def extract_from_text(self, text: str, max_tokens: Optional[int] = None) -> ExtractionResult:
        """
        Extract agricultural information from a text chunk

        Args:
            text: Text to analyze
            max_tokens: Maximum tokens for response (optional)

        Returns:
            ExtractionResult object
        """
        pass

    @abstractmethod
    def extract_from_chunks(
        self,
        chunks: List[Dict],
        combine_results: bool = True
    ) -> ChunkExtractionResult:
        """
        Extract information from multiple text chunks

        Args:
            chunks: List of text chunks with metadata
            combine_results: Whether to combine results from all chunks

        Returns:
            ChunkExtractionResult object
        """
        pass

    def _combine_chunk_results(self, results: List[Dict]) -> Dict:
        """
        Default implementation for combining extraction results from multiple chunks
        Can be overridden by specific adapters if needed

        Args:
            results: List of extraction results

        Returns:
            Combined data dictionary
        """
        combined = {
            'crops': [],
            'soil_types': [],
            'climate_conditions': {
                'temperature_range': None,
                'rainfall': None,
                'sunlight': None,
                'other_conditions': []
            },
            'growing_conditions': {
                'soil_ph': None,
                'planting_season': None,
                'growing_period': None
            },
            'pests_diseases': [],
            'farming_practices': [],
            'fertilizers': [],
            'yield_information': {
                'average_yield': None,
                'unit': None
            },
            'regional_data': {
                'region': None,
                'specific_recommendations': []
            },
            'recommendations': [],
            'summaries': []
        }

        # Combine data from all chunks
        for result in results:
            data = result.get('data', {})

            # Combine crops (avoid duplicates)
            if data.get('crops'):
                for crop in data['crops']:
                    if crop and crop not in combined['crops']:
                        combined['crops'].append(crop)

            # Combine soil types
            if data.get('soil_types'):
                for soil in data['soil_types']:
                    if soil and soil not in combined['soil_types']:
                        combined['soil_types'].append(soil)

            # Combine climate conditions
            if data.get('climate_conditions'):
                cc = data['climate_conditions']
                if cc.get('temperature_range') and not combined['climate_conditions']['temperature_range']:
                    combined['climate_conditions']['temperature_range'] = cc['temperature_range']
                if cc.get('rainfall') and not combined['climate_conditions']['rainfall']:
                    combined['climate_conditions']['rainfall'] = cc['rainfall']
                if cc.get('sunlight') and not combined['climate_conditions']['sunlight']:
                    combined['climate_conditions']['sunlight'] = cc['sunlight']
                if cc.get('other_conditions'):
                    combined['climate_conditions']['other_conditions'].extend(cc['other_conditions'])

            # Combine growing conditions
            if data.get('growing_conditions'):
                gc = data['growing_conditions']
                if gc.get('soil_ph') and not combined['growing_conditions']['soil_ph']:
                    combined['growing_conditions']['soil_ph'] = gc['soil_ph']
                if gc.get('planting_season') and not combined['growing_conditions']['planting_season']:
                    combined['growing_conditions']['planting_season'] = gc['planting_season']
                if gc.get('growing_period') and not combined['growing_conditions']['growing_period']:
                    combined['growing_conditions']['growing_period'] = gc['growing_period']

            # Combine pests and diseases
            if data.get('pests_diseases'):
                for pest in data['pests_diseases']:
                    if pest and pest not in combined['pests_diseases']:
                        combined['pests_diseases'].append(pest)

            # Combine farming practices
            if data.get('farming_practices'):
                for practice in data['farming_practices']:
                    if practice and practice not in combined['farming_practices']:
                        combined['farming_practices'].append(practice)

            # Combine fertilizers
            if data.get('fertilizers'):
                for fert in data['fertilizers']:
                    if fert and fert not in combined['fertilizers']:
                        combined['fertilizers'].append(fert)

            # Combine yield information
            if data.get('yield_information'):
                yi = data['yield_information']
                if yi.get('average_yield') and not combined['yield_information']['average_yield']:
                    combined['yield_information']['average_yield'] = yi['average_yield']
                if yi.get('unit') and not combined['yield_information']['unit']:
                    combined['yield_information']['unit'] = yi['unit']

            # Combine regional data
            if data.get('regional_data'):
                rd = data['regional_data']
                if rd.get('region') and not combined['regional_data']['region']:
                    combined['regional_data']['region'] = rd['region']
                if rd.get('specific_recommendations'):
                    combined['regional_data']['specific_recommendations'].extend(rd['specific_recommendations'])

            # Combine recommendations
            if data.get('recommendations'):
                for rec in data['recommendations']:
                    if rec and rec not in combined['recommendations']:
                        combined['recommendations'].append(rec)

            # Collect summaries
            if data.get('summary'):
                combined['summaries'].append(data['summary'])

        # Remove duplicates from list fields
        combined['climate_conditions']['other_conditions'] = list(set(
            combined['climate_conditions']['other_conditions']
        ))
        combined['regional_data']['specific_recommendations'] = list(set(
            combined['regional_data']['specific_recommendations']
        ))

        return combined


class BaseLLMExtractor(LLMExtractorInterface):
    """
    Base implementation with common functionality
    Concrete adapters should inherit from this class
    """

    def create_extraction_prompt(self, text: str) -> str:
        """
        Default extraction prompt template for agricultural information
        Can be overridden by specific adapters

        Args:
            text: Text chunk to analyze

        Returns:
            Formatted prompt
        """
        prompt = f"""You are an agricultural information extraction expert. Analyze the following text and extract structured agricultural information.

Text to analyze:
{text}

Extract and return a JSON object with the following structure:
{{
  "crops": [
    {{
      "name": "crop name",
      "scientific_name": "scientific name if mentioned",
      "category": "cereal|vegetable|fruit|legume|other"
    }}
  ],
  "soil_types": ["list of soil types mentioned"],
  "climate_conditions": {{
    "temperature_range": "temperature range if mentioned",
    "rainfall": "rainfall requirements if mentioned",
    "sunlight": "sunlight requirements if mentioned",
    "other_conditions": ["other climate factors"]
  }},
  "growing_conditions": {{
    "soil_ph": "pH range if mentioned",
    "planting_season": "best planting time if mentioned",
    "growing_period": "duration if mentioned"
  }},
  "pests_diseases": [
    {{
      "name": "pest or disease name",
      "type": "pest|disease|weed",
      "affected_crops": ["crops affected"]
    }}
  ],
  "farming_practices": ["list of farming practices or techniques mentioned"],
  "fertilizers": ["types of fertilizers or nutrients mentioned"],
  "yield_information": {{
    "average_yield": "yield data if mentioned",
    "unit": "unit of measurement"
  }},
  "regional_data": {{
    "region": "geographical region if mentioned",
    "specific_recommendations": ["region-specific recommendations"]
  }},
  "recommendations": ["any agricultural recommendations or best practices"],
  "summary": "brief summary of the key agricultural information in this text"
}}

Important:
- Only include information explicitly mentioned in the text
- Use null for fields where information is not available
- Use empty arrays [] for list fields with no data
- Be accurate and do not hallucinate information
- If the text is not about agriculture, return a JSON with all fields as null/empty and a note in summary

Return ONLY the JSON object, no additional text."""

        return prompt
