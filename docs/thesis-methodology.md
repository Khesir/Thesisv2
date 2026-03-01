# Chapter 3: Methodology

## 3.1 Conceptual Framework

This study is grounded in the integration of **Information Extraction (IE)**, **Natural Language Processing (NLP)**, and **Retrieval-Augmented Generation (RAG)** to address the challenge of unstructured agricultural knowledge locked within institutional PDF documents. The conceptual framework posits that raw, unstructured text—when systematically extracted, structured, and indexed—can serve as a reliable knowledge base for intelligent query systems.

The framework operates on three theoretical pillars:

1. **Knowledge Extraction Theory** — Structured information can be derived from unstructured text through LLM-driven extraction prompting, where a language model acts as a zero-shot or few-shot extractor rather than a generator.
2. **Chunking and Semantic Indexing** — Document decomposition into semantically coherent chunks, followed by vector embedding, enables precise passage retrieval over large corpora.
3. **Grounded Generation** — Augmenting a generative model's responses with retrieved document context (RAG) reduces hallucination and anchors answers to verifiable source material.

The conceptual framework is visualized as a pipeline:

```
PDF Documents
     ↓
Text Extraction & Chunking
     ↓
LLM-Based Structured Extraction → Structured Crop Data (MongoDB)
     ↓
Vector Embedding & Indexing
     ↓
RAG Chatbot (Query → Retrieve → Generate → Response)
```

## 3.2 Research Framework

This study follows a **Design Science Research (DSR)** methodology, which emphasizes the construction and evaluation of an artifact (the extraction and chatbot system) to solve a practical problem (inaccessible agricultural knowledge). The research framework proceeds through the following phases:

| Phase | Activity | Output |
|---|---|---|
| Problem Identification | Literature review, stakeholder input | Research gaps and requirements |
| System Design | Architecture and pipeline design | System blueprint |
| System Development | Implementation of web panel, LLM Extraction Module, chatbot API | Working prototype |
| Evaluation | Extraction accuracy, chatbot performance, user survey | Evaluation metrics |
| Communication | Documentation, thesis writing | Final thesis artifact |

The framework is iterative — evaluation findings feed back into design refinements prior to the final evaluation round.

### 3.2.1 Research Questions

1. How accurately can a multi-provider LLM pipeline extract structured crop data from agricultural PDF documents?
2. How effectively does the RAG-based chatbot respond to agricultural queries compared to baseline retrieval-only approaches?
3. What is the perceived usability and usefulness of the system according to end-users (agriculture students and practitioners)?

### 3.2.2 System Architecture Overview

The system consists of three integrated components:

- **Web Panel** — A Next.js 15 (App Router) dashboard that manages the full extraction pipeline, token management, and data visualization.
- **LLM Extraction Module** — A Python library that handles PDF text extraction, chunk creation, and multi-provider LLM extraction (Claude, Gemini, Ollama) with failover and round-robin strategies.
- **Chatbot API** — A FastAPI service that exposes the RAG pipeline for crop-related natural language queries.

---

## 3.3 Data Collection

The dataset for this study consists of official Philippine agricultural reference documents collected manually from publicly accessible government online repositories. The collection and use of these documents required no special permissions, as all materials are classified as public government information.

### 3.3.1 Document Sources

Source documents were obtained from recognized national agricultural institutions, primarily the Department of Agriculture (DA) and the Philippine Rice Research Institute (PhilRice). These agencies were selected because they are the principal government authorities responsible for issuing crop production standards, pest management guidelines, and agricultural technical recommendations in the Philippines. All documents were accessed through their official online repositories in PDF format.

### 3.3.2 Inclusion Criteria

Documents were included in the corpus based on the following criteria:

1. **Institutional authority** — issued by a recognized national or regional Philippine government agricultural agency
2. **Content relevance** — directly pertains to crop cultivation, pest and disease management, or yield-related information
3. **Technical parsability** — available as a digitally parseable PDF containing an embedded text layer

Documents failing any criterion were excluded. Scanned PDFs with no embedded text layer were excluded due to the absence of optical character recognition (OCR) in the current pipeline.

### 3.3.3 Corpus Composition

The compiled corpus includes **[N] PDF documents** spanning **[N] crop varieties**, comprising technical production guides, crop management manuals, pest and disease bulletins, and research-based recommendations. Documents range from [N] to [N] pages in length, with an average of [N] pages per document. The corpus collectively covers [N] distinct document categories and represents [N] issuing agencies.

### 3.3.4 Evaluation Framing

Because all source documents originate from authoritative government institutions, their content is treated as institutionally validated without independent expert re-annotation. Accordingly, system evaluation in this study measures **extraction fidelity** — the degree to which the system accurately and completely captures information as stated in the original source text — rather than the factual correctness of the underlying agricultural content itself. This distinction is important: a low-fidelity extraction is a system error; a factual inaccuracy in the source document is outside the scope of this study's evaluation.

---

## 3.4 Data Preprocessing

