from io import BytesIO
from pathlib import Path

from docx import Document
from fastapi import HTTPException, UploadFile
from pypdf import PdfReader

MAX_DOCUMENT_BYTES = 8 * 1024 * 1024
MAX_DOCUMENT_CHARS = 30000


async def extract_document_text(upload: UploadFile) -> str:
    filename = upload.filename or ""
    extension = Path(filename).suffix.lower()
    if extension not in {".pdf", ".docx", ".txt"}:
        raise HTTPException(status_code=415, detail="Upload a PDF, DOCX, or TXT file")

    content = await upload.read(MAX_DOCUMENT_BYTES + 1)
    if len(content) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=413, detail="Each document must be 8 MB or smaller")

    try:
        if extension == ".pdf":
            text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(content)).pages)
        elif extension == ".docx":
            document = Document(BytesIO(content))
            text = "\n".join(paragraph.text for paragraph in document.paragraphs)
        else:
            text = content.decode("utf-8-sig")
    except Exception as error:
        raise HTTPException(status_code=400, detail="Could not read this document") from error

    text = text.strip()
    if len(text) < 40:
        raise HTTPException(
            status_code=400,
            detail="No readable text found. For scanned PDFs, upload a text-based PDF or TXT file.",
        )
    return text[:MAX_DOCUMENT_CHARS]