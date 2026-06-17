import { GST_RATE, formatCurrency, parseMoney } from './utils.js';

export function createBlankInvoice(settings, nextNumber) {
  const today = settings.today;
  return {
    id: null,
    invoiceNumber: buildInvoiceNumber(settings.invoicePrefix, today, nextNumber),
    invoiceDate: today,
    dueDate: settings.defaultDueDate,
    status: 'draft',
    reference: '',
    client: {
      id: '',
      name: '',
      email: '',
      address: '',
      abn: ''
    },
    lineItems: [createLineItem()],
    notes: settings.defaultNotes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function createLineItem() {
  return {
    id: `line-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    description: '',
    quantity: 1,
    rate: 0,
    gstApplies: true
  };
}

export function buildInvoiceNumber(prefix = 'INV', todayISO = '', sequence = 1) {
  const year = todayISO ? todayISO.slice(0, 4) : new Date().getFullYear();
  return `${String(prefix || 'INV').toUpperCase()}-${year}-${String(sequence || 1).padStart(4, '0')}`;
}

export function calculateInvoiceTotals(invoice, settings) {
  const gstRegistered = Boolean(settings.gstRegistered);
  const gstMode = settings.gstMode || 'exclusive';
  const rows = invoice.lineItems.map((item) => calculateLineItem(item, gstRegistered, gstMode));
  const subtotal = rows.reduce((sum, row) => sum + row.net, 0);
  const gst = rows.reduce((sum, row) => sum + row.gst, 0);
  const total = rows.reduce((sum, row) => sum + row.total, 0);

  return {
    rows,
    subtotal,
    gst,
    total,
    subtotalFormatted: formatCurrency(subtotal),
    gstFormatted: formatCurrency(gst),
    totalFormatted: formatCurrency(total)
  };
}

export function calculateLineItem(item, gstRegistered, gstMode) {
  const quantity = Math.max(0, parseMoney(item.quantity));
  const rate = Math.max(0, parseMoney(item.rate));
  const amount = quantity * rate;
  const taxable = gstRegistered && item.gstApplies;

  if (!taxable) {
    return { quantity, rate, net: amount, gst: 0, total: amount };
  }

  if (gstMode === 'inclusive') {
    const gst = amount / 11;
    return { quantity, rate, net: amount - gst, gst, total: amount };
  }

  const gst = amount * GST_RATE;
  return { quantity, rate, net: amount, gst, total: amount + gst };
}

export function invoiceDisplayStatus(invoice, todayISO = new Date().toISOString().slice(0, 10)) {
  if (invoice?.status !== 'paid' && invoice?.dueDate && invoice.dueDate < todayISO) return 'overdue';
  return invoice.status || 'draft';
}

export function statusLabel(status) {
  const labels = {
    draft: 'Draft',
    sent: 'Sent',
    paid: 'Paid',
    overdue: 'Overdue'
  };
  return labels[status] || 'Draft';
}
