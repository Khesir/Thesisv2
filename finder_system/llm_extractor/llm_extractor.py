"""
LLM-Based Information Extraction Module
Uses LLM to extract structured agricultural information from text
"""
import json
import os
from typing import Dict, List, Optional
from anthropic import Anthropic


class LLMExtractor:
    """Extract structured agricultural information using LLM"""

    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-5-sonnet-20241022"):
        """
        Initialize the LLM extractor

        Args:
            api_key: Anthropic API key (or set ANTHROPIC_API_KEY env var)
            model: Claude model to use
        """
        self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
        if not self.api_key:
            raise ValueError("API key required. Set ANTHROPIC_API_KEY env var or pass api_key parameter")

        self.client = Anthropic(api_key=self.api_key)
        self.model = model

    def create_extraction_prompt(self, text: str) -> str:
        """
        Create a prompt for agricultural information extraction

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

    def extract_from_text(self, text: str, max_tokens: int = 4096) -> Dict:
        """
        Extract agricultural information from a text chunk

        Args:
            text: Text to analyze
            max_tokens: Maximum tokens for response

        Returns:
            Extracted structured data
        """
        try:
            prompt = self.create_extraction_prompt(text)

            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            # Extract the text content from response
            response_text = response.content[0].text

            # Parse JSON response
            extracted_data = json.loads(response_text)

            return {
                'success': True,
                'data': extracted_data,
                'model': self.model,
                'usage': {
                    'input_tokens': response.usage.input_tokens,
                    'output_tokens': response.usage.output_tokens
                }
            }

        except json.JSONDecodeError as e:
            return {
                'success': False,
                'error': f'Failed to parse JSON response: {str(e)}',
                'raw_response': response_text if 'response_text' in locals() else None
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Extraction failed: {str(e)}'
            }

    def extract_from_chunks(self, chunks: List[Dict], combine_results: bool = True) -> Dict:
        """
        Extract information from multiple text chunks

        Args:
            chunks: List of text chunks with metadata
            combine_results: Whether to combine results from all chunks

        Returns:
            Extracted data (combined or per-chunk)
        """
        results = []
        total_input_tokens = 0
        total_output_tokens = 0

        for chunk in chunks:
            chunk_text = chunk.get('text', '')
            chunk_id = chunk.get('chunk_id', 0)

            print(f"Processing chunk {chunk_id + 1}/{len(chunks)}...")

            extraction_result = self.extract_from_text(chunk_text)

            if extraction_result['success']:
                results.append({
                    'chunk_id': chunk_id,
                    'data': extraction_result['data'],
                    'usage': extraction_result['usage']
                })
                total_input_tokens += extraction_result['usage']['input_tokens']
                total_output_tokens += extraction_result['usage']['output_tokens']
            else:
                print(f"Warning: Chunk {chunk_id} extraction failed: {extraction_result.get('error')}")

        if combine_results:
            combined_data = self._combine_chunk_results(results)
            return {
                'success': True,
                'data': combined_data,
                'total_chunks_processed': len(results),
                'total_usage': {
                    'input_tokens': total_input_tokens,
                    'output_tokens': total_output_tokens
                }
            }
        else:
            return {
                'success': True,
                'chunk_results': results,
                'total_chunks_processed': len(results),
                'total_usage': {
                    'input_tokens': total_input_tokens,
                    'output_tokens': total_output_tokens
                }
            }

    def _combine_chunk_results(self, results: List[Dict]) -> Dict:
        """
        Combine extraction results from multiple chunks

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
            data = result['data']

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
        combined['climate_conditions']['other_conditions'] = list(set(combined['climate_conditions']['other_conditions']))
        combined['regional_data']['specific_recommendations'] = list(set(combined['regional_data']['specific_recommendations']))

        return combined
