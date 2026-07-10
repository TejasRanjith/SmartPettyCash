"""
Self-hosted OCR API Server using PaddleOCR.
Run with: uvicorn server:app --host 0.0.0.0 --port 5000
Or via Docker (recommended).
"""
import os
import re
import json
import logging
from io import BytesIO
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from PIL import Image

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Receipt OCR Server", version="1.0.0")

# Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global OCR engine (lazy-loaded on first request)
ocr_engine = None

def get_ocr_engine():
    global ocr_engine
    if ocr_engine is None:
        logger.info("Loading PaddleOCR engine...")
        from paddleocr import PaddleOCR
        # Use the lightweight English model (4.1M params)
        # det_db_thresh: detection threshold, lower = more text found
        # rec_batch_num: batch size for recognition
        ocr_engine = PaddleOCR(
            use_angle_cls=True,  # Auto-rotate upside-down text
            lang='en',
            use_gpu=False,       # CPU-only for broad compatibility
            show_log=False,
            det_db_thresh=0.3,
            rec_batch_num=6,
        )
        logger.info("PaddleOCR engine loaded successfully.")
    return ocr_engine


def parse_ocr_result(ocr_result, raw_text_lines):
    """
    Parse PaddleOCR result into structured fields.
    Returns dict with date, description, amount, currency, vendor.
    """
    all_text = "\n".join(raw_text_lines)
    
    result = {
        "date": "",
        "description": "",
        "amount": "",
        "currency": "AED",
        "vendor": ""
    }

    # --- Extract date ---
    date_patterns = [
        r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b",
        r"\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b",
        r"\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b",
        r"\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b"
    ]
    for line in raw_text_lines:
        for pat in date_patterns:
            m = re.search(pat, line, re.IGNORECASE)
            if m:
                result["date"] = m.group(1)
                break
        if result["date"]:
            break

    # --- Extract total/amount ---
    amount_keywords = ['total', 'amount', 'sum', 'due', 'balance', 'grand total', 'net', 'payable']
    for line in raw_text_lines:
        lower = line.lower()
        has_kw = any(kw in lower for kw in amount_keywords)
        if has_kw:
            # Pattern: "Total: 125.50" or "Total AED 125.50"
            am = re.search(r"(?:total|amount|sum|due|balance|grand\s*total|net|payable)[:\s]*([A-Z]{0,3})\s*(\d{1,3}(?:,\d{3})*(?:\.\d{0,2})?)", line, re.IGNORECASE)
            if am:
                result["amount"] = am.group(2).replace(",", "")
                if am.group(1) and am.group(1).upper() in ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'OMR', 'QAR', 'BHD']:
                    result["currency"] = am.group(1).upper()
                break
            # Fallback: number at end of line
            am2 = re.search(r"(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*$", line)
            if am2:
                result["amount"] = am2.group(1).replace(",", "")
                break

    if not result["amount"]:
        # Look for the largest numerical value
        amounts = []
        for line in raw_text_lines:
            nums = re.findall(r"(\d{1,3}(?:,\d{3})*(?:\.\d{2}))", line)
            for n in nums:
                val = float(n.replace(",", ""))
                if val < 10000000:
                    amounts.append((val, n.replace(",", "")))
        if amounts:
            amounts.sort(key=lambda x: -x[0])
            result["amount"] = amounts[0][1]

    # --- Detect currency ---
    currency_map = {
        'AED': [r'\bAED\b', r'د\.إ', r'dirham', r'\bdh\b'],
        'USD': [r'\$', r'\bUSD\b', r'dollar'],
        'EUR': [r'€', r'\bEUR\b', r'euro'],
        'GBP': [r'£', r'\bGBP\b', r'pound'],
        'SAR': [r'\bSAR\b', r'riyal'],
    }
    for code, patterns in currency_map.items():
        if any(re.search(p, all_text, re.IGNORECASE) for p in patterns):
            result["currency"] = code
            break

    # --- Extract vendor ---
    skip_words = ['invoice', 'receipt', 'bill', 'tax', 'date', 'tel', 'phone', 'www', '.com', 'email', 'total', 'amount']
    for line in raw_text_lines:
        stripped = line.strip()
        if len(stripped) < 3:
            continue
        if re.search(r'\d{2}[/-]\d{2}[/-]\d{2,4}', stripped):
            continue
        lower = stripped.lower()
        if any(stripped.lower().startswith(w) for w in skip_words):
            continue
        result["vendor"] = stripped[:60]
        result["description"] = stripped[:60]
        break

    if not result["description"] and result["vendor"]:
        result["description"] = result["vendor"]

    # --- Clean amount ---
    if result["amount"]:
        cleaned = re.sub(r'[^0-9.]', '', result["amount"])
        try:
            parsed = float(cleaned)
            if parsed > 0:
                result["amount"] = f"{parsed:.2f}"
            else:
                result["amount"] = ""
        except ValueError:
            result["amount"] = ""

    return result


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "receipt-ocr"}


@app.post("/ocr")
async def ocr_receipt(file: UploadFile = File(...)):
    """
    Process a receipt image and return extracted text + structured data.
    Accepts: image/jpeg, image/png, image/webp
    """
    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"]:
        raise HTTPException(400, f"Unsupported image type: {file.content_type}. Use JPEG, PNG, or WebP.")

    try:
        # Read image bytes
        contents = await file.read()
        if len(contents) > 20 * 1024 * 1024:  # 20MB limit
            raise HTTPException(400, "Image too large. Maximum size is 20MB.")

        # Open with PIL
        image = Image.open(BytesIO(contents)).convert("RGB")
        image_np = np.array(image)

        logger.info(f"Processing image: {file.filename}, size={image.size}, format={image.format}")

        # Run OCR
        engine = get_ocr_engine()
        ocr_result = engine.ocr(image_np, cls=True)

        # Extract text
        raw_lines = []
        raw_text = ""
        all_boxes = []

        if ocr_result and ocr_result[0]:
            for line in ocr_result[0]:
                bbox, (text, confidence) = line
                raw_lines.append(text.strip())
                raw_text += text.strip() + "\n"
                all_boxes.append({
                    "box": [float(coord) for point in bbox for coord in point],
                    "text": text.strip(),
                    "confidence": round(float(confidence), 4)
                })

        logger.info(f"OCR extracted {len(raw_lines)} text lines")

        # Parse structured data
        parsed = parse_ocr_result(ocr_result, raw_lines)

        return {
            "success": True,
            "raw_text": raw_text.strip(),
            "lines": raw_lines,
            "confidence_avg": round(float(np.mean([b["confidence"] for b in all_boxes])), 4) if all_boxes else 0,
            "structured": parsed
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR processing failed: {str(e)}", exc_info=True)
        raise HTTPException(500, f"OCR processing failed: {str(e)}")


@app.post("/ocr/structured")
async def ocr_structured(file: UploadFile = File(...)):
    """
    Process receipt image and return only structured data (for direct frontend consumption).
    """
    result = await ocr_receipt(file)
    return {
        "success": True,
        "data": result["structured"],
        "confidence": result["confidence_avg"]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)