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

This study employs a three-layer evaluation framework: extraction accuracy (Section 3.7.1), user-perceived usability and impact (Section 3.7.2), and response quality (Section 3.7.3). This structure follows Design Science Research practice, which requires that a constructed artifact be rigorously evaluated against both technical correctness criteria and stakeholder-oriented criteria (Hevner et al., 2004). Each layer directly addresses one or more of the study's research questions: extraction fidelity measures how accurately the knowledge base was built from official documents (RQ2) and how effectively hallucinations are mitigated (RQ3); user evaluation measures how well the conversational interface improves information accessibility for students, novice farmers, and the general public (RQ4); and response quality evaluation measures how faithfully and accurately the RAG pipeline produces grounded responses from those documents (RQ1, RQ3).

### 3.7.1 Extraction Evaluation

Since all source documents are official Philippine government publications, their content is treated as the authoritative reference. Extraction quality is evaluated as **source fidelity** — the degree to which the system accurately captures information as stated in the source text — rather than real-world factual correctness. A verification set was constructed by randomly sampling [N] chunks and manually inspecting the raw text alongside the structured extraction output at the field level.

Evaluation is conducted at the **field level**: for each expected field in each sampled chunk (e.g., crop name, planting method, fertilizer requirement), a reviewer determines whether the system's extracted value is correct, absent, or fabricated relative to what the source text contains. Each field instance is assigned to one of four categories, following the standard binary classification framework used in information extraction evaluation (Manning et al., 2008; Tjong Kim Sang & De Meulder, 2003):

- **True Positive (TP)** — The field value was present in the source chunk *and* the system correctly extracted it. This represents a successful, accurate extraction.
- **False Positive (FP)** — The system produced a value for the field, but no corresponding information exists in the source chunk. This constitutes a hallucinated or fabricated extraction. A high FP count inflates the apparent coverage of the system while reducing trustworthiness.
- **True Negative (TN)** — The field was absent from the source chunk *and* the system correctly left it empty (null/not extracted). This represents correct recognition of missing information. TN is tracked but not used in Precision or Recall calculations, as it is not informative for imbalanced fields.
- **False Negative (FN)** — The field value was present in the source chunk but the system failed to extract it. This represents a missed extraction. A high FN count indicates the system is under-extracting and leaving relevant data uncaptured.

These four categories define the confusion matrix from which extraction metrics are derived. The choice of Precision, Recall, and F1-Score as primary metrics follows established practice in Named Entity Recognition (NER) and Information Extraction (IE) shared tasks, where the same framework has been applied to evaluate structured extraction from unstructured text (Sang & De Meulder, 2003; Chinchor, 1992). Precision penalizes hallucination; Recall penalizes missed extractions; the F1-Score provides a balanced single-number summary that is sensitive to both failure modes equally, making it suitable as the primary performance indicator when neither hallucination nor omission is categorically more harmful.

Field Coverage Rate and Hallucination Rate are reported as supplementary operational indicators. Field Coverage Rate measures the completeness of the extraction schema — how many of the expected fields are populated — regardless of whether each value is correct. Hallucination Rate directly quantifies fabrication as a proportion of all extracted output, providing a standalone trustworthiness signal aligned with concerns about LLM reliability in structured extraction tasks (Bang et al., 2023).

**Metrics and Formulas**

| Metric | Formula | Interpretation |
|---|---|---|
| Precision | TP / (TP + FP) | Proportion of extracted values that are correct; penalizes hallucination |
| Recall | TP / (TP + FN) | Proportion of present values that were captured; penalizes missed extractions |
| F1-Score | 2 × (Precision × Recall) / (Precision + Recall) | Harmonic mean balancing Precision and Recall |
| Field Coverage Rate | (Fields Populated / Total Expected Fields) × 100% | Schema completeness regardless of correctness |
| Hallucination Rate | (Hallucinated Values / Total Extracted Values) × 100% | Proportion of extracted values with no source basis (FP rate) |

**Tools:** Manual annotation by reviewers; metric computation via custom Python scripts.

### 3.7.2 User Evaluation — App Usability and Impact

A structured usability questionnaire was administered to [N] respondents after each participant completed a hands-on testing session with the chatbot. Each respondent was given direct access to the chatbot interface and asked to submit predefined crop-related questions, engage in follow-up queries, and review the chatbot's responses. Ratings were recorded only after the session concluded to ensure all responses reflect actual interaction with the chatbot rather than hypothetical assessment.

