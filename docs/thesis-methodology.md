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

The dataset for this study consists of official Philippine agricultural reference documents collected manually by the researchers from publicly accessible government online repositories. The collection and use of these documents required no special permissions, as all materials are classified as public government information. Data collection is divided into primary data — the PDF document corpus used for extraction — and secondary data — survey responses gathered from system testers.

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

### 3.3.5 Secondary Data — Application Testing and Usability Survey

A structured usability questionnaire was administered to **[N] respondents** after each participant completed a guided hands-on testing session with the system. Respondents comprised [describe population: e.g., agriculture students, extension workers, faculty] from [institution/region].

**Testing Protocol:** Prior to completing the survey, each respondent was given direct access to the deployed application and asked to perform a standardized set of tasks, including:
1. Querying the chatbot with [N] predefined crop-related questions
2. Reviewing chatbot responses and comparing them against the source document where indicated
3. Navigating the web panel to inspect extracted crop data records

Responses were recorded only after task completion, ensuring all survey ratings reflect actual interaction with the system rather than hypothetical or projected use.

Survey dimensions covered:
- **Usability** — ease of navigation, clarity of the interface, and task completion without assistance
- **Response Quality** — accuracy, completeness, and comprehensibility of chatbot answers as experienced during testing
- **System Reliability** — consistency and responsiveness observed during the testing session
- **Overall Satisfaction** — general assessment of the system's value for agricultural information retrieval

The survey used a **5-point Likert scale** (1 = Strongly Disagree, 5 = Strongly Agree) for all scaled items. The instrument was structured around usability heuristics and the **System Usability Scale (SUS)** adapted for the agricultural domain context, validated through expert review and pilot testing prior to full deployment.

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

## 3.5 Feature Engineering

### 3.5.1 Vector Embedding for Retrieval

For the RAG pipeline, chunk text was transformed into dense vector embeddings using [embedding model, e.g., `text-embedding-004` (Google), `text-embedding-3-small` (OpenAI)]. Embeddings capture semantic meaning beyond keyword overlap, enabling cosine-similarity-based retrieval.

Each chunk embedding is stored alongside its structured metadata, enabling hybrid retrieval that combines:
- **Dense retrieval** — cosine similarity over embeddings
- **Sparse retrieval (optional)** — BM25 keyword scoring for precision on named entities (crop names, chemical inputs)

### 3.5.2 Metadata Enrichment

Structured extracted fields (crop name, category, region) were attached to each chunk's vector record as filterable metadata. This enables **filtered RAG**, where a user query like "rice cultivation in Mindanao" can pre-filter by crop type before semantic search, improving retrieval precision.

### 3.5.3 Query Preprocessing

User queries submitted to the chatbot are preprocessed through:
- Lowercasing and punctuation normalization
- Intent classification (factual lookup vs. procedural guidance vs. comparison)
- Entity extraction (crop names, region names) for metadata-filtered retrieval

---

## 3.6 Model Training

> *Note: This system leverages pre-trained foundation models (Claude, Gemini) via API and does not perform traditional from-scratch model training. "Training" in this context refers to system configuration, prompt engineering, and RAG pipeline calibration.*

### 3.6.1 Prompt Engineering and Optimization

The extraction prompt template was developed iteratively. An initial prompt was drafted based on the target schema, then refined through [N] rounds of prompt evaluation on a held-out validation set. Metrics guiding prompt refinement included field extraction recall and format compliance rate.

Final extraction prompt components:
- **Role definition** — positions the model as a structured agricultural data extractor
- **Schema specification** — explicit JSON field names and expected data types
- **Few-shot examples** — [N] annotated examples included in the prompt for schema grounding
- **Negative instructions** — explicit directives to return null for absent fields rather than hallucinating values

### 3.6.2 RAG Pipeline Configuration

The RAG pipeline was configured with the following hyperparameters, determined via ablation study on the validation query set:

| Parameter | Value | Rationale |
|---|---|---|
| Top-K retrieved chunks | [N] | Balances context coverage vs. prompt length |
| Similarity threshold | [0.N] | Filters low-relevance chunks |
| Max context tokens | [N] | Fits within model context window |
| Reranking | [Yes/No] | Cross-encoder reranker for precision |

### 3.6.3 API Token Pool Management

