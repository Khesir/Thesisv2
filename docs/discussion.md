# Thesis Writing Notes — Data Collection & Preprocessing

## Note on existing thesis-methodology.md (Section 3.4)

The existing 3.4 in `thesis-methodology.md` contains several **inaccurate claims** relative to the actual implementation. Before finalizing the thesis, these should be corrected:

| What the doc says | What the code actually does |
|---|---|
| "Multi-column layouts through bounding-box heuristics" | `pdfplumber` extracts text linearly — no bounding-box layout logic is applied |
| "Table detection and linearization" | `extract_tables()` exists in `pdf_extractor.py` but is **never called** in the web pipeline |
| "Header/footer stripping via positional filtering" | Not implemented — all page content is included verbatim |
| "Sliding window with overlap" | `segment_text()` uses paragraph/sentence boundary splitting — `self.overlap = 200` is defined but never applied |

Use the accurate subsections below as replacements.

---

## 3.3 Data Collection — Feedback and Suggested Subcategories

### Should you break it into subsections?

**Yes.** The current single paragraph covers four distinct ideas crammed together:
1. Where the data came from (source institutions)
2. How documents were selected (inclusion criteria)
3. What the corpus contains (document types, coverage)
4. Why fidelity-based evaluation is appropriate (epistemological framing)

The last point especially — evaluation framing — is important enough to stand on its own. Reviewers and committees look for this explicitly.

### Suggested structure

```
3.3    Data Collection
3.3.1  Document Sources
3.3.2  Inclusion Criteria
3.3.3  Corpus Composition
3.3.4  Evaluation Framing
```

### Draft content for each subsection

---

**3.3 Data Collection**

> The dataset for this study consists of official Philippine agricultural reference documents collected manually by the researchers from publicly accessible government online repositories. The collection and use of these documents required no special permissions, as all materials are classified as public government information.

---

**3.3.1 Document Sources**

> Source documents were obtained from recognized national agricultural institutions, primarily the Department of Agriculture (DA) and the Philippine Rice Research Institute (PhilRice). These agencies were selected because they are the principal government authorities responsible for issuing crop production standards, pest management guidelines, and agricultural technical recommendations in the Philippines. All documents were accessed through their official online repositories in PDF format.

---

**3.3.2 Inclusion Criteria**

> Documents were included in the corpus based on the following criteria:
>
> 1. **Institutional authority** — issued by a recognized national or regional Philippine government agricultural agency
> 2. **Content relevance** — directly pertains to crop cultivation, pest and disease management, or yield-related information
> 3. **Technical parsability** — available as a digitally parseable PDF (not a scanned image-only file)
>
> Documents failing any criterion were excluded. Scanned PDFs with no embedded text layer were excluded due to the absence of OCR in the current pipeline.

---

**3.3.3 Corpus Composition**

> The compiled corpus includes [N] PDF documents spanning [N] crop varieties, comprising technical production guides, crop management manuals, pest and disease bulletins, and research-based recommendations. Documents vary in length from [N] to [N] pages, with an average of [N] pages per document. The corpus collectively covers [N] distinct document categories and represents [N] issuing agencies.

---

**3.3.4 Evaluation Framing**

> Because all source documents originate from authoritative government institutions, their content is treated as institutionally validated without independent expert re-annotation. Accordingly, system evaluation in this study measures **extraction fidelity** — the degree to which the system accurately and completely captures information as stated in the original source text — rather than the factual correctness of the underlying agricultural content itself. This distinction is important: a low-fidelity extraction is a system error; a factual inaccuracy in the source document is outside the scope of this study's evaluation.

---

## 3.4 Data Preprocessing — Accurate Replacement Subsections

### 3.4 Data Preprocessing *(intro paragraph)*

> Raw PDF documents contain unstructured text interleaved with page layout artifacts. Prior to LLM-based extraction, each document undergoes a three-stage preprocessing pipeline: (1) text extraction, (2) cleaning and normalization, and (3) segmentation into fixed-size chunks. Each stage is implemented as a standalone Python module within the LLM Extraction Module and is invoked by the web panel via a JSON-over-stdin/stdout subprocess protocol.