Respondents were drawn from the target user population of the system: agriculture students, novice farmers, extension workers, and faculty or researchers with agricultural backgrounds. The inclusion of actual farmers as respondents is deliberate — RQ4 specifically asks whether the system improves accessibility of agronomic information for farmers and the general public, and a usability evaluation that excludes this group would fail to answer that question. Farmer respondents were recruited through [describe recruitment channel, e.g., local agricultural office, farming cooperative, etc.].

The instrument used a 5-point Likert scale (1 = Strongly Disagree, 5 = Strongly Agree) covering four dimensions: Usability, which covers ease of interaction and clarity of the chatbot interface; Response Comprehensibility, which covers how clearly and understandably the chatbot communicates its answers; System Reliability, which covers the chatbot's consistency and responsiveness across queries; and Perceived Impact, which covers the chatbot's potential to improve access to agricultural knowledge compared to traditional document-based retrieval. The instrument was structured around conversational agent usability heuristics adapted for the agricultural domain (Quesenbery, 2003; Radziwill & Benton, 2017).

The Perceived Impact dimension specifically includes an item asking respondents to compare their experience with the system against searching through documents manually — *"This system made it easier to find agricultural information than searching through documents manually."* This item operationalizes the comparative element of RQ4 without requiring a controlled experiment, instead capturing user-perceived relative advantage as a self-reported measure, which is an accepted approach for comparative accessibility evaluation in technology adoption research (Davis, 1989).

The Weighted Mean is the primary descriptive statistic applied per item and per dimension. It is preferred over a simple arithmetic mean in Likert-scale analysis because it accounts for the full frequency distribution of responses rather than treating each response as equally weighted (Jamieson, 2004). Cronbach's Alpha is reported as the reliability coefficient for the overall instrument to confirm that items within each dimension cohesively measure the same latent construct rather than capturing unrelated perceptions (Cronbach, 1951; Taber, 2018).

**Metrics and Formulas — Variable Definitions**

**Weighted Mean** = Σ(f × x) / n

| Variable | Meaning |
|---|---|
| f | Frequency of respondents who selected a particular rating value x (e.g., how many respondents chose "4") |
| x | The numeric rating value on the Likert scale (1, 2, 3, 4, or 5) |
| n | Total number of respondents who answered the item |
| Σ(f × x) | Sum of each rating value multiplied by its frequency, across all five scale points |

**Cronbach's Alpha (α)** = (k / (k − 1)) × (1 − Σσ²ᵢ / σ²total)

| Variable | Meaning |
|---|---|
| k | Number of items (questions) in the instrument or dimension being assessed |
| σ²ᵢ | Variance of individual respondent scores on item i — how much responses to that single question vary across all respondents |
| σ²total | Variance of each respondent's total composite score (sum of all item ratings) — how much total scores vary across all respondents |
| Σσ²ᵢ | Sum of per-item variances across all k items |
| 1 − Σσ²ᵢ / σ²total | The proportion of total score variance attributable to shared construct variance rather than item-specific noise; higher values indicate stronger internal consistency |

**Interpretation Scales**

| Weighted Mean Range | Verbal Interpretation |
|---|---|
| 4.50 – 5.00 | Strongly Agree |
| 3.50 – 4.49 | Agree |
| 2.50 – 3.49 | Neutral |
| 1.50 – 2.49 | Disagree |
| 1.00 – 1.49 | Strongly Disagree |

| Cronbach's Alpha | Internal Consistency |
|---|---|
| ≥ 0.90 | Excellent |
| 0.80 – 0.89 | Good |
| 0.70 – 0.79 | Acceptable |
| 0.60 – 0.69 | Questionable |
| < 0.60 | Unacceptable |

**Tools:** Structured questionnaire (Google Forms); descriptive statistics and reliability analysis via Python (`pandas`, `scipy`, `pingouin`).

### 3.7.3 Response Quality Evaluation

Response quality was assessed using a custom gold-standard evaluation test set prepared by the researchers. The test set consists of [N] question-and-prompt items covering a representative range of agricultural topics present in the corpus — including crop-specific queries on soil requirements, nutrient management, pest and disease control, planting methods, and yield information. Each item in the test set includes the prompt submitted to the chatbot and a researcher-defined expected response that serves as the reference standard.