Raw PDF documents contain unstructured text interleaved with layout artifacts such as page numbers, repeated headers, and formatting characters. Before LLM processing, each document undergoes a three-stage preprocessing pipeline: text extraction, cleaning and normalization, and segmentation into chunks. The pipeline is implemented in the `finder_system` Python library and is orchestrated by the web panel via a JSON-over-stdin/stdout subprocess protocol.

> **Figure 3.1** — Data preprocessing pipeline overview
> `[INSERT FIGURE: flowchart showing PDF → extract_text.py → TextProcessor.clean_text() → TextProcessor.segment_text() → Chunks stored in MongoDB]`

### 3.4.1 PDF Text Extraction

Text is extracted from PDF files using `pdfplumber`, a Python library that parses PDF content streams to recover embedded text while preserving spatial structure. Each page is processed individually via `page.extract_text()`, and the resulting page texts are concatenated with double newline delimiters (`\n\n`) to maintain paragraph-level separation across page boundaries. Alongside the text, document metadata is collected — including title, author, page count, and word count. A SHA-256 hash of the full extracted text is generated at this stage for deduplication purposes.

The extraction process does not apply structural filtering; page numbers, running headers, figure captions, and reference sections are included in the output as-is. This is acknowledged as a preprocessing limitation discussed further in Section [X.X].

```python
# finder_system/pdf_extractor.py (excerpt)
with pdfplumber.open(pdf_path) as pdf:
    full_text = ""
    for page in pdf.pages:
        page_text = page.extract_text() or ""
        full_text += page_text + "\n\n"

content_hash = hashlib.sha256(full_text.encode()).hexdigest()
```

> **Figure 3.2** — Web panel Processing page: PDF upload and text extraction step
> `[INSERT SCREENSHOT: web panel /processing page showing a PDF being uploaded and the extracted text preview]`

### 3.4.2 Text Cleaning and Normalization

The raw extracted text is passed through a normalization routine (`TextProcessor.clean_text()`) that applies three transformations in sequence:

1. **Whitespace normalization** — consecutive whitespace characters, including tabs and multiple spaces, are collapsed into a single space; repeated newlines are reduced to a single occurrence
2. **Character filtering** — non-word characters are removed, with explicit retention of symbols common in agricultural data: the degree symbol (`°`), percent sign (`%`), and forward slash (`/`)
3. **Boundary trimming** — leading and trailing whitespace is removed from the resulting string

```python
# finder_system/text_processor.py (excerpt)
def clean_text(self, text: str) -> str:
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[^\w\s.,;:()\-°%/]', '', text)
    text = re.sub(r'\n+', '\n', text)
    return text.strip()
```

Following cleaning, a section detector (`TextProcessor.extract_sections()`) applies regex pattern matching against common academic section headings — *Introduction*, *Materials and Methods*, *Results*, *Discussion*, *Conclusion*, and *References* — to annotate structural boundaries within the document. Section labels are recorded as metadata but are not used to filter or exclude content from LLM processing at this stage.

### 3.4.3 Text Segmentation and Chunking

The cleaned text is segmented into fixed-size chunks for LLM processing using a hierarchical boundary-respecting strategy (`TextProcessor.segment_text()`). The chunker applies the following cascade:

1. **Paragraph-first splitting** — the text is split at double-newline boundaries (`\n\n`), preserving logical paragraph units as the primary unit of segmentation
2. **Sentence-level fallback** — paragraphs that exceed the configured token limit are further split at sentence-ending punctuation (`[.!?]`)
3. **Word-level fallback** — individual sentences that still exceed the limit are split at word boundaries, guaranteeing the chunk size constraint is always met

The default chunk size is **1,000 tokens**, approximated at a ratio of four characters per token. This parameter is configurable at runtime via the web panel interface. No chunk overlap is applied; each chunk represents a non-overlapping, contiguous segment of the source text.

```python
# finder_system/text_processor.py (excerpt)
def segment_text(self, text: str, max_chunk_size: int = 1000) -> List[Dict]:
    max_chars = max_chunk_size * 4
    paragraphs = text.split('\n\n')

    # Fall back to sentence splitting if no paragraph breaks
    if len(paragraphs) == 1 and len(text) > max_chars:
        return self._segment_by_sentences(text, max_chunk_size)

    chunks = []
    current_chunk = ""
    for paragraph in paragraphs:
        if len(paragraph) / 4 > max_chunk_size:
            # Paragraph too large — split by sentences
            sub_chunks = self._segment_by_sentences(paragraph, max_chunk_size)
            chunks.extend(sub_chunks)
        elif len(current_chunk) / 4 + len(paragraph) / 4 > max_chunk_size:
            chunks.append({'text': current_chunk.strip(), ...})
            current_chunk = paragraph
        else:
            current_chunk += "\n\n" + paragraph if current_chunk else paragraph
    return chunks
```

Each chunk is stored in MongoDB with a sequential index, source document reference, raw content string, and estimated token count.

> **Figure 3.3** — Web panel Chunks page: list of generated chunks with token counts and source document
> `[INSERT SCREENSHOT: web panel /chunks page showing chunk list with index, preview text, and token count columns]`

### 3.4.4 LLM-Based Structured Extraction

Each chunk is submitted individually to the LLM extraction pipeline via the `extract_chunk` script. The LLM is instructed through a structured prompt to act as an agricultural information extraction expert and return a fixed JSON schema containing the following fields:

