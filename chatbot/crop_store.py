"""
Crop Data Store (MongoDB-backed)
Loads and indexes crop data from MongoDB for RAG retrieval.
Uses Gemini embeddings for semantic vector search with keyword fallback.
"""
import hashlib
import logging
import os
from typing import Dict, List, Optional

import numpy as np
import google.generativeai as genai

from .db_connection import get_db

logger = logging.getLogger(__name__)


class CropStore:
    """Store and retrieve crop data from MongoDB for RAG"""

    def __init__(self):
        """Initialize crop store with MongoDB connection"""
        self.db = get_db()
        self.extracted_data_collection = self.db['extracteddatas']  # Layer 1: Raw data (deprecated for loading)
        self.merged_data_collection = self.db['mergeddata']  # Layer 2: Production data (used for loading)
        self.embeddings_collection = self.db['crop_embeddings']
        self.crop_index: Dict[str, Dict] = {}  # name -> crop data (in-memory cache)
        self.crop_texts: Dict[str, str] = {}  # name -> searchable text
        self.crop_embeddings: Dict[str, np.ndarray] = {}  # name -> embedding vector
        self.sources: List[str] = []  # For compatibility with API
        self.loaded = False
        self.embedding_search_available = False
        self._init_embedding_client()

    def _init_embedding_client(self):
        """Configure Gemini for embedding generation"""
        api_key = os.getenv('GOOGLE_API_KEY')
        if api_key:
            try:
                genai.configure(api_key=api_key)
                logger.info("Gemini embedding client initialized")
            except Exception as e:
                logger.warning(f"Failed to init Gemini embedding client: {e}")

    def _hash_text(self, text: str) -> str:
        """SHA256 hash of text to detect data changes"""
        return hashlib.sha256(text.encode('utf-8')).hexdigest()

    def _embed_text(self, text: str) -> Optional[np.ndarray]:
        """Embed text using Gemini (for documents)"""
        try:
            result = genai.embed_content(
                model="models/embedding-001",
                content=text,
                task_type="retrieval_document"
            )
            return np.array(result['embedding'], dtype=np.float32)
        except Exception as e:
            logger.error(f"Embedding error: {e}")
            return None

    def _embed_query(self, query: str) -> Optional[np.ndarray]:
        """Embed text using Gemini (for queries)"""
        try:
            result = genai.embed_content(
                model="models/embedding-001",
                content=query,
                task_type="retrieval_query"
            )
            return np.array(result['embedding'], dtype=np.float32)
        except Exception as e:
            logger.error(f"Query embedding error: {e}")
            return None

    def _load_cached_embeddings(self) -> Dict[str, Dict]:
        """Load cached embeddings from MongoDB"""
        cache = {}
        try:
            for doc in self.embeddings_collection.find({}):
                cache[doc['crop_key']] = {
                    'hash': doc['text_hash'],
                    'embedding': np.array(doc['embedding'], dtype=np.float32)
                }
        except Exception as e:
            logger.warning(f"Failed to load embedding cache: {e}")
        return cache

    def _cache_embedding(self, key: str, text_hash: str, embedding: np.ndarray):
        """Upsert embedding to MongoDB cache"""
        try:
            self.embeddings_collection.update_one(
                {'crop_key': key},
                {'$set': {
                    'crop_key': key,
                    'text_hash': text_hash,
                    'embedding': embedding.tolist()
                }},
                upsert=True
            )
        except Exception as e:
            logger.warning(f"Failed to cache embedding for {key}: {e}")

    def _generate_embeddings(self):
        """Generate embeddings for all crops, using cache when possible"""
        if not os.getenv('GOOGLE_API_KEY'):
            logger.info("No GOOGLE_API_KEY set, skipping embedding generation")
            return

        cached = self._load_cached_embeddings()
        to_embed = []  # (key, text, hash) tuples for new/changed crops

        for key, text in self.crop_texts.items():
            text_hash = self._hash_text(text)
            if key in cached and cached[key]['hash'] == text_hash:
                # Use cached embedding
                self.crop_embeddings[key] = cached[key]['embedding']
            else:
                to_embed.append((key, text, text_hash))

        if not to_embed:
            logger.info(f"All {len(self.crop_embeddings)} embeddings loaded from cache")
            self.embedding_search_available = len(self.crop_embeddings) > 0
            return

        logger.info(f"Generating embeddings for {len(to_embed)} crops ({len(self.crop_embeddings)} cached)...")

        for key, text, text_hash in to_embed:
            embedding = self._embed_text(text)
            if embedding is not None:
                self.crop_embeddings[key] = embedding
                self._cache_embedding(key, text_hash, embedding)
            else:
                logger.warning(f"Failed to embed crop: {key}")

        self.embedding_search_available = len(self.crop_embeddings) > 0
        logger.info(f"Embedding generation complete. {len(self.crop_embeddings)} crops embedded.")

    def load_all(self) -> int:
        """
        Load all merged crops from MongoDB (Layer 2: Production data).
        Loads parent crops and links varieties for consolidated embeddings.

        Returns:
            Number of parent crops loaded
        """
        if self.loaded:
            return len(self.crop_index)

        try:
            # Query parent crops only (isVariety = false or not set)
            parent_crops = list(self.merged_data_collection.find({
                '$or': [
                    {'isVariety': {'$exists': False}},
                    {'isVariety': False}
                ]
            }))

            # Query all varieties
            varieties = list(self.merged_data_collection.find({'isVariety': True}))

            logger.info(f"Found {len(parent_crops)} parent crops and {len(varieties)} varieties in mergeddata")

            # Index varieties by parent crop ID
            varieties_by_parent = {}
            for variety in varieties:
                parent_id = str(variety.get('parentCrop'))
                if parent_id:
                    if parent_id not in varieties_by_parent:
                        varieties_by_parent[parent_id] = []
                    varieties_by_parent[parent_id].append(variety)

            crop_count = 0
            for doc in parent_crops:
                crop_name = doc.get('cropName')
                if not crop_name:
                    logger.warning(f"Skipping merged data document without cropName: {doc.get('_id')}")
                    continue

                # Normalize name for indexing
                key = crop_name.lower()

                # Build parent crop record from merged data (MongoDB field names)
                crop_record = {
                    'name': crop_name,
                    'scientific_name': doc.get('scientificName'),
                    'category': doc.get('category', 'other'),
                    'varieties': doc.get('varieties', []),  # Array of variety names
                    'alternative_names': doc.get('alternativeNames', []),  # Alternative names
                    'is_variety': False,
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
                        'validated_by': doc.get('validatedBy'),
                        'validated_at': doc.get('validatedAt'),
                        'source_documents': doc.get('sourceDocuments', []),
                        'merged_from': doc.get('mergedFrom', [])
                    },
                    # Store variety documents for RAG retrieval expansion
                    '_variety_docs': varieties_by_parent.get(str(doc['_id']), [])
                }

                self.crop_index[key] = crop_record
                # Create consolidated searchable text (includes variety keywords)
                self.crop_texts[key] = self._create_searchable_text(crop_record)
                crop_count += 1

            self.loaded = True
            self.sources = f"MongoDB mergeddata ({crop_count} parent crops, {len(varieties)} varieties)"
            logger.info(f"Loaded {crop_count} crops from mergeddata collection")

            # Generate consolidated embeddings (one per parent, includes variety keywords)
            self._generate_embeddings()

            return crop_count

        except Exception as e:
            logger.error(f"Error loading crops from mergeddata: {e}")
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
        """
        Create a searchable text representation of crop data.
        For parent crops, includes variety names and alternative names for consolidated embedding.
        """
        parts = [crop.get('name', '')]

        # Add alternative names (e.g., "Palay", "Bigas" for Rice)
        if crop.get('alternative_names'):
            parts.extend(crop['alternative_names'])

        if crop.get('scientific_name'):
            parts.append(crop['scientific_name'])

        if crop.get('category'):
            parts.append(crop['category'])

        # Add variety names for consolidated parent embedding
        if crop.get('varieties'):
            parts.extend(crop['varieties'])
            # Extract variety type keywords (e.g., "Wetland" from "Wetland Rice")
            for variety_name in crop['varieties']:
                variety_words = set(variety_name.lower().split())
                base_words = set(crop.get('name', '').lower().split())
                variety_type = ' '.join(variety_words - base_words)
                if variety_type.strip():
                    parts.append(variety_type)

        # Soil
        soil = crop.get('soil_requirements') or {}
        if soil.get('types'):
            parts.extend(soil['types'])
        if soil.get('ph_range'):
            parts.append(f"pH {soil['ph_range']}")

        # Climate
        climate = crop.get('climate_requirements') or {}
        if climate.get('temperature'):
            parts.append(climate['temperature'])
        if climate.get('rainfall'):
            parts.append(climate['rainfall'])
        if climate.get('conditions'):
            parts.extend(climate['conditions'])

        # Growing conditions
        growing = crop.get('growing_conditions') or {}
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

    def _keyword_search(self, query: str, top_k: int = 3) -> List[Dict]:
        """
        Keyword-based search for crops (fallback).

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
                    'crop': self.crop_index[key],
                    'score': float(score),
                    'name': self.crop_index[key].get('name')
                })

        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_k]

    def _vector_search(self, query_embedding: np.ndarray, top_k: int = 3) -> List[Dict]:
        """
        Cosine similarity search over in-memory crop embeddings.

        Args:
            query_embedding: Query embedding vector
            top_k: Number of results to return

        Returns:
            List of matching crops with cosine similarity scores
        """
        scores = []
        query_norm = np.linalg.norm(query_embedding)
        if query_norm == 0:
            return []

        for key, crop_emb in self.crop_embeddings.items():
            crop_norm = np.linalg.norm(crop_emb)
            if crop_norm == 0:
                continue
            similarity = float(np.dot(query_embedding, crop_emb) / (query_norm * crop_norm))
            scores.append((key, similarity))

        scores.sort(key=lambda x: x[1], reverse=True)

        results = []
        for key, similarity in scores[:top_k]:
            if similarity > 0:
                results.append({
                    'crop': self.crop_index[key],
                    'score': similarity,
                    'name': self.crop_index[key].get('name')
                })

        return results

    def search(self, query: str, top_k: int = 3) -> List[Dict]:
        """
        Search for crops using vector search with keyword fallback.

        Args:
            query: Search query
            top_k: Number of results to return

        Returns:
            List of matching crops with scores
        """
        if not self.loaded:
            self.load_all()

        # Try vector search first
        if self.embedding_search_available:
            query_embedding = self._embed_query(query)
            if query_embedding is not None:
                results = self._vector_search(query_embedding, top_k)
                if results:
                    return results

        # Fall back to keyword search
        return self._keyword_search(query, top_k)

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