The chatbot's actual responses to each prompt were collected and presented to a panel of [N] raters — comprising observers, coders, and subject-matter annotators — who independently rated each response on a 1-to-5 ordinal scale, where 1 indicates the response is entirely inaccurate or irrelevant relative to the expected answer and 5 indicates a fully accurate, complete, and relevant response. Raters assessed responses without knowledge of one another's scores to preserve independence.

Human evaluation by a multi-rater panel is preferred over automated metrics for response quality in this study because the evaluation task requires contextual judgment — whether a response is agriculturally appropriate, faithful to government source content, and responsive to the specific query intent — qualities that automated string-similarity metrics (e.g., ROUGE, BLEU) are insufficient to capture for long-form, knowledge-grounded responses (Gatt & Krahmer, 2018; Liu et al., 2023). Krippendorff's Alpha is selected as the inter-rater reliability measure because it supports ordinal data, accommodates any number of raters, and handles missing ratings, making it more appropriate for small annotation panels than Cohen's Kappa or Fleiss' Kappa (Krippendorff, 2011).

**Metrics and Formulas — Variable Definitions**

**Mean Rating Score** = Σ ratings / (raters × items)

| Variable | Meaning |
|---|---|
| Σ ratings | The total sum of all scores given by all raters across all evaluation items (e.g., if 3 raters each scored 20 items, this is the sum of 60 individual scores) |
| raters | The number of independent raters in the evaluation panel |
| items | The number of chatbot response items in the test set |
| raters × items | The total number of individual rating observations; the denominator normalizes the sum to produce an average score per response |

**Krippendorff's Alpha (α)** = 1 − (D_o / D_e)

| Variable | Meaning |
|---|---|
| D_o | Observed disagreement — the average squared difference between all pairs of ratings assigned to the same response item, summed across all items; measures how much raters actually disagreed |
| D_e | Expected disagreement — the disagreement that would be expected if all raters assigned ratings randomly based on the observed marginal distribution of all scores; serves as the chance-agreement baseline |
| D_o / D_e | The ratio of actual disagreement to chance-level disagreement; values less than 1.0 mean raters agreed better than chance |
| 1 − (D_o / D_e) | Converts the disagreement ratio into a reliability coefficient: 1.0 = perfect agreement, 0.0 = chance-level agreement, negative values = worse than chance |

An **ordinal difference function** is applied in computing D_o and D_e, meaning disagreement is weighted by the distance between ratings on the 1–5 scale (e.g., a disagreement of 4 vs. 5 is penalized less than a disagreement of 1 vs. 5). This is appropriate when the scale categories are ordered and the distances between them carry meaning.

**Interpretation Scales**

| Mean Rating Score | Verbal Interpretation |
|---|---|
| 4.50 – 5.00 | Excellent / Fully Accurate |
| 3.50 – 4.49 | Good / Mostly Accurate |
| 2.50 – 3.49 | Fair / Partially Accurate |
| 1.50 – 2.49 | Poor / Mostly Inaccurate |
| 1.00 – 1.49 | Very Poor / Entirely Inaccurate |

| Krippendorff's Alpha | Inter-Rater Agreement |
|---|---|
| > 0.80 | Strong agreement |
| 0.67 – 0.80 | Tentative, acceptable agreement |
| < 0.67 | Insufficient agreement for reliable conclusions |

**Tools:** Custom evaluation rubric and scoring sheet; inter-rater reliability computed via Python (`krippendorff`).

**Bias Prevention Measures**

Several potential sources of bias were identified in the rater panel design and addressed through the following controls:

| Bias Type | Control Applied |
|---|---|
| **Rater independence bias** | Raters scored all items independently and were not permitted to discuss scores with other panel members until after all ratings were submitted. No rater had access to another's scores during the evaluation period. |
| **Response source blinding** | All chatbot responses presented to raters were stripped of any identifying information about the LLM provider or system configuration that generated them. Raters evaluated the content of each response only, preventing unconscious scoring bias toward or against a particular model. |
| **Anchor drift** | Prior to scoring, all raters were provided with two calibration examples — one clearly poor response (expected score 1–2) and one clearly excellent response (expected score 4–5) with written justification for each anchor score. This aligned raters' interpretation of the scale before the formal evaluation began. |
| **Order and sequence bias** | The order in which responses were presented was randomized independently for each rater to prevent anchoring effects from earlier items influencing scores on later items. |
| **Confirmation bias** | Raters were not briefed on the system's development goals, the identity of the researchers, or the expected outcome of the evaluation. Instructions described only the scoring task and rubric. |

