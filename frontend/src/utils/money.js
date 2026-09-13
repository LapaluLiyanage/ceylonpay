export function formatMoney(amount) {
  const n = typeof amount === 'number' ? amount : parseFloat(amount);
  return 'Rs. ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseAmountInput(raw) {
  const s = String(raw || '').replace(/[,\s]/g, '');
  if (!s) return { error: 'Enter an amount.' };
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return { error: 'Use numbers only, up to two decimals.' };
  const value = Math.round(parseFloat(s) * 100) / 100;
  if (value < 1) return { error: 'The smallest amount is Rs. 1.00.' };
  return { value };
}