| Field | Description |
|---|---|
| `crops` | Crop name, scientific name, and category |
| `soil_types` | Soil type requirements mentioned |
| `climate_conditions` | Temperature range, rainfall, sunlight requirements |
| `growing_conditions` | Soil pH, planting season, growing period |
| `pests_diseases` | Pest or disease name, type, and affected crops |
| `fertilizers` | Fertilizer types or nutrient recommendations |
| `yield_information` | Average yield and unit of measurement |
| `recommendations` | General agricultural best practices |

The prompt includes explicit negative instructions to return `null` for absent fields rather than inferring or generating values, directly mitigating hallucination risk.

```python
# finder_system/llm_extractor/llm_extractor.py (excerpt — prompt structure)
prompt = f"""You are an agricultural information extraction expert. Analyze the
following text and extract structured agricultural information.

Text to analyze:
{text}

Important:
- Only include information explicitly mentioned in the text
- Use null for fields where information is not available
- Be accurate and do not hallucinate information

Return ONLY the JSON object, no additional text."""
```

The multi-provider orchestrator supports **Claude (Anthropic)**, **Gemini (Google)**, and **Ollama (local)** backends. Provider selection is governed by a configurable strategy:

| Strategy | Behavior |
|---|---|
| `failover` | Uses the primary provider; automatically switches on quota exhaustion or error |
| `round_robin` | Distributes requests evenly across all configured providers |
| `cost_optimized` | Prefers lower-cost providers when quality is equivalent |
| `performance` | Routes to the historically fastest or highest-accuracy provider |

> **Figure 3.4** — Web panel Extraction page: per-chunk LLM extraction progress and provider status
> `[INSERT SCREENSHOT: web panel /extraction page showing extraction queue, provider indicator, and per-chunk status]`

### 3.4.5 Post-Extraction Validation and Deduplication

After extraction, each record is validated for schema compliance — confirming that the returned JSON contains the expected fields and data types. Records that fail schema validation are flagged in the database with an error status and excluded from downstream retrieval indexing. Cross-chunk deduplication is performed using the SHA-256 content hash generated during extraction; re-submitted documents with identical content do not produce duplicate extraction records.

---

## 3.5 Semantic Indexing and Retrieval

Following structured extraction, the preprocessed chunk text and associated metadata are transformed into a form suitable for semantic retrieval. This section describes how chunk embeddings are generated and indexed, how extracted metadata is attached to vector records for filtered retrieval, and how incoming user queries are preprocessed before being issued to the retrieval system. These steps constitute the core of the RAG pipeline's knowledge base and determine the quality of context supplied to the generation model.

### 3.5.1 Vector Embedding for Retrieval

Crop text is transformed into dense vector representations using the `gemini-embedding-001` model (Google Generative AI), accessed through the `google-genai` Python SDK. This model produces fixed-dimension float32 vectors that encode the semantic meaning of agricultural text, enabling similarity-based retrieval that goes beyond what keyword matching alone can achieve.

The embedding pipeline distinguishes between document-time and query-time embeddings by specifying a task type at generation. When embedding stored crop records, the `RETRIEVAL_DOCUMENT` task type is passed to the model, which biases the representation toward dense, content-rich encoding suited for storage. This distinction ensures that document and query vectors inhabit compatible regions of the shared embedding space.

```python
# chatbot/crop_store.py (excerpt)
def _embed_text(self, text: str) -> Optional[np.ndarray]:
    result = self._genai_client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
    )
    return np.array(result.embeddings[0].values, dtype=np.float32)
```

Because embedding generation incurs API cost and latency, the system maintains a persistent embedding cache in a dedicated MongoDB collection (`crop_embeddings`). Before generating a new embedding, the pipeline computes a SHA-256 hash of the crop's searchable text and compares it against the stored hash. If the hash matches, the cached vector is loaded directly. If it differs — indicating that the underlying crop data has changed since the last run — the embedding is regenerated and the cache is updated via an upsert operation. This cache-on-content-hash strategy ensures that repeated service restarts do not trigger unnecessary re-embedding while still reflecting data updates accurately.

> **Figure 3.5** — Embedding generation and caching flow: crop text → SHA-256 hash check → cached load or Gemini API call → `crop_embeddings` collection upsert
> `[INSERT FIGURE: flowchart showing the hash-check branch between cache hit and API call paths]`

### 3.5.2 Metadata Enrichment

Structured fields extracted by the LLM pipeline are attached to each crop's in-memory record during the data loading phase. When the chatbot service initializes, `CropStore.load_all()` queries the `extracteddatas` MongoDB collection for all validated records — those with a non-null `validatedAt` timestamp and a non-empty `cropName` field. Each document is mapped into a typed crop record containing fields for soil requirements, climate requirements, growing conditions, pests and diseases, yield information, and regional data alongside a `_source` reference that preserves the originating document ID and chunk ID.