**Acknowledged Limitation — Researcher-Defined Expected Responses**

The expected responses used as the reference standard for each test item were authored by the researchers who designed and built the system. This introduces a potential source of confirmation bias: expected responses may have been framed in ways that inadvertently favor the system's output style, inflating rater scores. This limitation is partially mitigated by the use of Krippendorff's Alpha as an inter-rater reliability check — if rater agreement is strong (α > 0.67), it suggests that scoring was driven by clear response quality signals rather than subjective interpretation of an ambiguous standard. However, independent expert validation of the expected responses by a subject-matter specialist (e.g., an agricultural extension officer) was not conducted in this study and is recommended for future work.

---

## 3.8 Ethical Considerations

### 3.8.1 Informed Consent

All survey respondents were provided an informed consent form explaining the study's purpose, voluntary participation, anonymity of responses, and the right to withdraw without consequence. Data collection proceeded only upon signed consent.

### 3.8.2 Data Privacy

No personally identifiable information was collected beyond basic demographic categories (role, institution type, years of experience). Survey data is stored in aggregated form and reported only at the group level.

### 3.8.3 Source Authority, Attribution, and Copyright

All PDF documents processed were sourced from publicly available Philippine government repositories and are classified as official public information. Government-issued agricultural publications are considered part of the public domain under Philippine law and do not require additional licensing for academic use.

The use of government documents confers a dual ethical benefit: the information extracted carries institutional authority and accountability, reducing the risk of propagating unverified agricultural guidance; and the system effectively democratizes access to knowledge that is already public but practically inaccessible in its original unstructured PDF format. This democratization rationale is consistent with the motivation articulated in comparable agricultural AI systems — Singh et al. (2024) similarly ground the ethical justification for Farmer.Chat in expanding smallholder farmers' access to expert-level agricultural guidance that would otherwise require in-person extension services. The system preserves full source provenance by attributing every extracted record and every chatbot response to its originating document, allowing users to trace any piece of information back to its official government source.

### 3.8.4 AI-Generated Content and Hallucination Risk

The study acknowledges that LLM-based extraction and generation carry an inherent risk of hallucination or factual error. Evaluations of LLM systems across reasoning, knowledge, and factual tasks have documented systematic hallucination behavior even in high-capability models (Bang et al., 2023), and this risk is of particular concern in agricultural advisory contexts where incorrect guidance could have direct consequences for crop outcomes and farmer livelihoods. Mitigation strategies applied in this system include ground truth validation of extraction outputs against source text, RAG-grounded generation that anchors responses to retrieved document context rather than model parametric memory — a strategy shown to substantially reduce hallucination compared to closed-book LLM generation (Lewis et al., 2020) — and user-facing source citation in chatbot responses so that any claim can be independently verified against the originating government document. In agricultural RAG systems specifically, AgriRegion (Fanuel et al., 2024) reports hallucination reductions of 10–20% over baseline LLMs through retrieval grounding, further supporting RAG as an appropriate hallucination mitigation strategy for this domain.

### 3.8.5 Bias and Fairness

The agricultural corpus was reviewed for geographic and crop-type coverage balance to prevent the system from producing high-quality responses only for majority crops while underserving minority or regional varieties. This is a recognized concern in domain-specific AI systems — the CROP benchmark (NeurIPS, 2024), which covers 5,045 questions across crop science subfields, notes that uneven coverage across crop categories in training and evaluation data leads to measurable performance disparities between well-represented and underrepresented crops. Similarly, Samuel et al. (2025) identify corpus coverage imbalance as a primary limitation of RAG-based agricultural systems, as retrieval quality degrades for crop types or regions not well represented in the knowledge base. Coverage gaps identified during evaluation in this study are disclosed in the results and discussed in terms of their implications for equitable system utility across different agricultural contexts.

---

---

# Chapter 4: Results and Discussion

This chapter presents the evaluation findings in two parts. Section 4.1 reports all quantitative results across the three evaluation components — extraction accuracy, user-perceived usability and impact, and response quality — in tabular form without interpretation. Section 4.2 provides the full discussion and synthesis of those results, organized by evaluation component and concluding with a direct answer to each of the four research questions.

---

## 4.1 Results

### 4.1.1 Extraction Evaluation

All source documents are official Philippine government agricultural publications. A sampled verification set of [N] chunks was manually reviewed at the field level by [N] annotators to produce the results below.

