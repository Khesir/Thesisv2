"""
Crop Data Store (MongoDB-backed)
Loads and indexes crop data from MongoDB for RAG retrieval.
"""
import logging
from typing import Dict, List, Optional
from .db_connection import get_db

logger = logging.getLogger(__name__)


class CropStore:
    """Store and retrieve crop data from MongoDB for RAG"""

    def __init__(self):
        """Initialize crop store with MongoDB connection"""
        self.db = get_db()
        self.extracted_data_collection = self.db['extracteddatas']
        self.crop_index: Dict[str, Dict] = {}  # name -> crop data (in-memory cache)
        self.crop_texts: Dict[str, str] = {}  # name -> searchable text
        self.sources: List[str] = []  # For compatibility with API
        self.loaded = False

    def load_all(self) -> int:
        """
        Load all extracted crops from MongoDB.

        Returns:
            Number of crops loaded
        """
        if self.loaded:
            return len(self.crop_index)

        try:
            # Query all extracted data documents
            documents = list(self.extracted_data_collection.find({}))
            logger.info(f"Found {len(documents)} extracted data documents in MongoDB")

            crop_count = 0
            for doc in documents:
                # Create a crop record from extracted data
                crop_name = doc.get('cropName')
                if not crop_name:
                    # Create fallback identifier for incomplete data
                    crop_name = self._create_fallback_id(doc)

                if not crop_name:
                    continue

                # Normalize name for indexing
                key = crop_name.lower()

                # Build crop record from extracted data (MongoDB field names)
                crop_record = {
                    'name': crop_name,
                    'scientific_name': doc.get('scientificName'),
                    'category': doc.get('category', 'other'),
                    'soil_requirements': self._format_soil(doc.get('soilRequirements')),
                    'climate_requirements': self._format_climate(doc.get('climateRequirements')),
                    'growing_conditions': doc.get('plantingInfo'),
                    'farming_practices': doc.get('farmingPractices', []),
                    'pests_diseases': self._format_pests(doc.get('pestsDiseases', [])),
                    'recommendations': doc.get('recommendations', []),
                    'yield_information': doc.get('yieldInfo'),
                    'regional_data': doc.get('regionalData', []),
                    '_source': {
                        'doc_id': str(doc['_id']),
                        'chunk_id': doc.get('chunkId'),
                        'created_at': doc.get('createdAt'),
                        'is_incomplete': doc.get('cropName') is None
                    }
                }

                if key in self.crop_index:
                    # Merge with existing crop data
                    self._merge_crop(key, crop_record)
                else:
                    self.crop_index[key] = crop_record
                    self.crop_texts[key] = self._create_searchable_text(crop_record)

                crop_count += 1

            self.loaded = True
            self.sources = f"MongoDB ({crop_count} documents)"  # For tracking
            logger.info(f"Loaded {crop_count} crops from MongoDB")
            return crop_count

        except Exception as e:
            logger.error(f"Error loading crops from MongoDB: {e}")
            return 0

    def _create_fallback_id(self, doc: Dict) -> Optional[str]:
        """
        Create a fallback identifier for documents without cropName.
        Uses scientific name, category, or general prefix.
        """
        scientific_name = doc.get('scientificName')
        category = doc.get('category', 'other')
        chunk_id = str(doc.get('chunkId', ''))[:8]  # Use first 8 chars of chunk ID

        if scientific_name and scientific_name.strip():
            return f"{scientific_name}-info"
        elif category and category != 'other':
            return f"{category}-general"
        elif chunk_id and chunk_id != '':
            return f"unknown-{chunk_id}"
        else:
            return None

    def _format_soil(self, soil_data: Optional[Dict]) -> Dict:
        """Format soil requirements"""
        if not soil_data:
            return {}
        return {
            'types': soil_data.get('types', []),
            'ph_range': soil_data.get('ph_range'),
            'drainage': soil_data.get('drainage')
        }

    def _format_climate(self, climate_data: Optional[Dict]) -> Dict:
        """Format climate requirements"""
        if not climate_data:
            return {}
        return {
            'temperature': climate_data.get('temperature'),
            'rainfall': climate_data.get('rainfall'),
            'humidity': climate_data.get('humidity'),
            'conditions': climate_data.get('conditions', [])
        }

    def _format_pests(self, pests_data: List) -> List[Dict]:
        """Format pests and diseases"""
        formatted = []
        for pest in pests_data:
            if isinstance(pest, dict):
                formatted.append({
                    'name': pest.get('name'),
                    'type': pest.get('type'),
                    'treatment': pest.get('treatment')
                })
        return formatted

    def _merge_crop(self, key: str, new_crop: Dict):
        """Merge new crop data with existing entry"""
        existing = self.crop_index[key]

        # Merge list fields
        for field in ['farming_practices', 'pests_diseases', 'recommendations', 'regional_data']:
            if new_crop.get(field):
                if not existing.get(field):
                    existing[field] = []
                for item in new_crop[field]:
                    if item and item not in existing[field]:
                        existing[field].append(item)

        # Merge dict fields (take first non-null)
        for field in ['scientific_name', 'category', 'soil_requirements', 'climate_requirements', 'yield_information']:
            if new_crop.get(field) and not existing.get(field):
                existing[field] = new_crop[field]

        # Track multiple sources
        if '_sources' not in existing:
            existing['_sources'] = [existing.get('_source', {})]
        if new_crop.get('_source'):
            existing['_sources'].append(new_crop['_source'])

        # Update searchable text
        self.crop_texts[key] = self._create_searchable_text(existing)

    def _create_searchable_text(self, crop: Dict) -> str:
        """Create a searchable text representation of crop data"""
        parts = [crop.get('name', '')]

        if crop.get('scientific_name'):
            parts.append(crop['scientific_name'])

        if crop.get('category'):
            parts.append(crop['category'])

        # Soil
        soil = crop.get('soil_requirements', {})
        if soil.get('types'):
            parts.extend(soil['types'])
        if soil.get('ph_range'):
            parts.append(f"pH {soil['ph_range']}")

        # Climate
        climate = crop.get('climate_requirements', {})
        if climate.get('temperature'):
            parts.append(climate['temperature'])
        if climate.get('rainfall'):
            parts.append(climate['rainfall'])
        if climate.get('conditions'):
            parts.extend(climate['conditions'])

        # Growing conditions
        growing = crop.get('growing_conditions', {})
        if growing.get('season'):
            parts.append(growing['season'])
        if growing.get('method'):
            parts.append(growing['method'])

        # Practices
        if crop.get('farming_practices'):
            parts.extend(crop['farming_practices'])

        # Pest types
        if crop.get('pests_diseases'):
            for pest in crop['pests_diseases']:
                if pest.get('name'):
                    parts.append(pest['name'])
                if pest.get('type'):
                    parts.append(pest['type'])

        # Recommendations
        if crop.get('recommendations'):
            parts.extend(crop['recommendations'])

        # Regional info
        if crop.get('regional_data'):
            for region in crop['regional_data']:
                if region.get('region'):
                    parts.append(region['region'])

        return ' '.join(str(p) for p in parts if p).lower()

    def search(self, query: str, top_k: int = 3) -> List[Dict]:
        """
        Keyword-based search for crops.

        Args:
            query: Search query
            top_k: Number of results to return

        Returns:
            List of matching crops with scores
        """
        if not self.loaded:
            self.load_all()

        query_terms = query.lower().split()
        results = []

        for key, text in self.crop_texts.items():
            # Score: number of matching query terms
            score = sum(1 for term in query_terms if term in text)
            if score > 0:
                results.append({
                    'crop': self.crop_index[key],
                    'score': score,
                    'name': self.crop_index[key].get('name')
                })

        # Sort by score descending
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_k]

    def get_crop(self, crop_name: str) -> Optional[Dict]:
        """Get a specific crop by name"""
        if not self.loaded:
            self.load_all()

        key = crop_name.lower()
        return self.crop_index.get(key)

    def list_crops(self) -> List[str]:
        """Get list of all crop names"""
        if not self.loaded:
            self.load_all()

        return [crop.get('name', key) for key, crop in self.crop_index.items()]

    def get_crop_summary(self, crop: Dict) -> str:
        """Generate a text summary of crop data for LLM context"""
        lines = []
        name = crop.get('name', 'Unknown')

        lines.append(f"## {name}")

        scientific = crop.get('scientific_name')
        category = crop.get('category', 'other')
        if scientific:
            lines.append(f"Scientific name: {scientific}")
        lines.append(f"Category: {category}")

        # Soil requirements
        soil = crop.get('soil_requirements', {})
        if soil.get('types') or soil.get('ph_range'):
            lines.append("\n### Soil Requirements")
            if soil.get('types'):
                lines.append(f"- Soil types: {', '.join(soil['types'])}")
            if soil.get('ph_range'):
                lines.append(f"- pH range: {soil['ph_range']}")
            if soil.get('drainage'):
                lines.append(f"- Drainage: {soil['drainage']}")

        # Climate requirements
        climate = crop.get('climate_requirements', {})
        if any(climate.values()):
            lines.append("\n### Climate Requirements")
            if climate.get('temperature'):
                lines.append(f"- Temperature: {climate['temperature']}")
            if climate.get('rainfall'):
                lines.append(f"- Rainfall: {climate['rainfall']}")
            if climate.get('humidity'):
                lines.append(f"- Humidity: {climate['humidity']}")
            if climate.get('conditions'):
                lines.append(f"- Conditions: {', '.join(climate['conditions'])}")

        # Growing conditions
        growing = crop.get('growing_conditions', {})
        if any(growing.values() if isinstance(growing, dict) else []):
            lines.append("\n### Growing Information")
            if growing.get('season'):
                lines.append(f"- Season: {growing['season']}")
            if growing.get('method'):
                lines.append(f"- Method: {growing['method']}")
            if growing.get('spacing'):
                lines.append(f"- Spacing: {growing['spacing']}")
            if growing.get('duration'):
                lines.append(f"- Duration: {growing['duration']}")

        # Yield info
        yield_info = crop.get('yield_information', {})
        if any(yield_info.values() if isinstance(yield_info, dict) else []):
            lines.append("\n### Yield Information")
            if yield_info.get('average'):
                lines.append(f"- Average: {yield_info['average']}")
            if yield_info.get('range'):
                lines.append(f"- Range: {yield_info['range']}")
            if yield_info.get('unit'):
                lines.append(f"- Unit: {yield_info['unit']}")

        # Farming practices
        practices = crop.get('farming_practices', [])
        if practices:
            lines.append("\n### Farming Practices")
            for p in practices[:5]:  # Limit to top 5
                lines.append(f"- {p}")

        # Pests and diseases
        pests = crop.get('pests_diseases', [])
        if pests:
            lines.append("\n### Common Pests & Diseases")
            for pest in pests[:5]:
                if isinstance(pest, dict):
                    name = pest.get('name', 'Unknown')
                    pest_type = pest.get('type', '')
                    if pest_type:
                        lines.append(f"- {name} ({pest_type})")
                    else:
                        lines.append(f"- {name}")

        # Recommendations
        recs = crop.get('recommendations', [])
        if recs:
            lines.append("\n### Recommendations")
            for r in recs[:5]:  # Limit to top 5
                lines.append(f"- {r}")

        # Regional data
        regions = crop.get('regional_data', [])
        if regions:
            lines.append("\n### Regional Information")
            for region in regions[:3]:
                if isinstance(region, dict):
                    region_name = region.get('region')
                    info = region.get('specific_info')
                    if region_name and info:
                        lines.append(f"- {region_name}: {info}")

        # Mark incomplete if no crop name was available
        if crop.get('_source', {}).get('is_incomplete'):
            lines.append("\n*[Incomplete data - agricultural information without specific crop name]*")

        return '\n'.join(lines)