```python
# chatbot/crop_store.py (excerpt)
crop_record = {
    'name': crop_name,
    'scientific_name': doc.get('scientificName'),
    'category': doc.get('category', 'other'),
    'soil_requirements': self._format_soil(doc.get('soilRequirements')),
    'climate_requirements': self._format_climate(doc.get('climateRequirements')),
    'pests_diseases': self._format_pests(doc.get('pestsDiseases', [])),
    'yield_information': doc.get('yieldInfo'),
    '_source': {
        'doc_id': str(doc['_id']),
        'chunk_id': str(doc.get('chunkId', '')),
        'validated_at': doc.get('validatedAt'),
    }
}
```

Multiple extraction records sharing the same crop name — which arise naturally from a multi-chunk document — are merged in-memory via `_merge_crop()`. List fields such as `farming_practices`, `pests_diseases`, and `recommendations` are deduplicated and extended across records; scalar fields such as `scientific_name` and `yield_information` retain the first non-null value encountered. Source provenance is tracked by accumulating all contributing `_source` references on the merged record as a `_sources` list, allowing any synthesized crop summary to be traced back to every document and chunk that contributed to it.

> **Figure 3.6** — Metadata enrichment and in-memory merge: multiple extraction records for the same crop name collapsing into one deduplicated crop record with an accumulated `_sources` provenance list
> `[INSERT FIGURE: diagram showing multiple MongoDB documents converging into a single in-memory crop record]`

### 3.5.3 Query Preprocessing

When a user submits a question to the chatbot, the query is embedded using the same `gemini-embedding-001` model but with the `RETRIEVAL_QUERY` task type, producing a representation optimized for matching against document embeddings rather than for representing document content.

```python
# chatbot/crop_store.py (excerpt)
def _embed_query(self, query: str) -> Optional[np.ndarray]:
    result = self._genai_client.models.embed_content(
        model="gemini-embedding-001",
        contents=query,
        config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY")
    )
    return np.array(result.embeddings[0].values, dtype=np.float32)
```

The search pipeline follows a vector-first, keyword-fallback strategy. If Gemini embeddings are available and the query embedding is successfully generated, cosine similarity is computed against all in-memory crop embeddings and the top-K results by score are returned. The cosine similarity between query vector $\vec{q}$ and crop vector $\vec{c}$ is computed as:

$$\text{similarity}(\vec{q}, \vec{c}) = \frac{\vec{q} \cdot \vec{c}}{\|\vec{q}\| \|\vec{c}\|}$$

If embedding-based retrieval is unavailable — due to a missing API key or a failed embedding call — the system falls back to keyword scoring, where each query term is matched against the crop's pre-built searchable text string and crops are ranked by term overlap count. This fallback ensures the chatbot remains operational in environments without API access, at the cost of retrieval precision.

```python
# chatbot/crop_store.py (excerpt)
def search(self, query: str, top_k: int = 3) -> List[Dict]:
    if self.embedding_search_available:
        query_embedding = self._embed_query(query)
        if query_embedding is not None:
            results = self._vector_search(query_embedding, top_k)
            if results:
                return results
    return self._keyword_search(query, top_k)
```

> **Figure 3.7** — Query retrieval flow: user query → `RETRIEVAL_QUERY` embedding → cosine similarity ranking → top-K crop records; fallback branch to term-overlap keyword scoring when embeddings are unavailable
> `[INSERT FIGURE: flowchart showing the vector search path and keyword fallback branch with decision node]`

---

## 3.6 System Development

### 3.6.1 Prompt Engineering and Optimization

The extraction prompt was engineered iteratively to elicit consistent, schema-compliant JSON output from the LLM without requiring post-processing corrections. The final prompt is delivered to the model as a single user-turn message structured in four components.

The first component is a role definition that positions the model as a structured agricultural data extraction expert, establishing task context before any schema or data is presented. The second component is the target text chunk, inserted verbatim so the model has full access to the source passage. The third component is the extraction schema — a fully annotated JSON template listing all expected field names, their data types, and enumerated category values where applicable. The fourth component is a set of negative instructions that explicitly prohibit the model from inferring, assuming, or generating values not present in the source text; absent fields must be returned as `null` and empty list fields as `[]`.

```python
# finder_system/llm_extractor/llm_extractor.py (excerpt)
prompt = f"""You are an agricultural information extraction expert.
Analyze the following text and extract structured agricultural information.

Text to analyze:
{text}

Extract and return a JSON object with the following structure:
{structure}

Important:
- Only include information explicitly mentioned in the text
- Use null for fields where information is not available
- Use empty arrays [] for list fields with no data
- Be accurate and do not hallucinate information

Return ONLY the JSON object, no additional text."""
```

The schema passed as `structure` specifies top-level fields for crops (name, scientific name, category), soil types, climate conditions (temperature range, rainfall, sunlight), growing conditions (pH, planting season, duration), pests and diseases (name, type, affected crops), farming practices, fertilizers, yield information, regional data, and a free-text summary. Enumerated values are specified inline — for example, crop category is constrained to `cereal|vegetable|fruit|legume|other` — to prevent uncontrolled variation in categorical fields that would impede downstream deduplication and filtering.