The web panel's token rotation service manages a pool of LLM API keys with per-key quota tracking, cooldown scheduling, and failover logic. This ensures sustained throughput during large-scale batch extraction without manual key management.

---

## 3.7 Model Evaluation

### 3.7.1 Extraction Evaluation

Since all source documents are official government publications, their content is treated as the authoritative reference. Extraction quality was therefore evaluated as **source fidelity** — the degree to which the LLM correctly and completely captures information as stated in the original document text — rather than as agreement with independently annotated labels.

A verification set was constructed by randomly sampling **[N] chunks** and manually inspecting the raw text alongside the system's structured extraction output. For each sampled record, a reviewer confirmed whether each extracted field value was (a) present and correctly captured, (b) partially captured, or (c) absent or hallucinated. This verification was performed at the text level, not the factual level — reviewers checked fidelity to the document, not the real-world accuracy of the government content.

Metrics computed per field:

- **Precision** — proportion of extracted field values that faithfully reflect text found in the source chunk
- **Recall** — proportion of source-mentioned field values that were successfully extracted
- **F1-Score** — harmonic mean of precision and recall
- **Exact Match (EM)** — strict string equality after normalization (useful for discrete fields like crop names and numeric values)
- **Field Coverage Rate** — percentage of expected fields populated per record across all extracted documents
- **Hallucination Rate** — proportion of extracted values with no corresponding basis in the source chunk text

### 3.7.2 Retrieval Evaluation

The RAG retrieval component was evaluated on a set of [N] benchmark queries with known relevant chunks:

- **Hit Rate @ K** — proportion of queries where the correct chunk appears in top-K results
- **Mean Reciprocal Rank (MRR)** — average of the reciprocal rank of the first correct result
- **Normalized Discounted Cumulative Gain (nDCG)** — ranked relevance quality

### 3.7.3 Chatbot Response Evaluation

End-to-end chatbot responses were evaluated on the benchmark query set using:

- **BERTScore** / **ROUGE-L** — semantic and lexical overlap with reference answers
- **Faithfulness Score** — proportion of response claims verifiable against retrieved context (using an LLM judge)
- **Answer Relevance** — whether the response addresses the query intent

### 3.7.4 User Evaluation (Survey-Based)

Quantitative survey results were analyzed using:
- Descriptive statistics (mean, standard deviation) per Likert item
- Overall weighted mean interpretation using standard scale (e.g., 4.50–5.00 = Strongly Agree)
- Reliability analysis using **Cronbach's Alpha** for internal consistency of survey scales

### 3.7.5 System Performance Evaluation

Operational metrics evaluated:
- Average extraction time per chunk (seconds)
- End-to-end query response latency (ms)
- System uptime and error rate under load testing

---

## 3.8 Ethical Considerations

### 3.8.1 Informed Consent

All survey respondents were provided an informed consent form explaining the study's purpose, voluntary participation, anonymity of responses, and the right to withdraw without consequence. Data collection proceeded only upon signed consent.

### 3.8.2 Data Privacy

No personally identifiable information (PII) was collected beyond basic demographic categories (role, institution type, years of experience). Survey data is stored in aggregated form and reported only at the group level.

### 3.8.3 Source Authority, Attribution, and Copyright

All PDF documents processed were sourced from publicly available Philippine government repositories and are classified as official public information. Government-issued agricultural publications are considered part of the public domain under Philippine law and do not require additional licensing for academic use.

The use of government documents confers a dual ethical benefit: (1) the information extracted carries institutional authority and accountability, reducing the risk of propagating unverified or misleading agricultural guidance; and (2) the system effectively democratizes access to knowledge that is already public but practically inaccessible due to its unstructured PDF format.

The system preserves full source provenance by attributing every extracted record and every chatbot response to its originating document, allowing users to trace any piece of information back to its official government source.

### 3.8.4 AI-Generated Content and Hallucination Risk

The study acknowledges that LLM-based extraction and generation carry an inherent risk of hallucination or factual error. Mitigation strategies include: ground truth validation of extraction outputs, RAG-grounded generation to anchor responses to source text, and user-facing citation of source documents in chatbot responses.

### 3.8.5 Bias and Fairness

The agricultural corpus was reviewed for geographic and crop-type coverage balance to prevent the system from producing high-quality responses only for majority crops while underserving minority or regional varieties. Coverage gaps identified during evaluation are disclosed in the results.

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
