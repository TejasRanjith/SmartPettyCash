/**
 * Formats a Date/Timestamp into the standardized voucher code:
 * exp_voucher_<YYMMDD>-<HHMMSS>
 * e.g., exp_voucher_260930-121445
 */
export function formatVoucherCode(input = new Date()) {
  let d;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === 'number' || typeof input === 'string') {
    const num = Number(input);
    d = !isNaN(num) && num > 1000000000 ? new Date(num) : new Date(input);
  } else {
    d = new Date();
  }

  // Fallback if invalid date
  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  return `exp_voucher_${yy}${mm}${dd}-${hh}${min}${ss}`;
}

/**
 * Calculates total AED for a list of expenses
 */
export function calculateExpensesTotal(expenses = []) {
  return expenses
    .reduce((sum, exp) => sum + (parseFloat(exp.amountAED) || 0), 0)
    .toFixed(2);
}