Prompt refinement proceeded over [N] rounds using a held-out validation set of [N] annotated chunks. Each round measured field extraction recall and format compliance rate; changes were accepted only when they improved at least one metric without degrading the other. The final prompt converged after adjustments to field description phrasing and the addition of explicit handling instructions for multi-crop chunks.

> **Figure 3.8** — Prompt structure: role definition → source text → JSON schema → negative instructions → raw JSON output
> `[INSERT FIGURE: annotated layout of the four prompt components with a sample LLM JSON response on the right]`

### 3.6.2 RAG Pipeline Configuration

The RAG pipeline follows the standard retrieve-then-generate pattern (Lewis et al., 2020) extended with conversational memory. Per-session turn histories are maintained server-side, and on each follow-up turn the user's query is first rewritten into a standalone search query before retrieval — a technique shown to improve conversational retrieval accuracy (Vakulenko et al., 2021). The full turn history is then replayed alongside the freshly retrieved context as a structured multi-turn prompt for generation.

**Retrieval and Context Assembly.** The top-K (default 3) most relevant crop records are retrieved via vector similarity or keyword fallback. Each result is serialised into a structured text block and concatenated as grounded context. If no records are found, a fixed not-found response is returned without invoking the LLM.

> **Figure 3.9** — Conversational RAG pipeline: user query + `session_id` → query reformulation → `CropStore.search()` → context assembly → multi-turn Gemini generation → `ChatResponse`
> `[INSERT FIGURE: five-phase conversational RAG flow diagram]`

### 3.6.3 API Token Pool Management

The web panel's token rotation service manages a pool of LLM API keys with per-key quota tracking, cooldown scheduling, and automatic failover. Each key is assigned an active, cooling, or exhausted status that is updated in real time based on API response codes returned during extraction. When a rate-limit or quota-exceeded response is encountered, the offending key is placed into a cooldown period and the `LLMOrchestrator` automatically promotes the next available key according to the configured provider strategy. This mechanism sustains pipeline throughput during large-scale batch extraction without manual key rotation, and is administered through the web panel's `/settings` page where keys can be added, removed, and individually tested before deployment.

> **Figure 3.10** — Token pool management: active key → quota-exceeded response → cooldown status → orchestrator promotes next key; `/settings` page key management interface
> `[INSERT SCREENSHOT: web panel /settings page showing API token pool with per-key status indicators]`

---

## 3.7 System Evaluation

### 3.7.1 Extraction Evaluation

Since all source documents are official Philippine government publications, their content is treated as the authoritative reference. Extraction quality is evaluated as **source fidelity** — the degree to which the system accurately captures information as stated in the source text — rather than real-world factual correctness. A verification set was constructed by randomly sampling [N] chunks and manually inspecting the raw text alongside the structured extraction output at the field level.

**Metrics and Formulas**

| Metric | Formula |
|---|---|
| Precision | TP / (TP + FP) |
| Recall | TP / (TP + FN) |
| F1-Score | 2 × (Precision × Recall) / (Precision + Recall) |
| Field Coverage Rate | (Fields Populated / Total Expected Fields) × 100% |
| Hallucination Rate | (Hallucinated Values / Total Extracted Values) × 100% |

**Tools:** Manual annotation by reviewers; metric computation via custom Python scripts.

### 3.7.2 User Evaluation — App Usability and Impact

A structured usability questionnaire was administered to [N] respondents after each participant completed a hands-on testing session with the chatbot. Each respondent was given direct access to the chatbot interface and asked to submit predefined crop-related questions, engage in follow-up queries, and review the chatbot's responses. Ratings were recorded only after the session concluded to ensure all responses reflect actual interaction with the chatbot rather than hypothetical assessment.

The instrument used a 5-point Likert scale (1 = Strongly Disagree, 5 = Strongly Agree) covering four dimensions: Usability, which covers ease of interaction and clarity of the chatbot interface; Response Comprehensibility, which covers how clearly and understandably the chatbot communicates its answers; System Reliability, which covers the chatbot's consistency and responsiveness across queries; and Perceived Impact, which covers the chatbot's potential to improve access to agricultural knowledge. The instrument was structured around conversational agent usability heuristics adapted for the agricultural domain.

**Metrics and Formulas**

| Metric | Applied To | Formula |
|---|---|---|
| Weighted Mean | All dimensions | Σ(f × x) / n |
| Cronbach's Alpha | Overall instrument | (k / (k − 1)) × (1 − Σσ²ᵢ / σ²total) |

Weighted mean results are interpreted on a five-point scale: 4.50–5.00 = Strongly Agree, 3.50–4.49 = Agree, 2.50–3.49 = Neutral, 1.50–2.49 = Disagree, and 1.00–1.49 = Strongly Disagree. Cronbach's Alpha assesses internal consistency across all scale items to confirm that items within each dimension reliably measure the same underlying construct.

**Tools:** Structured questionnaire (Google Forms); descriptive statistics and reliability analysis via Python (`pandas`, `scipy`, `pingouin`).

### 3.7.3 Response Quality Evaluation

Response quality was assessed using a custom gold-standard evaluation test set prepared by the researchers. The test set consists of [N] question-and-prompt items covering a representative range of agricultural topics present in the corpus — including crop-specific queries on soil requirements, nutrient management, pest and disease control, planting methods, and yield information. Each item in the test set includes the prompt submitted to the chatbot and a researcher-defined expected response that serves as the reference standard.

