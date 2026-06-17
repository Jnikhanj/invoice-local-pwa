export const GST_RATE = 0.1;

export function todayISO() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

export function addDaysISO(dateString, days) {
  const date = dateString ? new Date(`${dateString}T00:00:00`) : new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(Number(value || 0));
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function normaliseABN(value) {
  return String(value || '').replace(/\D/g, '');
}

export function formatABN(value) {
  const digits = normaliseABN(value);
  if (!digits) return '';
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4');
}

export function validateABN(value) {
  const digits = normaliseABN(value);
  if (!digits) return { valid: false, reason: 'ABN is blank.' };
  if (!/^\d{11}$/.test(digits)) return { valid: false, reason: 'ABN must contain 11 digits.' };

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const numbers = digits.split('').map(Number);
  numbers[0] -= 1;
  const total = numbers.reduce((sum, digit, index) => sum + digit * weights[index], 0);
  const valid = total % 89 === 0;
  return {
    valid,
    reason: valid ? 'ABN format looks valid.' : 'ABN checksum is not valid.'
  };
}

export function formatBSB(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function uid(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isOverdue(invoice, today = todayISO()) {
  return invoice?.status !== 'paid' && invoice?.dueDate && invoice.dueDate < today;
}

export function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function parseMoney(value) {
  const cleaned = String(value || '').replace(/[^0-9.-]/g, '');
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}
