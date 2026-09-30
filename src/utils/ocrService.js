import { parseReceiptText } from './receiptParser';

/**
 * Default OCR.space API key. 'helloworld' is the free demo key.
 * Users can configure their own key which gets saved to localStorage.
 */
const DEFAULT_API_KEY = 'helloworld';
const OCR_SPACE_ENDPOINT = 'https://api.ocr.space/parse/image';

/**
 * Get the configured OCR.space API key from localStorage or use default.
 * @returns {string} API key
 */
export function getApiKey() {
  return localStorage.getItem('ocr_space_api_key') || DEFAULT_API_KEY;
}

/**
 * Save the OCR.space API key to localStorage.
 * @param {string} key - API Key
 */
export function setApiKey(key) {
  if (key && key.trim()) {
    localStorage.setItem('ocr_space_api_key', key.trim());
  } else {
    localStorage.removeItem('ocr_space_api_key');
  }
}

/**
 * Helper to fetch with exponential backoff on 503 / 429 status codes.
 */
async function fetchWithRetry(url, options, maxRetries = 2, baseDelay = 1500) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If 503 Service Unavailable or 429 Too Many Requests, wait and retry
      if ((response.status === 503 || response.status === 429) && attempt < maxRetries) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter 
          ? parseInt(retryAfter, 10) * 1000 
          : baseDelay * Math.pow(2, attempt) + Math.random() * 500;
          
        console.warn(`[OCR.space] Status ${response.status} encountered. Retrying in ${Math.round(waitMs)}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const waitMs = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('Request failed after retries');
}

/**
 * Scan receipt image using OCR.space API.
 * Uses OCR Engine 2 which is optimized for receipts, fast speed, and numbers.
 * @param {File|Blob} imageFile - The image to process
 * @param {Object} [options] - Configuration options
 * @param {Function} [options.onProgress] - Callback for progress
 * @returns {Promise<Object>} Parsed receipt data
 */
export async function scanReceipt(imageFile, options = {}) {
  const { onProgress } = options;
  const apiKey = getApiKey();

  try {
    if (onProgress) onProgress(20);

    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('apikey', apiKey);
    formData.append('language', 'eng');
    formData.append('ocrEngine', '2'); 
    formData.append('isTable', 'true');
    formData.append('scale', 'true');

    if (onProgress) onProgress(40);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50s timeout

    const response = await fetchWithRetry(OCR_SPACE_ENDPOINT, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (onProgress) onProgress(70);

    if (!response.ok) {
      if (response.status === 503) {
        throw new Error('OCR.space service is temporarily busy (HTTP 503). Please wait a few seconds, or add your free personal API key in OCR Settings.');
      }
      throw new Error(`OCR.space API error: Status ${response.status}`);
    }

    const result = await response.json();

    if (onProgress) onProgress(90);

    // Check for API-level errors
    if (result.IsErroredOnProcessing) {
      const errorMsg = result.ErrorMessage ? result.ErrorMessage[0] : 'Unknown processing error';
      throw new Error(`OCR Processing Error: ${errorMsg}`);
    }

    const parsedResults = result.ParsedResults || [];
    if (parsedResults.length === 0) {
      throw new Error('No text parsed from the receipt. Please try a clearer image.');
    }

    const rawText = parsedResults[0].ParsedText || '';
    
    // Parse the extracted text into structured receipt fields
    const parsedData = parseReceiptText(rawText);

    if (onProgress) onProgress(100);

    return {
      ...parsedData,
      rawText,
      confidence: 1.0,
      engine: 'ocr_space'
    };
  } catch (error) {
    console.error('OCR.space scan failed:', error);
    if (error.name === 'AbortError') {
      throw new Error('OCR scan timed out. Please check your internet connection and try again.');
    }
    throw error;
  }
}

/**
 * Create a File object from a camera capture (Blob).
 * @param {Blob} blob - The image blob from camera
 * @param {string} filename - Desired filename
 * @returns {File} File object
 */
export function blobToFile(blob, filename = 'receipt.jpg') {
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}