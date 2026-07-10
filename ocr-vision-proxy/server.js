/**
 * Google Cloud Vision API proxy server for receipt OCR.
 * 
 * This server:
 * 1. Accepts receipt image uploads from the frontend
 * 2. Sends them to Google Cloud Vision API for OCR (DOCUMENT_TEXT_DETECTION)
 * 3. Parses the extracted text into structured receipt fields
 * 4. Returns the structured data to the frontend
 * 
 * The API key stays secure on this server — never exposed to the browser.
 * 
 * Environment variables (via .env file):
 *   VISION_API_KEY  — Google Cloud Vision API key (required)
 *   PORT            — Server port (default: 5000)
 */

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// File upload config — store in memory as buffer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported image type: ${file.mimetype}. Use JPEG, PNG, or WebP.`));
    }
  }
});

// ---------- Google Cloud Vision API ----------

const VISION_API_KEY = process.env.VISION_API_KEY;

/**
 * Call Google Cloud Vision API for OCR text detection.
 * @param {Buffer} imageBuffer - Raw image bytes
 * @param {string} mimeType - Image MIME type
 * @returns {Promise<string>} Extracted text
 */
function callGoogleVisionAPI(imageBuffer, mimeType) {
  return new Promise((resolve, reject) => {
    if (!VISION_API_KEY) {
      return reject(new Error('VISION_API_KEY not configured on server'));
    }

    // Convert image to base64
    const base64Image = imageBuffer.toString('base64');

    const requestBody = JSON.stringify({
      requests: [
        {
          image: { content: base64Image },
          features: [
            { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }
          ],
          imageContext: {
            // Hint to the API about what kind of text to expect
            languageHints: ['en']
          }
        }
      ]
    });

    const options = {
      hostname: 'vision.googleapis.com',
      path: `/v1/images:annotate?key=${VISION_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          // Check for API errors
          if (parsed.error) {
            return reject(new Error(`Google Vision API error: ${parsed.error.message} (code ${parsed.error.code})`));
          }

          // Extract text from response
          const responses = parsed.responses || [];
          if (responses.length === 0 || !responses[0].fullTextAnnotation) {
            return resolve(''); // No text found
          }

          const text = responses[0].fullTextAnnotation.text || '';
          resolve(text);
        } catch (err) {
          reject(new Error(`Failed to parse Vision API response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Vision API request failed: ${err.message}`)));
    req.write(requestBody);
    req.end();
  });
}

// ---------- Receipt Text Parsing ----------

/**
 * Parse raw OCR text from a receipt into structured fields.
 */
function parseReceiptText(text) {
  if (!text || text.trim().length === 0) {
    return { date: '', description: '', amount: '', currency: 'AED', vendor: '' };
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = { date: '', description: '', amount: '', currency: 'AED', vendor: '' };

  // --- Extract date ---
  const datePatterns = [
    /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/,
    /\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/,
    /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i,
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/i
  ];
  for (const line of lines) {
    for (const pat of datePatterns) {
      const m = line.match(pat);
      if (m) { result.date = m[1]; break; }
    }
    if (result.date) break;
  }

  // --- Extract amount ---
  const amountKeywords = ['total', 'amount', 'sum', 'due', 'balance', 'grand total', 'net', 'payable'];
  for (const line of lines) {
    const lower = line.toLowerCase();
    const hasKeyword = amountKeywords.some(kw => lower.includes(kw));
    if (hasKeyword) {
      const am = line.match(/(?:total|amount|sum|due|balance|grand\s*total|net|payable)[:\s]*([A-Z]{0,3})\s*(\d{1,3}(?:,\d{3})*(?:\.\d{0,2})?)/i);
      if (am) {
        result.amount = am[2].replace(/,/g, '');
        if (am[1] && ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'OMR', 'QAR', 'BHD'].includes(am[1].toUpperCase())) {
          result.currency = am[1].toUpperCase();
        }
        break;
      }
    }
  }

  if (!result.amount) {
    let maxAmount = 0, maxStr = '';
    for (const line of lines) {
      const nums = line.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/g);
      if (nums) {
        for (const n of nums) {
          const val = parseFloat(n.replace(/,/g, ''));
          if (val > maxAmount && val < 10000000) {
            maxAmount = val;
            maxStr = n.replace(/,/g, '');
          }
        }
      }
    }
    if (maxStr) result.amount = maxStr;
  }

  // --- Detect currency ---
  const currencyPatterns = [
    { code: 'AED', patterns: [/\bAED\b/, /د\.إ/, /dirham/i, /\bdh\b/i] },
    { code: 'USD', patterns: [/\$/, /\bUSD\b/, /dollar/i] },
    { code: 'EUR', patterns: [/€/, /\bEUR\b/, /euro/i] },
    { code: 'GBP', patterns: [/£/, /\bGBP\b/, /pound/i] },
    { code: 'SAR', patterns: [/\bSAR\b/, /riyal/i] }
  ];
  for (const cur of currencyPatterns) {
    if (cur.patterns.some(p => p.test(text))) {
      result.currency = cur.code;
      break;
    }
  }

  // --- Extract vendor ---
  const skipWords = ['invoice', 'receipt', 'bill', 'tax', 'date', 'tel', 'phone', 'www', '.com', 'email', 'total', 'amount'];
  for (const line of lines) {
    const s = line.trim();
    if (s.length < 3) continue;
    if (/\d{2}[/-]\d{2}[/-]\d{2,4}/.test(s)) continue;
    const lower = s.toLowerCase();
    if (skipWords.some(w => lower.startsWith(w))) continue;
    result.vendor = s.substring(0, 60);
    result.description = s.substring(0, 60);
    break;
  }

  if (!result.description && result.vendor) result.description = result.vendor;

  // --- Clean amount ---
  if (result.amount) {
    const cleaned = result.amount.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed > 0) {
      result.amount = parsed.toFixed(2);
    } else {
      result.amount = '';
    }
  }

  return result;
}

// ---------- API Routes ----------

/**
 * GET /health — Health check
 */
app.get('/health', (req, res) => {
  const keyConfigured = !!VISION_API_KEY;
  res.json({
    status: 'ok',
    service: 'google-vision-ocr-proxy',
    key_configured: keyConfigured
  });
});

/**
 * POST /ocr — Full OCR with text + structured data
 */
app.post('/ocr', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    console.log(`Processing: ${req.file.originalname}, size=${(req.file.size / 1024).toFixed(1)}KB, type=${req.file.mimetype}`);

    // Call Google Cloud Vision API
    const rawText = await callGoogleVisionAPI(req.file.buffer, req.file.mimetype);
    const lines = rawText ? rawText.split('\n').filter(Boolean) : [];

    console.log(`Extracted ${lines.length} text lines`);

    // Parse structured data
    const structured = parseReceiptText(rawText);

    res.json({
      success: true,
      raw_text: rawText,
      lines: lines,
      confidence: 0.95, // Google Vision is highly reliable; no per-line confidence in this API mode
      engine: 'google_vision',
      structured
    });
  } catch (err) {
    console.error('OCR error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /ocr/structured — Quick structured-only endpoint (used by frontend)
 */
app.post('/ocr/structured', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    const rawText = await callGoogleVisionAPI(req.file.buffer, req.file.mimetype);
    const structured = parseReceiptText(rawText);

    res.json({
      success: true,
      data: structured,
      confidence: 0.95
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- Error handling middleware ----------

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'Image too large. Maximum size is 20MB.' });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ---------- Start server ----------

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n📄 Google Cloud Vision OCR Proxy Server`);
  console.log(`   Running on: http://0.0.0.0:${PORT}`);
  console.log(`   API key configured: ${!!VISION_API_KEY}`);
  if (!VISION_API_KEY) {
    console.warn(`\n⚠️  WARNING: VISION_API_KEY is not set!`);
    console.warn(`   Create a .env file with: VISION_API_KEY=your_key_here`);
    console.warn(`   Get a key at: https://console.cloud.google.com/apis/credentials\n`);
  }
});