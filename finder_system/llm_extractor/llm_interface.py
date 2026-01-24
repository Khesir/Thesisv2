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
        Combine extraction results from multiple chunks into crop-centric structure.
        Optimized for RAG retrieval - each crop contains all its related information.

        Args:
            results: List of extraction results

        Returns:
            Combined data dictionary with crops as the primary structure
        """
        # Use a dict to merge crops by normalized name
        crops_dict = {}
        general_info = {
            'general_practices': [],
            'general_recommendations': [],
            'sources': []
        }

        def normalize_crop_name(name: str) -> str:
            """Normalize crop name for matching"""
            if not name:
                return ""
            return name.lower().strip()

        def merge_crop_data(existing: Dict, new: Dict) -> Dict:
            """Merge new crop data into existing crop entry"""
            # Update scientific name if not set
            if new.get('scientific_name') and not existing.get('scientific_name'):
                existing['scientific_name'] = new['scientific_name']

            # Update category if not set
            if new.get('category') and not existing.get('category'):
                existing['category'] = new['category']

            # Merge soil requirements
            if new.get('soil_requirements'):
                if not existing.get('soil_requirements'):
                    existing['soil_requirements'] = {'types': [], 'ph_range': None, 'drainage': None}
                nr = new['soil_requirements']
                er = existing['soil_requirements']
                if nr.get('types'):
                    er['types'] = list(set(er.get('types', []) + nr['types']))
                if nr.get('ph_range') and not er.get('ph_range'):
                    er['ph_range'] = nr['ph_range']
                if nr.get('drainage') and not er.get('drainage'):
                    er['drainage'] = nr['drainage']

            # Merge climate requirements
            if new.get('climate_requirements'):
                if not existing.get('climate_requirements'):
                    existing['climate_requirements'] = {'temperature': None, 'rainfall': None, 'humidity': None, 'conditions': []}
                nc = new['climate_requirements']
                ec = existing['climate_requirements']
                if nc.get('temperature') and not ec.get('temperature'):
                    ec['temperature'] = nc['temperature']
                if nc.get('rainfall') and not ec.get('rainfall'):
                    ec['rainfall'] = nc['rainfall']
                if nc.get('humidity') and not ec.get('humidity'):
                    ec['humidity'] = nc['humidity']
                if nc.get('conditions'):
                    ec['conditions'] = list(set(ec.get('conditions', []) + nc['conditions']))

            # Merge nutrients
            if new.get('nutrients'):
                if not existing.get('nutrients'):
                    existing['nutrients'] = {}
                for nutrient, info in new['nutrients'].items():
                    if nutrient not in existing['nutrients']:
                        existing['nutrients'][nutrient] = info
                    elif isinstance(info, dict) and isinstance(existing['nutrients'][nutrient], dict):
                        existing['nutrients'][nutrient].update({k: v for k, v in info.items() if v})

            # Merge list fields
            for field in ['farming_practices', 'pests_diseases', 'recommendations']:
                if new.get(field):
                    if not existing.get(field):
                        existing[field] = []
                    for item in new[field]:
                        if item and item not in existing[field]:
                            existing[field].append(item)

            # Merge yield info
            if new.get('yield_info'):
                if not existing.get('yield_info'):
                    existing['yield_info'] = {}
                existing['yield_info'].update({k: v for k, v in new['yield_info'].items() if v})

            # Merge planting info
            if new.get('planting_info'):
                if not existing.get('planting_info'):
                    existing['planting_info'] = {}
                existing['planting_info'].update({k: v for k, v in new['planting_info'].items() if v})

            # Merge regional data
            if new.get('regional_data'):
                if not existing.get('regional_data'):
                    existing['regional_data'] = []
                for region in new['regional_data']:
                    if region not in existing['regional_data']:
                        existing['regional_data'].append(region)

            return existing

        # Process each chunk result
        for result in results:
            data = result.get('data', {})

            # Process crops
            if data.get('crops'):
                for crop in data['crops']:
                    if not crop or not crop.get('name'):
                        continue

                    crop_key = normalize_crop_name(crop['name'])
                    if not crop_key:
                        continue

                    if crop_key not in crops_dict:
                        # Initialize new crop entry
                        crops_dict[crop_key] = {
                            'name': crop['name'],
                            'scientific_name': crop.get('scientific_name'),
                            'category': crop.get('category'),
                            'soil_requirements': crop.get('soil_requirements', {'types': [], 'ph_range': None, 'drainage': None}),
                            'climate_requirements': crop.get('climate_requirements', {'temperature': None, 'rainfall': None, 'humidity': None, 'conditions': []}),
                            'nutrients': crop.get('nutrients', {}),
                            'planting_info': crop.get('planting_info', {}),
                            'farming_practices': crop.get('farming_practices', []),
                            'pests_diseases': crop.get('pests_diseases', []),
                            'yield_info': crop.get('yield_info', {}),
                            'regional_data': crop.get('regional_data', []),
                            'recommendations': crop.get('recommendations', [])
                        }
                    else:
                        # Merge with existing crop data
                        crops_dict[crop_key] = merge_crop_data(crops_dict[crop_key], crop)

            # Collect general info not tied to specific crops
            if data.get('general_practices'):
                for practice in data['general_practices']:
                    if practice and practice not in general_info['general_practices']:
                        general_info['general_practices'].append(practice)

            if data.get('general_recommendations'):
                for rec in data['general_recommendations']:
                    if rec and rec not in general_info['general_recommendations']:
                        general_info['general_recommendations'].append(rec)

            if data.get('source_summary'):
                general_info['sources'].append(data['source_summary'])

        # Convert crops dict to list
        crops_list = list(crops_dict.values())

        return {
            'crops': crops_list,
            'general_info': general_info,
            'total_crops_extracted': len(crops_list)
        }


class BaseLLMExtractor(LLMExtractorInterface):
    """
    Base implementation with common functionality
    Concrete adapters should inherit from this class
    """

    def create_extraction_prompt(self, text: str) -> str:
        """
        Crop-centric extraction prompt optimized for RAG retrieval.
        Groups all information by crop for better conversational recommendations.

        Args:
            text: Text chunk to analyze

        Returns:
            Formatted prompt
        """
        prompt = f"""You are an agricultural information extraction expert. Extract crop-centric data from the text below.