#### 4.1.1.1 Corpus and Processing Statistics

**Table 4.1. PDF Corpus Summary**

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

#### 4.1.1.2 Extraction Field Coverage

**Table 4.2. Extraction Field Coverage Rate**

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

#### 4.1.1.3 Overall Extraction Performance

**Table 4.3. Overall LLM Extraction Performance (All Fields, All Providers)**

| Metric | Score |
|---|---|
| Precision | |
| Recall | |
| F1-Score | |
| Field Coverage Rate (%) | |
| Hallucination Rate (%) | |

#### 4.1.1.4 Per-Field Extraction Performance

**Table 4.4. Precision, Recall, F1-Score, and Hallucination Rate per Extracted Field**

| Field | TP | FP | FN | Precision | Recall | F1-Score | Hallucination Rate (%) |
|---|---|---|---|---|---|---|---|
| Crop Name | | | | | | | |
| Variety | | | | | | | |
| Growth Duration | | | | | | | |
| Soil Requirements | | | | | | | |
| Climate Requirements | | | | | | | |
| Fertilizer Recommendations | | | | | | | |
| Pest/Disease Management | | | | | | | |
| Yield Data | | | | | | | |
| Harvest Indicators | | | | | | | |
| **Macro Average** | | | | | | | |
| **Weighted Average** | | | | | | | |

#### 4.1.1.5 Provider Comparison

**Table 4.5. Extraction Performance by LLM Provider**

| Provider | Precision | Recall | F1-Score | Hallucination Rate (%) | Avg. Latency (s) |
|---|---|---|---|---|---|
| Claude ([model]) | | | | | |
| Gemini ([model]) | | | | | |
| Ollama ([model]) | | | | | |

---

### 4.1.2 User Evaluation — App Usability and Impact

Results below are based on respondents' direct, hands-on testing of the deployed system. Each participant completed a structured session before completing the questionnaire.

#### 4.1.2.1 Respondent Profile

**Table 4.6. Demographic Profile of Respondents (n = [N])**

| Category | Frequency | Percentage (%) |
|---|---|---|
| Agriculture Students | | |
| Novice Farmers | | |
| Extension Workers | | |
| Faculty / Researchers | | |
| Other | | |
| **Total** | **[N]** | **100%** |

#### 4.1.2.2 Usability

**Table 4.7. Usability — Survey Results**

| Item | Weighted Mean | SD | Interpretation |
|---|---|---|---|
| The interface was easy to navigate during testing. | | | |
| I was able to complete the assigned tasks without assistance. | | | |
| The chatbot responses were easy to read and understand. | | | |
| I did not need additional instructions to use the system. | | | |
| The layout of the application is clear and well-organized. | | | |
| **Overall Weighted Mean** | | | |

#### 4.1.2.3 Response Comprehensibility

**Table 4.8. Response Comprehensibility — Survey Results**

| Item | Weighted Mean | SD | Interpretation |
|---|---|---|---|
| The chatbot provided answers that matched my query. | | | |
| The information in the responses was accurate and reliable. | | | |
| The responses were complete and did not leave out important details. | | | |
| I could verify the chatbot's answer against the referenced document. | | | |
| **Overall Weighted Mean** | | | |

#### 4.1.2.4 System Reliability

**Table 4.9. System Reliability — Survey Results**

| Item | Weighted Mean | SD | Interpretation |
|---|---|---|---|
| The system responded consistently throughout the testing session. | | | |
| I did not encounter errors or unexpected behavior during testing. | | | |
| The system responded within an acceptable amount of time. | | | |
| **Overall Weighted Mean** | | | |

#### 4.1.2.5 Perceived Impact

**Table 4.10. Perceived Impact — Survey Results**

| Item | Weighted Mean | SD | Interpretation |
|---|---|---|---|
| This system improves access to agricultural information. | | | |
| This system made it easier to find agricultural information than searching through documents manually. | | | |
| I would recommend this system for agricultural information lookup. | | | |
| This system would be useful in real agricultural practice or study. | | | |
| **Overall Weighted Mean** | | | |

#### 4.1.2.6 Survey Summary and Internal Consistency

**Table 4.11. Summary of All Survey Dimensions**

| Dimension | Overall Weighted Mean | SD | Interpretation |
|---|---|---|---|
| Usability | | | |
| Response Comprehensibility | | | |
| System Reliability | | | |
| Perceived Impact | | | |
| **Grand Mean** | | | |