The chatbot's actual responses to each prompt were collected and presented to a panel of [N] raters — comprising observers, coders, and subject-matter annotators — who independently rated each response on a 1-to-5 ordinal scale, where 1 indicates the response is entirely inaccurate or irrelevant relative to the expected answer and 5 indicates a fully accurate, complete, and relevant response. Raters assessed responses without knowledge of one another's scores to preserve independence.

**Metrics and Formulas**

| Metric | Applied To | Formula |
|---|---|---|
| Mean Rating Score | Per item and overall | Σ ratings / (raters × items) |
| Krippendorff's Alpha | Inter-rater agreement | α = 1 − (D_o / D_e) |

Krippendorff's Alpha is computed using an ordinal difference function appropriate for the 1–5 rating scale, where D_o is the observed disagreement across all rater pairs and D_e is the expected disagreement by chance. Values above 0.80 indicate strong inter-rater agreement; 0.67–0.80 indicate tentative but acceptable agreement. Mean rating scores are interpreted against the same five-point scale used in the usability evaluation.

**Tools:** Custom evaluation rubric and scoring sheet; inter-rater reliability computed via Python (`krippendorff`).

### 3.7.4 System Performance Evaluation

Operational performance was measured under representative load conditions across three indicators: average extraction time per chunk (seconds), end-to-end chatbot response latency (milliseconds) decomposed into embedding, retrieval, and generation time, and system error rate across a full extraction run.

**Tools:** Python `time` module for extraction timing; FastAPI middleware for request-level latency logging.

---

## 3.8 Ethical Considerations

### 3.8.1 Informed Consent

All survey respondents were provided an informed consent form explaining the study's purpose, voluntary participation, anonymity of responses, and the right to withdraw without consequence. Data collection proceeded only upon signed consent.

### 3.8.2 Data Privacy

No personally identifiable information was collected beyond basic demographic categories (role, institution type, years of experience). Survey data is stored in aggregated form and reported only at the group level.

### 3.8.3 Source Authority, Attribution, and Copyright

All PDF documents processed were sourced from publicly available Philippine government repositories and are classified as official public information. Government-issued agricultural publications are considered part of the public domain under Philippine law and do not require additional licensing for academic use.

The use of government documents confers a dual ethical benefit: the information extracted carries institutional authority and accountability, reducing the risk of propagating unverified agricultural guidance; and the system effectively democratizes access to knowledge that is already public but practically inaccessible in its original unstructured PDF format. The system preserves full source provenance by attributing every extracted record and every chatbot response to its originating document, allowing users to trace any piece of information back to its official government source.

### 3.8.4 AI-Generated Content and Hallucination Risk

The study acknowledges that LLM-based extraction and generation carry an inherent risk of hallucination or factual error. Mitigation strategies applied in this system include ground truth validation of extraction outputs against source text, RAG-grounded generation that anchors responses to retrieved document context rather than model parametric memory, and user-facing source citation in chatbot responses so that any claim can be independently verified against the originating government document.

### 3.8.5 Bias and Fairness

The agricultural corpus was reviewed for geographic and crop-type coverage balance to prevent the system from producing high-quality responses only for majority crops while underserving minority or regional varieties. Coverage gaps identified during evaluation are disclosed in the results and discussed in terms of their implications for equitable system utility across different agricultural contexts.

---

---

# Chapter 4: Results and Discussion

## 4.1 Application Testing and Usability Survey Results

All survey results presented in this section are based on respondents' direct, hands-on experience with the deployed system. Each participant completed a structured testing session before completing the survey, ensuring that all ratings reflect actual observed system behavior rather than abstract or hypothetical assessments.

### 4.1.1 Respondent Profile

**Table 4.1. Demographic Profile of Respondents (n = [N])**

| Category | Frequency | Percentage (%) |
|---|---|---|
| Agriculture Students | | |
| Extension Workers | | |
| Faculty / Researchers | | |
| Other | | |
| **Total** | **[N]** | **100%** |

*Discussion:* Describe the composition of respondents and how it reflects the target user population. Note any relevant prior experience with agricultural information systems or chatbot tools that may have influenced ratings.

### 4.1.2 Usability

**Table 4.2. Usability — Survey Results**

| Item | Mean | SD | Interpretation |
|---|---|---|---|
| The interface was easy to navigate during testing. | | | |
| I was able to complete the assigned tasks without assistance. | | | |
| The chatbot responses were easy to read and understand. | | | |
| I did not need additional instructions to use the system. | | | |
| The layout of the application is clear and well-organized. | | | |
| **Overall Weighted Mean** | | | |

*Discussion:* Interpret usability scores in the context of the testing tasks performed. Identify items with the lowest scores and relate them to specific interface elements or interaction flows observed during the testing session. Discuss whether any task generated noticeably more difficulty than others.

### 4.1.3 Response Quality

**Table 4.3. Response Quality — Survey Results**

