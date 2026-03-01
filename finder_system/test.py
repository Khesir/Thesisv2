import hashlib

import pdfplumber

pdf_path = ""

with pdfplumber.open(pdf_path) as pdf:
    full_text = ""
    for page in pdf.pages:
        page_text = page.extract_text() or ""
        full_text += page_text + "\n\n"

content_hash = hashlib.sha256(full_text.encode()).hexdigest()