*Scale: 4.50–5.00 = Strongly Agree; 3.50–4.49 = Agree; 2.50–3.49 = Neutral; 1.50–2.49 = Disagree; 1.00–1.49 = Strongly Disagree*

**Table 4.12. Instrument Reliability — Cronbach's Alpha**

| Scope | Cronbach's Alpha (α) | Number of Items (k) | Interpretation |
|---|---|---|---|
| Full Instrument | | | |
| Usability Subscale | | | |
| Response Comprehensibility Subscale | | | |
| System Reliability Subscale | | | |
| Perceived Impact Subscale | | | |

---

### 4.1.3 Response Quality Evaluation

Results below are from the researcher-constructed gold-standard test set evaluated by a panel of [N] raters, covering [N] agricultural query prompts.

#### 4.1.3.1 Test Set Overview

**Table 4.13. Test Set Composition**

| Query Category | Number of Items | Proportion (%) |
|---|---|---|
| Soil and Climate Requirements | | |
| Nutrient and Fertilizer Management | | |
| Pest and Disease Control | | |
| Planting Methods and Practices | | |
| Yield and Harvest Information | | |
| **Total** | **[N]** | **100%** |

#### 4.1.3.2 Mean Rating Scores

**Table 4.14. Chatbot Response Quality — Mean Rating Scores by Query Category**

| Query Category | Mean Rating | SD | Interpretation |
|---|---|---|---|
| Soil and Climate Requirements | | | |
| Nutrient and Fertilizer Management | | | |
| Pest and Disease Control | | | |
| Planting Methods and Practices | | | |
| Yield and Harvest Information | | | |
| **Overall Mean** | | | |

*Scale: 4.50–5.00 = Excellent; 3.50–4.49 = Good; 2.50–3.49 = Fair; 1.50–2.49 = Poor; 1.00–1.49 = Very Poor*

#### 4.1.3.3 Inter-Rater Reliability

**Table 4.15. Inter-Rater Agreement — Krippendorff's Alpha**

| Scope | Krippendorff's Alpha (α) | D_o | D_e | Interpretation |
|---|---|---|---|---|
| All Items | | | | |
| Soil and Climate | | | | |
| Nutrient and Fertilizer | | | | |
| Pest and Disease | | | | |
| Planting Methods | | | | |
| Yield and Harvest | | | | |

---

### 4.1.4 Consolidated Results Summary

**Table 4.16. Consolidated Evaluation Summary**

| Evaluation Dimension | Table | Key Metric | Result | Interpretation |
|---|---|---|---|---|
| Extraction — Precision | 4.3 | Precision | | |
| Extraction — Recall | 4.3 | Recall | | |
| Extraction — F1-Score | 4.3 | Macro F1 | | |
| Extraction — Hallucination | 4.3 | Hallucination Rate (%) | | |
| Usability | 4.7 | Weighted Mean | | |
| Response Comprehensibility | 4.8 | Weighted Mean | | |
| System Reliability | 4.9 | Weighted Mean | | |
| Perceived Impact | 4.10 | Weighted Mean | | |
| Survey Instrument Reliability | 4.12 | Cronbach's Alpha | | |
| Response Quality — Mean Score | 4.14 | Overall Mean Rating | | |
| Response Quality — Agreement | 4.15 | Krippendorff's Alpha | | |

---

## 4.2 Discussion

### 4.2.1 Extraction Evaluation

**Corpus and Chunking.** [Discuss chunking behavior — whether the sliding window strategy produced coherent chunks or fragmented key information across chunk boundaries. Note any document types (scanned PDFs, complex tables, multi-column layouts) that degraded text extraction quality and how these were handled.]

**Field Coverage.** [Distinguish between two causes of low coverage: (1) the field is genuinely absent from the source document — a corpus characteristic, not an extraction failure — and (2) the field is present in the source but the LLM failed to extract it (a true FN). Government documents vary in scope; a pest management bulletin will naturally contain no yield data. Disaggregating these causes is essential for accurate interpretation of coverage rates.]

**Overall Extraction Fidelity.** [Interpret Precision, Recall, and F1 results from Table 4.3. Precision (TP / (TP + FP)) indicates how much of what was extracted is correct; a low score signals hallucination. Recall (TP / (TP + FN)) indicates how much of what was available was captured; a low score signals missed extraction. Discuss the precision-recall tradeoff — whether the system leans toward over-extraction or conservative extraction. Given that all source content is authoritative government text, the Hallucination Rate is a critical trustworthiness indicator.]

