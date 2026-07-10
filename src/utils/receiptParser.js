/**
 * Parse raw OCR text from a receipt and extract structured fields.
 * Uses regex patterns to detect dates, amounts, vendor names, etc.
 * @param {string} text - Raw text extracted by OCR
 * @returns {Object} Parsed receipt data
 */
/**
 * Normalizes any detected date format into YYYY-MM-DD format,
 * so that standard HTML5 <input type="date"> elements can read and display it.
 * @param {string} dateStr - Extracted raw date string
 * @returns {string} Normalized YYYY-MM-DD date string, or empty string if invalid
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return '';
  dateStr = dateStr.trim();

  // 1. Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // 2. Format: DD/MM/YYYY or MM/DD/YYYY (or with hyphens/dots)
  const dmyMatch = dateStr.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmyMatch) {
    let part1 = parseInt(dmyMatch[1], 10);
    let part2 = parseInt(dmyMatch[2], 10);
    let year = dmyMatch[3];

    // Normalize 2-digit years
    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      year = (century + parseInt(year, 10)).toString();
    }

    let day, month;
    if (part1 > 12) {
      day = part1;
      month = part2;
    } else if (part2 > 12) {
      day = part2;
      month = part1;
    } else {
      // Both <= 12, assume DD-MM-YYYY as default (highly standard outside the US)
      day = part1;
      month = part2;
    }

    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  // 3. Format: YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = dateStr.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = parseInt(ymdMatch[2], 10).toString().padStart(2, '0');
    const day = parseInt(ymdMatch[3], 10).toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 4. Textual dates, e.g. "12 May 2024", "May 12, 2024", "24-Apr-2026"
  try {
    const cleanedStr = dateStr.replace(/-/g, ' ');
    const timestamp = Date.parse(cleanedStr);
    if (!isNaN(timestamp)) {
      const d = new Date(timestamp);
      const year = d.getFullYear();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // Ignore and fallback
  }

  return '';
}

export function parseReceiptText(text) {
  if (!text || text.trim().length === 0) {
    return { date: '', description: '', amount: '', currency: 'AED' };
  }

  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const result = {
    date: '',
    description: '',
    amount: '',
    currency: 'AED',
    vendor: ''
  };

  // --- Extract date ---
  // Match common date formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, etc.
  const datePatterns = [
    /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/,                        // 12/05/2024 or 12-05-2024
    /\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/,                           // 2024-05-12
    /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i, // 12 May 2024
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/i // May 12, 2024
  ];

  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        result.date = normalizeDate(match[1]);
        break;
      }
    }
    if (result.date) break;
  }

  // --- Extract total/amount ---
  // Look for patterns like "Total: 125.50", "Amount: 125.50", or just "125.50" near keywords
  const amountKeywords = ['total', 'amount', 'sum', 'due', 'balance', 'grand total', 'net', 'payable'];
  
  // First: look for lines with amount keywords followed by a number
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const hasKeyword = amountKeywords.some(kw => lowerLine.includes(kw));
    if (hasKeyword) {
      const amountMatch = line.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*$/);
      if (amountMatch) {
        result.amount = amountMatch[1].replace(/,/g, '');
        break;
      }
      // Try alternate: keyword then separator then number
      const altMatch = line.match(/(?:total|amount|sum|due|balance|grand\s*total|net|payable)[:\s]*([A-Z]{0,3})\s*(\d{1,3}(?:,\d{3})*(?:\.\d{0,2})?)/i);
      if (altMatch) {
        result.amount = altMatch[2].replace(/,/g, '');
        if (altMatch[1] && ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'OMR', 'QAR', 'BHD'].includes(altMatch[1].toUpperCase())) {
          result.currency = altMatch[1].toUpperCase();
        }
        break;
      }
    }
  }

  // If no amount found with keywords, look for the largest number (likely the total)
  if (!result.amount) {
    let maxAmount = 0;
    let maxAmountStr = '';
    for (const line of lines) {
      const numbers = line.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/g);
      if (numbers) {
        for (const numStr of numbers) {
          const num = parseFloat(numStr.replace(/,/g, ''));
          if (num > maxAmount && num < 10000000) { // reasonable receipt amount
            maxAmount = num;
            maxAmountStr = numStr.replace(/,/g, '');
          }
        }
      }
    }
    if (maxAmountStr) {
      result.amount = maxAmountStr;
    }
  }

  // --- Detect currency from text ---
  const currencyPatterns = [
    { code: 'AED', patterns: [/AED/, /د\.إ/, /dirham/i, /dh\b/i] },
    { code: 'USD', patterns: [/\$/, /USD/, /dollar/i] },
    { code: 'EUR', patterns: [/€/, /EUR/, /euro/i] },
    { code: 'GBP', patterns: [/£/, /GBP/, /pound/i] },
    { code: 'SAR', patterns: [/SAR/, /riyal/i, /﷼/] }
  ];

  for (const currency of currencyPatterns) {
    if (currency.patterns.some(p => p.test(text))) {
      result.currency = currency.code;
      break;
    }
  }

  // --- Extract vendor/company name ---
  // Usually the first few non-empty lines contain the vendor name
  const skipWords = ['invoice', 'receipt', 'bill', 'tax', 'date', 'tel', 'phone', 'www', '.com', 'email'];
  
  let vendorLines = lines.filter(line => {
    const lower = line.toLowerCase();
    // Skip lines that are just numbers, dates, or common header words
    if (/^\d+$/.test(line) || /\d{2}[/-]\d{2}[/-]\d{2,4}/.test(line)) return false;
    if (skipWords.some(w => lower.startsWith(w) || lower.includes(w))) return false;
    if (line.length < 3) return false;
    return true;
  });

  if (vendorLines.length > 0) {
    // Take the first likely vendor line
    result.vendor = vendorLines[0].substring(0, 60);
    result.description = vendorLines[0].substring(0, 60);
  }

  // --- If we couldn't extract a description, use the vendor ---
  if (!result.description && result.vendor) {
    result.description = result.vendor;
  }

  // --- Clean up amount ---
  if (result.amount) {
    // Remove any non-numeric characters except decimal point
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