| Item | Mean | SD | Interpretation |
|---|---|---|---|
| The chatbot provided answers that matched my query. | | | |
| The information in the responses was accurate and reliable. | | | |
| The responses were complete and did not leave out important details. | | | |
| I could verify the chatbot's answer against the referenced document. | | | |
| **Overall Weighted Mean** | | | |

*Discussion:* Discuss how user-perceived response quality aligns with the objective extraction and retrieval metrics reported in Sections 4.3 and 4.4. Since source documents are official government publications, respondents who cross-referenced answers against the source are particularly informative — note any patterns in verification behavior. Discuss implications for user trust in the system's outputs.

### 4.1.4 System Reliability

**Table 4.4. System Reliability — Survey Results**

| Item | Mean | SD | Interpretation |
|---|---|---|---|
| The system responded consistently throughout the testing session. | | | |
| I did not encounter errors or unexpected behavior during testing. | | | |
| The system responded within an acceptable amount of time. | | | |
| **Overall Weighted Mean** | | | |

*Discussion:* Relate perceived reliability to the objective system performance metrics in Section 4.5 (error rate, latency). If user-perceived reliability diverges from measured metrics, analyze possible causes (e.g., latency perception, error visibility, recovery behavior).

### 4.1.5 Overall Satisfaction

**Table 4.5. Overall Satisfaction — Survey Results**

| Item | Mean | SD | Interpretation |
|---|---|---|---|
| Overall, I am satisfied with the system's performance. | | | |
| I would recommend this system for agricultural information lookup. | | | |
| This system would be useful in real agricultural practice or study. | | | |
| **Overall Weighted Mean** | | | |

*Discussion:* Discuss overall satisfaction as an integrative measure across all tested dimensions. Compare against individual dimension means to identify whether satisfaction tracks most closely with usability or response quality.

### 4.1.6 Summary of Survey Results

**Table 4.6. Summary of All Survey Dimensions**

| Dimension | Overall Weighted Mean | SD | Interpretation |
|---|---|---|---|
| Usability | | | |
| Response Quality | | | |
| System Reliability | | | |
| Overall Satisfaction | | | |
| **Grand Mean** | | | |

*Scale: 4.50–5.00 = Strongly Agree / Excellent; 3.50–4.49 = Agree / Good; 2.50–3.49 = Neutral / Fair; 1.50–2.49 = Disagree / Poor; 1.00–1.49 = Strongly Disagree / Very Poor*

*Discussion:* Provide a holistic interpretation of the post-testing survey results. Identify which dimension scored highest and lowest and connect findings to observed system behaviors. Discuss the Cronbach's Alpha reliability coefficient to establish internal consistency of the survey instrument. Conclude with a statement on the system's overall acceptance based on user testing outcomes.

---

## 4.2 Data Processing and Extraction Validation

All source documents are official government agricultural publications. Validation in this section measures **extraction fidelity** — whether the system accurately and completely captures content as it appears in the source text. The factual correctness of the underlying government content is not re-evaluated.

### 4.2.1 Corpus Statistics

**Table 4.7. PDF Corpus Summary**

| Metric | Value |
|---|---|
| Total Government Documents Processed | |
| Issuing Agencies Represented | |
| Total Pages | |
| Total Chunks Generated | |
| Average Chunk Length (tokens) | |
| Total Extraction Records Produced | |
| Records Passing Schema Validation | |
| Schema Validation Pass Rate (%) | |

*Discussion:* Comment on chunking behavior — whether the sliding window strategy produced coherent chunks or fragmented key information across chunk boundaries. Note any document types (scanned PDFs, complex tables, multi-column layouts) that degraded text extraction quality and describe how these were handled.

### 4.2.2 Extraction Field Coverage

**Table 4.8. Extraction Field Coverage Rate**

| Field | Expected Occurrences | Extracted | Coverage Rate (%) |
|---|---|---|---|
| Crop Name | | | |
| Variety | | | |
| Growth Duration | | | |
| Soil Requirements | | | |
| Climate Requirements | | | |
| Fertilizer Recommendations | | | |
| Pest/Disease Management | | | |
| Yield Data | | | |
| Harvest Indicators | | | |
| **Average Coverage** | | | **[N]%** |

*Discussion:* Distinguish between two causes of low coverage: (1) the field is genuinely absent from the source document (a corpus characteristic, not an extraction failure), and (2) the field is present in the source but the LLM failed to extract it (a true extraction miss). Government documents vary in scope — a pest management bulletin will naturally have no yield data. Disaggregating these causes is essential for accurately interpreting coverage rates.

---

## 4.3 Extraction Accuracy

Extraction accuracy is evaluated as fidelity to the official government source documents. A sampled verification set of [N] chunks was reviewed to confirm whether extracted field values are correctly derived from the source text, partially captured, or hallucinated (no basis in the source chunk).

### 4.3.1 Overall Extraction Performance

**Table 4.9. Overall LLM Extraction Performance (All Fields, All Providers)**

| Metric | Score |
|---|---|
| Precision | |
| Recall | |
| F1-Score | |
| Exact Match (EM) | |
| Hallucination Rate | |