**Per-Field Performance.** [Using Table 4.4, analyze which fields were extracted most and least reliably. Interpret raw TP, FP, and FN counts alongside derived metrics. A field with low recall but zero FP is a safe but incomplete extractor; a field with high FP is a hallucination risk. Numeric and discrete fields (e.g., growth duration, yield data) are expected to carry higher hallucination risk due to unit variation and inferential filling. Narrative fields (e.g., pest management recommendations) may show lower precision but higher recall due to paraphrasing.]

**Provider Comparison.** [Using Table 4.5, compare providers on the quality-latency tradeoff. Discuss whether the multi-provider failover strategy successfully maintained pipeline throughput during quota events. Recommend the optimal provider configuration for this use case based on the combined Precision, Recall, Hallucination Rate, and latency profile.]

---

### 4.2.2 User Evaluation — App Usability and Impact

**Respondent Profile.** [Describe the composition from Table 4.6 and how it reflects the target user population — particularly noting the proportion of actual farmers and novice users, whose ratings most directly address RQ4. Note any relevant prior experience with agricultural information systems or chatbot tools that may have influenced ratings.]

**Usability.** [Interpret Table 4.7 weighted mean scores in the context of the testing tasks. Identify items with the lowest scores and relate them to specific interface elements or interaction flows. Note whether any testing task generated noticeably more difficulty than others.]

**Response Comprehensibility.** [Interpret Table 4.8. Discuss how user-perceived comprehensibility aligns with the objective response quality scores in Table 4.14. Respondents who used the document verification item are particularly informative — note any patterns in verification behavior and discuss implications for user trust in system outputs grounded in government sources.]

**System Reliability.** [Interpret Table 4.9. If perceived reliability diverges from what users experienced during the session, analyze possible causes such as latency perception, error visibility, or recovery behavior.]

**Perceived Impact.** [Interpret Table 4.10 with particular attention to the comparison item: *"This system made it easier to find agricultural information than searching through documents manually."* A high score on this item from farmer and novice respondents is the most direct evidence for RQ4. Compare Perceived Impact scores across respondent groups (students vs. farmers vs. extension workers) to identify whether accessibility gains are evenly distributed or concentrated in one group.]