---

### 3.4.1 PDF Text Extraction

> Text is extracted from PDF files using `pdfplumber`, a Python library that parses PDF content streams to recover embedded text. Each page is processed individually via `page.extract_text()`, and the resulting page texts are concatenated with double newline delimiters (`\n\n`) to preserve paragraph-level separation between pages. The full concatenated text, individual page texts, and document metadata — including title, author, page count, and total word count — are collected as a single structured output.
>
> A SHA-256 hash of the full extracted text is generated at this stage for downstream deduplication. The extraction process makes no structural modifications to the content: page numbers, running headers and footers, figure captions, and reference sections are included in the output as extracted.

---

### 3.4.2 Text Cleaning and Normalization

> The raw extracted text is passed through a normalization routine (`TextProcessor.clean_text()`) that applies the following transformations:
>
> - **Whitespace normalization** — consecutive whitespace characters (including tabs and multiple spaces) are collapsed into a single space; repeated newlines are reduced to a single newline
> - **Character filtering** — non-word characters are removed, with explicit retention of characters common in agricultural data: the degree symbol (`°`), percent sign (`%`), and forward slash (`/`)
> - **Boundary trimming** — leading and trailing whitespace is removed from the cleaned string
>
> Following cleaning, a section detector (`TextProcessor.extract_sections()`) applies regex pattern matching against common academic section headings — *Introduction*, *Materials and Methods*, *Results*, *Discussion*, *Conclusion*, and *References* — to annotate structural boundaries within the document. Section labels are recorded as metadata but are not used to filter or exclude content from LLM processing at this stage.

---

### 3.4.3 Text Segmentation and Chunking

> The cleaned text is segmented into fixed-size chunks using a hierarchical boundary-respecting strategy (`TextProcessor.segment_text()`). The chunker applies the following cascade:
>
> 1. **Paragraph-first splitting** — the text is initially split at double-newline boundaries (`\n\n`), preserving logical paragraph units
> 2. **Sentence-level fallback** — paragraphs exceeding the token limit are further split at sentence boundaries using punctuation patterns (`[.!?]`)
> 3. **Word-level fallback** — individual sentences that still exceed the limit are split at word boundaries to guarantee the chunk size constraint is met
>
> The default chunk size is **1,000 tokens**, approximated at a ratio of four characters per token. This parameter is configurable at runtime via the web panel interface. Chunks are stored in MongoDB with sequential index, source document reference, raw content, and estimated token count.
>
> No chunk overlap is applied in the current implementation; each chunk represents a non-overlapping segment of the source text.

---

## Limitations of the Preprocessing Pipeline
*(place this in a Limitations section — either 3.x at end of Chapter 3, or Chapter 5)*

> The preprocessing pipeline, while functional for the study's scope, has several known limitations that may introduce noise into LLM extraction inputs:
>
> **Structural non-filtering.** Page numbers, running headers, footers, figure captions, and bibliography/reference sections are included in the text passed to the LLM. The section detector identifies document structure but does not exclude noisy sections from processing. This means the LLM receives, for example, citation lists and repeated header text as extraction input, consuming tokens without contributing extractable agricultural content.
>
> **Table flattening.** Agricultural documents frequently present structured data — yield tables, fertilizer rate schedules, climate parameter ranges — in tabular form. The current pipeline extracts tables as linearized text rows, which often produces garbled or ambiguous content when row-column relationships collapse into undifferentiated strings. The `extract_tables()` method within the PDF extractor is not integrated into the active processing pipeline.
>
> **Fixed-size non-semantic chunking.** Chunk boundaries are determined by size and paragraph/sentence structure, not by semantic topic coherence. A single crop variety's complete description may be split across two adjacent chunks, severing the contextual relationship between, for example, its soil requirements and fertilizer recommendations.
>
> **No chunk overlap.** While an overlap parameter (`self.overlap = 200`) is defined in the `TextProcessor` class, it is not applied in the segmentation logic. This means content at chunk boundaries has no cross-chunk context preservation, potentially causing the LLM to miss information that spans a boundary.
>
> These limitations are acknowledged as areas for future improvement and are discussed further in Chapter 5.
