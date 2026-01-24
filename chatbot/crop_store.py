"""
Crop Data Store
Loads and indexes crop data from extracted JSON files for RAG retrieval.
"""
import json
import os
from typing import Dict, List, Optional
from pathlib import Path


class CropStore:
    """Store and retrieve crop data for RAG"""

    def __init__(self, extracted_dir: str = "extracted"):
        self.extracted_dir = Path(extracted_dir)
        self.crops: Dict[str, Dict] = {}  # name -> crop data
        self.crop_texts: Dict[str, str] = {}  # name -> searchable text
        self.sources: List[str] = []

    def load_all(self) -> int:
        """
        Load all extracted JSON files from the extracted directory.

        Returns:
            Number of crops loaded
        """
        if not self.extracted_dir.exists():
            print(f"Directory not found: {self.extracted_dir}")
            return 0

        json_files = list(self.extracted_dir.glob("*_extracted.json"))

        for json_file in json_files:
            self._load_file(json_file)
            self.sources.append(json_file.name)

        print(f"Loaded {len(self.crops)} crops from {len(json_files)} files")
        return len(self.crops)

    def _load_file(self, file_path: Path):
        """Load crops from a single extracted JSON file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            extracted = data.get('extracted_data', {})
            crops = extracted.get('crops', [])

            for crop in crops:
                name = crop.get('name', '').strip()
                if not name:
                    continue

                # Normalize name for indexing
                key = name.lower()

                if key in self.crops:
                    # Merge with existing crop data
                    self._merge_crop(key, crop)
                else:
                    self.crops[key] = crop
                    self.crop_texts[key] = self._create_searchable_text(crop)

        except Exception as e:
            print(f"Error loading {file_path}: {e}")

    def _merge_crop(self, key: str, new_crop: Dict):
        """Merge new crop data with existing entry"""
        existing = self.crops[key]

        # Merge list fields
        for field in ['farming_practices', 'pests_diseases', 'recommendations']:
            if new_crop.get(field):
                if not existing.get(field):
                    existing[field] = []
                for item in new_crop[field]:
                    if item and item not in existing[field]:
                        existing[field].append(item)

        # Merge dict fields (take first non-null)
        for field in ['scientific_name', 'category']:
            if new_crop.get(field) and not existing.get(field):
                existing[field] = new_crop[field]

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

        # Practices
        if crop.get('farming_practices'):
            parts.extend(crop['farming_practices'])

        # Recommendations
        if crop.get('recommendations'):
            parts.extend(crop['recommendations'])

        return ' '.join(str(p) for p in parts if p).lower()

    def search(self, query: str, top_k: int = 3) -> List[Dict]:
        """
        Simple keyword-based search for crops.

        Args:
            query: Search query
            top_k: Number of results to return

        Returns:
            List of matching crops with scores
        """
        query_terms = query.lower().split()
        results = []

        for key, text in self.crop_texts.items():
            score = sum(1 for term in query_terms if term in text)
            if score > 0:
                results.append({
                    'crop': self.crops[key],
                    'score': score,
                    'name': self.crops[key].get('name')
                })

        # Sort by score descending
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_k]

    def get_crop(self, name: str) -> Optional[Dict]:
        """Get a specific crop by name"""
        key = name.lower().strip()
        return self.crops.get(key)

    def list_crops(self) -> List[str]:
        """List all available crop names"""
        return [crop.get('name', key) for key, crop in self.crops.items()]

    def get_crop_summary(self, crop: Dict) -> str:
        """Generate a text summary of crop data for LLM context"""
        lines = []
        name = crop.get('name', 'Unknown')

        lines.append(f"## {name}")

        if crop.get('scientific_name'):
            lines.append(f"Scientific name: {crop['scientific_name']}")

        if crop.get('category'):
            lines.append(f"Category: {crop['category']}")

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
            if climate.get('conditions'):
                lines.append(f"- Conditions: {', '.join(climate['conditions'])}")

        # Nutrients
        nutrients = crop.get('nutrients', {})
        if nutrients:
            lines.append("\n### Nutrient Requirements")
            for nutrient, info in nutrients.items():
                if nutrient == 'other_nutrients':
                    for other in info or []:
                        lines.append(f"- {other.get('name', 'Unknown')}: {other.get('rate', 'N/A')}")
                elif isinstance(info, dict):
                    rate = info.get('rate', 'N/A')
                    timing = info.get('timing', '')
                    line = f"- {nutrient.title()}: {rate}"
                    if timing:
                        line += f" ({timing})"
                    lines.append(line)

        # Planting info
        planting = crop.get('planting_info', {})
        if any(planting.values()):
            lines.append("\n### Planting Information")
            if planting.get('season'):
                lines.append(f"- Season: {planting['season']}")
            if planting.get('method'):
                lines.append(f"- Method: {planting['method']}")
            if planting.get('spacing'):
                lines.append(f"- Spacing: {planting['spacing']}")
            if planting.get('duration'):
                lines.append(f"- Duration: {planting['duration']}")

        # Yield info
        yield_info = crop.get('yield_info', {})
        if any(yield_info.values()):
            lines.append("\n### Yield Information")
            if yield_info.get('average'):
                lines.append(f"- Average: {yield_info['average']}")
            if yield_info.get('range'):
                lines.append(f"- Range: {yield_info['range']}")

        # Farming practices
        practices = crop.get('farming_practices', [])
        if practices:
            lines.append("\n### Farming Practices")
            for p in practices[:5]:  # Limit to top 5
                lines.append(f"- {p}")

        # Recommendations
        recs = crop.get('recommendations', [])
        if recs:
            lines.append("\n### Recommendations")
            for r in recs[:5]:  # Limit to top 5
                lines.append(f"- {r}")

        return '\n'.join(lines)