**Internal Consistency.** [Report and interpret Cronbach's Alpha from Table 4.12. An alpha ≥ 0.70 per subscale confirms that items within each dimension reliably measure the same underlying construct. Identify which dimension showed the strongest and weakest consistency and discuss implications for instrument validity. Conclude with a statement on overall user acceptance of the system.]

---

### 4.2.3 Response Quality Evaluation

**Test Set Representativeness.** [Discuss how Table 4.13 categories were selected to reflect the range of queries that target users would realistically submit. Note any categories that were under-represented due to corpus coverage limitations.]

**Mean Rating Scores.** [Interpret Table 4.14. Identify which query categories produced the highest and lowest scores. For low-scoring categories, analyze root causes — whether failures stem from retrieval gaps (relevant crop records absent from the knowledge base), generation errors (LLM produced inaccurate responses despite correct context), or coverage gaps in the source corpus. Provide at least one qualitative example of a best-case response and one failure case with attribution of cause.]

**Inter-Rater Reliability.** [Interpret Table 4.15. Krippendorff's Alpha (α = 1 − D_o / D_e) measures rater panel agreement beyond chance. Report whether the overall α exceeds 0.67. If any query category shows substantially lower agreement, this suggests ambiguous evaluation criteria for that domain and should be acknowledged as a limitation of the response quality results for that category.]

---

### 4.2.4 Research Questions Synthesis

**RQ1 — How can a RAG framework be architected to provide natural language responses grounded in official Philippine agricultural documents?**
[Draw on Table 4.14 mean rating scores and Table 4.15 inter-rater reliability. Discuss whether retrieved context from official government documents was faithfully reflected in generated responses. Cite high- and low-scoring query categories as evidence of where the RAG architecture succeeded and where it was constrained by retrieval or generation limitations.]

**RQ2 — How can a specialized knowledge base be curated using official agricultural documents to address local agri-information gaps?**
[Draw on Tables 4.2, 4.3, and 4.4. A high overall F1 and low hallucination rate directly demonstrate that the pipeline produces a trustworthy, high-fidelity knowledge base from official source documents. Identify which fields were curated most completely and which represent persistent coverage gaps in the current corpus.]

**RQ3 — How does the integration of an EBR filter mitigate the risk of LLM hallucinations?**
[Draw primarily on the Hallucination Rate from Table 4.3 and per-field hallucination rates from Table 4.4. Discuss how EBR-grounded retrieval constrains LLM generation to verified source content, reducing fabrication compared to ungrounded generation. Reference the faithfulness dimension of rater scores from Table 4.14 as corroborating evidence at the response level.]

**RQ4 — To what extent does a conversational AI interface improve the accessibility of agronomic information for students, novice farmers, and the masses compared to traditional document-based retrieval?**
[Draw on Tables 4.10 and 4.11. Anchor the answer on the comparison item — *"easier than searching through documents manually"* — and break scores down by respondent group. Identify whether ease-of-use or response quality was the stronger driver of perceived accessibility improvement, and state whether the system meets its accessibility objective for the target population.]

---

---

# Chapter 5: Conclusion and Recommendations

## 5.1 Conclusion

[This section synthesizes the overall findings of the study and states whether the system achieved its intended purpose. Write 3–5 paragraphs covering the following, in order:]

**Opening — Restate the problem and objective.**
[Briefly restate that the study developed an agricultural RAG chatbot to make officially published Philippine government crop information accessible through natural language queries. Remind the reader why this problem matters — agricultural knowledge locked in unstructured PDFs is practically inaccessible to the target population without a system like this.]

**Summary of key findings — one paragraph per major finding.**
[Paragraph 1: Extraction fidelity. Summarize the overall F1 score and hallucination rate. State whether the pipeline successfully curated a high-fidelity knowledge base from official documents (RQ2) and whether the EBR filter demonstrably constrained hallucination (RQ3).]
[Paragraph 2: Response quality. Summarize the overall mean rater score. State whether RAG-grounded generation produced responses that are accurate, complete, and faithful to the official source documents (RQ1).]
[Paragraph 3: User acceptance and accessibility. Summarize the grand mean and perceived impact score, with particular emphasis on farmer respondents and the document-comparison item. State whether the system improved accessibility compared to manual document retrieval for the target population (RQ4).]

**Closing — Overall conclusion statement.**
[State whether the system, as evaluated, meets its design goals and is fit for its intended purpose. Acknowledge the primary limitation (e.g., corpus coverage, scanned PDF exclusion) that bounds the conclusion.]

---

## 5.2 Recommendations

[This section proposes specific, actionable directions for improving the system and for future research. Organize as a numbered list of recommendations, each with a brief justification.]

**For system improvement:**

1. **Expand the corpus to include regional and indigenous crop varieties.** [The current corpus is weighted toward nationally prominent crops. Coverage gaps identified in Section 4.2.1 limit the system's utility for users in regions that rely on minority or regional varieties. Future work should incorporate documents from regional DA offices and local government agricultural units.]

2. **Integrate OCR preprocessing for scanned PDFs.** [Scanned documents without an embedded text layer were excluded from the current pipeline. Incorporating an OCR step (e.g., Tesseract, AWS Textract) would substantially expand the accessible corpus, as a significant proportion of older Philippine agricultural publications exist only in scanned form.]

3. **Implement response confidence scoring.** [Add a confidence indicator to chatbot responses that reflects retrieval similarity scores, allowing users to distinguish between high-confidence answers grounded in close matches and lower-confidence answers derived from partial matches. This directly supports the ethical hallucination mitigation goal described in Section 3.8.4.]

4. **Conduct a longitudinal usability study with farmer respondents.** [The current evaluation captured user perception after a single structured testing session. A longitudinal study tracking farmers' information-seeking behavior over weeks of real-world use would provide stronger evidence for RQ4 and identify whether initial accessibility gains are sustained over time.]

**For future research:**

5. **Extend the EBR filter to multi-hop agricultural queries.** [The current EBR retrieves the top-K most similar crops for a single query. Agricultural advisory scenarios often require multi-hop reasoning (e.g., "What fertilizer is recommended for rice grown in clay soil during the dry season?"). Future work should explore chained retrieval or knowledge graph integration to support compound queries.]

6. **Evaluate cross-lingual retrieval for Filipino and regional language queries.** [The current system is English-only. Many Filipino farmers are more comfortable querying in Filipino or regional languages. Future work should evaluate multilingual embedding models and assess whether retrieval quality degrades for non-English queries against an English-language knowledge base.]