*Discussion:* Interpret overall extraction fidelity. Discuss the precision-recall tradeoff — whether the system tends toward over-extraction (high recall, lower precision, higher hallucination risk) or conservative extraction (high precision, lower recall, higher miss rate). Given that all source content is authoritative government text, a low hallucination rate is a critical correctness indicator.

### 4.3.2 Per-Field Extraction Performance

**Table 4.10. Precision, Recall, F1-Score, and Hallucination Rate per Extracted Field**

| Field | Precision | Recall | F1-Score | EM | Hallucination Rate |
|---|---|---|---|---|---|
| Crop Name | | | | | |
| Variety | | | | | |
| Growth Duration | | | | | |
| Soil Requirements | | | | | |
| Climate Requirements | | | | | |
| Fertilizer Recommendations | | | | | |
| Pest/Disease Management | | | | | |
| Yield Data | | | | | |
| Harvest Indicators | | | | | |
| **Macro Average** | | | | | |
| **Weighted Average** | | | | | |

*Discussion:* Analyze which fields are extracted most and least reliably. Distinguish between extraction misses (field present in source but not extracted) and hallucinations (value extracted but absent from source). Numeric and discrete fields (e.g., growth duration, yield data) are expected to produce higher hallucination risk due to unit variation and inferential filling. Narrative fields (e.g., pest management recommendations) may exhibit lower precision but higher recall due to paraphrasing.

### 4.3.3 Provider Comparison

**Table 4.10. Extraction Performance by LLM Provider**

| Provider | Precision | Recall | F1-Score | Avg. Latency (s) | Cost (per 1K chunks) |
|---|---|---|---|---|---|
| Claude ([model]) | | | | | |
| Gemini ([model]) | | | | | |
| Ollama ([model]) | | | | | |

*Discussion:* Compare providers on quality-cost-latency tradeoffs. Discuss whether the failover strategy successfully maintained pipeline throughput during provider quota events. Provide a recommendation for optimal provider selection based on results.

---

## 4.4 RAG Chatbot Performance

### 4.4.1 Retrieval Performance

**Table 4.11. Retrieval Evaluation on Benchmark Query Set (n = [N] queries)**

| Metric | Score |
|---|---|
| Hit Rate @ 1 | |
| Hit Rate @ 3 | |
| Hit Rate @ 5 | |
| Mean Reciprocal Rank (MRR) | |
| nDCG @ 5 | |

*Discussion:* Discuss retrieval quality and how Top-K selection affected the accuracy-context-length tradeoff. Note any query types (e.g., multi-crop comparisons, regional queries) that consistently failed retrieval and analyze root causes.

### 4.4.2 End-to-End Response Quality

**Table 4.12. Chatbot Response Quality Metrics**

| Metric | Score |
|---|---|
| ROUGE-L | |
| BERTScore (F1) | |
| Faithfulness Score | |
| Answer Relevance Score | |

*Discussion:* Discuss the relationship between retrieval quality and response quality. Provide qualitative examples: a best-case response demonstrating grounded, accurate output, and a failure case (hallucination or incomplete answer) with attribution of cause. Discuss mitigation strategies applied.

### 4.4.3 System Latency

**Table 4.13. System Latency Profile**

| Operation | Mean (ms) | Median (ms) | P95 (ms) |
|---|---|---|---|
| Query Embedding | | | |
| Vector Retrieval | | | |
| LLM Generation | | | |
| End-to-End Response | | | |

*Discussion:* Evaluate latency against acceptable response time thresholds for interactive use (typically < 3s for perceived responsiveness). Identify the dominant latency contributor and propose optimization strategies (caching, streaming generation).

---

## 4.5 System Performance Under Load

**Table 4.14. Extraction Pipeline Throughput**

| Metric | Value |
|---|---|
| Average Extraction Time per Chunk (s) | |
| Chunks Processed per Hour | |
| Error Rate (%) | |
| Provider Failover Events | |

*Discussion:* Discuss pipeline stability, error recovery behavior, and the effectiveness of the token rotation mechanism in sustaining throughput across large batches.

---

## 4.6 Summary of Results

**Table 4.16. Consolidated Evaluation Summary**

| Evaluation Dimension | Key Metric | Result | Rating |
|---|---|---|---|
| User Testing — Usability | Weighted Mean | | |
| User Testing — Response Quality | Weighted Mean | | |
| User Testing — System Reliability | Weighted Mean | | |
| User Testing — Overall Satisfaction | Weighted Mean | | |
| Extraction Fidelity | Macro F1-Score | | |
| Extraction Fidelity | Hallucination Rate | | |
| Retrieval Quality | MRR | | |
| Chatbot Response Quality | BERTScore F1 | | |
| Response Faithfulness | Faithfulness Score | | |
| System Latency | Mean E2E (ms) | | |

*Discussion:* Provide a holistic synthesis of all evaluation dimensions. Address the three research questions from Section 3.2.1 directly: (1) extraction fidelity to government source documents, (2) chatbot effectiveness for agricultural queries, and (3) user-observed usability and satisfaction from hands-on testing. Discuss the degree to which the system meets its design goals, limitations encountered, and how findings compare to related work in agricultural knowledge systems and LLM-based information extraction.