IMPORTANT: Organize ALL information BY CROP. Each crop should contain all its related soil, climate, nutrient, and practice information together. This enables a chatbot to retrieve complete information when a user asks about a specific crop.

Text to analyze:
{text}

Extract and return a JSON object with this CROP-CENTRIC structure:
{{
  "crops": [
    {{
      "name": "Crop Name (use proper capitalization)",
      "scientific_name": "Scientific name if mentioned, otherwise null",
      "category": "cereal|vegetable|fruit|legume|oilseed|tuber|other",
      "soil_requirements": {{
        "types": ["suitable soil types for THIS crop"],
        "ph_range": "optimal pH range for THIS crop (e.g., '6.0-7.0')",
        "drainage": "drainage requirements"
      }},
      "climate_requirements": {{
        "temperature": "temperature range or climate zone",
        "rainfall": "water/rainfall needs (e.g., '450-650mm annually')",
        "humidity": "humidity preferences if mentioned",
        "conditions": ["other climate factors like 'temperate', 'semi-arid']
      }},
      "nutrients": {{
        "nitrogen": {{"rate": "amount per hectare", "timing": "when to apply", "notes": "special instructions"}},
        "phosphorus": {{"rate": "amount", "timing": "when to apply", "notes": "any notes"}},
        "potassium": {{"rate": "amount", "timing": "when to apply", "notes": "any notes"}},
        "other_nutrients": [{{"name": "nutrient name", "rate": "amount", "notes": "instructions"}}]
      }},
      "planting_info": {{
        "season": "best planting season/time",
        "method": "planting method",
        "spacing": "plant spacing if mentioned",
        "duration": "growing period/days to maturity"
      }},
      "farming_practices": ["specific practices for THIS crop"],
      "pests_diseases": [
        {{"name": "pest/disease name", "type": "pest|disease", "treatment": "control method if mentioned"}}
      ],
      "yield_info": {{
        "average": "typical yield",
        "range": "yield range (e.g., '1-14 tonnes/ha')",
        "unit": "tonnes/ha or other unit"
      }},
      "regional_data": [
        {{"region": "region name", "specific_info": "region-specific data for this crop"}}
      ],
      "recommendations": ["specific recommendations for growing THIS crop successfully"]
    }}
  ],
  "general_practices": ["farming practices not specific to any single crop"],
  "general_recommendations": ["general agricultural advice not crop-specific"],
  "source_summary": "brief summary of what this text chunk covers"
}}

CRITICAL RULES:
1. ASSOCIATE all information with the SPECIFIC CROP it relates to
2. If fertilizer rates or practices are mentioned for a crop, put them IN that crop's entry
3. Do NOT create separate flat lists - embed everything within the relevant crop
4. Use null for missing fields, empty arrays [] for empty lists
5. Only extract information explicitly stated - do not hallucinate
6. If text mentions multiple crops, create separate entries for each with their specific data
7. Use consistent units (prefer kg/ha for nutrients, tonnes/ha for yield)

Return ONLY the JSON object, no markdown code blocks or additional text."""

        return prompt
