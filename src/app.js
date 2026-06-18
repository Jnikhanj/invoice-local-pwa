import { get, getAll, put, remove, clearAll, exportAll, importAll } from './db.js';
import {
  addDaysISO,
  downloadJSON,
  escapeHTML,
  formatABN,
  formatBSB,
  formatCurrency,
  formatDate,
  formatNumber,
  normaliseABN,
  todayISO,
  uid,
  validateABN
} from './utils.js';
import {
  calculateInvoiceTotals,
  createBlankInvoice,
  createLineItem,
  invoiceDisplayStatus,
  statusLabel
} from './invoice.js';

const DEFAULT_SETTINGS = {
  id: 'business',
  businessName: '',
  abn: '',
  email: '',
  phone: '',
  address: '',
  gstRegistered: true,
  gstMode: 'exclusive',
  paymentTermsDays: 7,
  invoicePrefix: 'INV',
  bankName: '',
  bankBsb: '',
  bankAccountNumber: '',
  bankAccountName: '',
  defaultNotes: 'Payment is due by the due date. Please include the invoice number as the payment reference.'
};

const META_SEQUENCE_ID = 'invoiceSequence';

const state = {
  view: 'dashboard',
  settings: { ...DEFAULT_SETTINGS },
  clients: [],
  invoices: [],
  currentInvoice: null,
  invoiceFilter: 'all',
  invoiceSearch: ''
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

init();

async function init() {
  setDateLabel();
  await loadState();
  state.currentInvoice = await newInvoiceDraft();
  bindEvents();
  renderAll();
  registerServiceWorker();
}

async function loadState() {
  const savedSettings = await get('settings', 'business');
  state.settings = { ...DEFAULT_SETTINGS, ...(savedSettings || {}) };
  state.clients = await getAll('clients');
  state.invoices = await getAll('invoices');
  state.invoices.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

async function newInvoiceDraft() {
  const today = todayISO();
  const meta = await get('meta', META_SEQUENCE_ID);
  const nextNumber = meta?.value || 1;
  return createBlankInvoice({
    ...state.settings,
    today,
    defaultDueDate: addDaysISO(today, state.settings.paymentTermsDays)
  }, nextNumber);
}

function bindEvents() {
  $$('.nav-link').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  $$('[data-view-target]').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.viewTarget));
  });

  $('#new-invoice-button').addEventListener('click', async () => {
    state.currentInvoice = await newInvoiceDraft();
    setView('builder');
    renderBuilder();
  });

  $('#print-button').addEventListener('click', printCurrentInvoice);
  $('#print-preview-button').addEventListener('click', printCurrentInvoice);

  $('#settings-form').addEventListener('submit', saveSettings);
  $('#invoice-form').addEventListener('submit', saveInvoice);
  $('#add-line-button').addEventListener('click', addLineItem);
  $('#reset-invoice-button').addEventListener('click', resetCurrentInvoice);
  $('#save-client-button').addEventListener('click', saveCurrentClient);
  $('#client-select').addEventListener('change', applySelectedClient);

  $('#invoice-filter').addEventListener('change', (event) => {
    state.invoiceFilter = event.target.value;
    renderInvoices();
  });
  $('#invoice-search').addEventListener('input', (event) => {
    state.invoiceSearch = event.target.value.trim().toLowerCase();
    renderInvoices();
  });

  $('#export-backup-button').addEventListener('click', exportBackup);
  $('#import-backup-input').addEventListener('change', importBackup);
  $('#clear-data-button').addEventListener('click', clearLocalData);

  $('#invoice-form').addEventListener('input', updateInvoiceFromForm);
  $('#invoice-form').addEventListener('change', updateInvoiceFromForm);
  $('#settings-form').addEventListener('input', handleSettingsPreview);

  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (state.view === 'builder') saveInvoice(event);
      if (state.view === 'settings') saveSettings(event);
    }
  });
}

function renderAll() {
  renderNav();
  renderDashboard();
  renderBuilder();
  renderInvoices();
  renderClients();
  renderSettings();
}

function setDateLabel() {
  const formatted = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date());
  $('#current-date-label').textContent = `Australia • ${formatted}`;
}

function setView(view) {
  state.view = view;
  renderNav();
  $$('.view').forEach((section) => section.classList.remove('is-active'));
  $(`#view-${view}`).classList.add('is-active');
  $('#view-title').textContent = {
    dashboard: 'Dashboard',
    builder: 'New Invoice',
    invoices: 'Invoices',
    clients: 'Clients',
    settings: 'Settings',
    backup: 'Backup'
  }[view];
}

function renderNav() {
  $$('.nav-link').forEach((button) => button.classList.toggle('is-active', button.dataset.view === state.view));
}

function renderDashboard() {
  const today = todayISO();
  const totals = state.invoices.reduce((acc, invoice) => {
    const total = Number(invoice.total || 0);
    if (invoice.status === 'paid') acc.paid += total;
    if (invoice.status !== 'paid') acc.unpaid += total;
    if (invoice.status !== 'paid' && invoice.dueDate && invoice.dueDate < today) acc.overdue += total;
    if (invoice.status === 'draft') acc.draft += 1;
    return acc;
  }, { unpaid: 0, overdue: 0, paid: 0, draft: 0 });

  $('#dashboard-metrics').innerHTML = [
    metricCard('Unpaid', formatCurrency(totals.unpaid), 'Open invoices not marked paid'),
    metricCard('Overdue', formatCurrency(totals.overdue), 'Due date has passed'),
    metricCard('Paid total', formatCurrency(totals.paid), 'Invoices marked paid'),
    metricCard('Drafts', String(totals.draft), 'Invoices still in draft')
  ].join('');

  const recent = state.invoices.slice(0, 5);
  $('#recent-invoices').innerHTML = recent.length
    ? recent.map((invoice) => listInvoiceCard(invoice)).join('')
    : emptyState('No invoices yet', 'Create your first invoice to see it here.');

  const checks = [
    { label: 'Business name added', done: Boolean(state.settings.businessName) },
    { label: 'ABN added', done: Boolean(state.settings.abn) },
    { label: 'Payment details added', done: Boolean(state.settings.bankBsb && state.settings.bankAccountNumber) },
    { label: 'GST setting reviewed', done: state.settings.gstRegistered !== undefined }
  ];

  $('#setup-status').innerHTML = checks.map((item) => `
    <div class="check-row ${item.done ? 'is-done' : ''}">
      <span>${item.done ? '✓' : '•'}</span>
      <strong>${escapeHTML(item.label)}</strong>
    </div>
  `).join('');
}

function metricCard(label, value, helper) {
  return `<section class="metric-card"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(helper)}</small></section>`;
}

function listInvoiceCard(invoice) {
  const displayStatus = invoiceDisplayStatus(invoice, todayISO());
  return `
    <article class="list-card">
      <div><strong>${escapeHTML(invoice.invoiceNumber)}</strong><span>${escapeHTML(invoice.client?.name || 'No client')}</span></div>
      <div class="list-card__end"><strong>${formatCurrency(invoice.total)}</strong><span class="status-pill status-pill--${displayStatus}">${statusLabel(displayStatus)}</span></div>
    </article>
  `;
}

function renderBuilder() {
  populateClientSelect();
  fillInvoiceForm();
  renderLineItems();
  renderTotalsEditor();
  renderPreview();
}

function populateClientSelect() {
  const select = $('#client-select');
  const selected = state.currentInvoice?.client?.id || '';
  select.innerHTML = `<option value="">Manual entry</option>` + state.clients
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .map((client) => `<option value="${escapeHTML(client.id)}">${escapeHTML(client.name || 'Unnamed client')}</option>`)
    .join('');
  select.value = selected;
}

function fillInvoiceForm() {
  const invoice = state.currentInvoice;
  if (!invoice) return;

  setValue('invoice-number', invoice.invoiceNumber);
  setValue('invoice-status', invoice.status || 'draft');
  setValue('invoice-date', invoice.invoiceDate);
  setValue('due-date', invoice.dueDate);
  setValue('client-name', invoice.client?.name || '');
  setValue('client-email', invoice.client?.email || '');
  setValue('client-address', invoice.client?.address || '');
  setValue('client-abn', formatABN(invoice.client?.abn || ''));
  setValue('invoice-reference', invoice.reference || '');
  setValue('invoice-notes', invoice.notes || state.settings.defaultNotes || '');
  $('#invoice-status-pill').textContent = statusLabel(invoiceDisplayStatus(invoice, todayISO()));
}

function renderLineItems() {
  const container = $('#line-items');
  container.innerHTML = state.currentInvoice.lineItems.map((item, index) => `
    <div class="line-item" data-line-id="${escapeHTML(item.id)}">
      <label class="line-item__description"><span>Description</span><input data-line-field="description" value="${escapeHTML(item.description)}" placeholder="Service or item description" /></label>
      <label><span>Qty</span><input data-line-field="quantity" inputmode="decimal" value="${escapeHTML(item.quantity)}" /></label>
      <label><span>Rate</span><input data-line-field="rate" inputmode="decimal" value="${escapeHTML(item.rate)}" /></label>
      <label class="switch-label line-item__gst"><span>GST</span><input data-line-field="gstApplies" type="checkbox" ${item.gstApplies ? 'checked' : ''} ${state.settings.gstRegistered ? '' : 'disabled'} /></label>
      <button class="icon-button" data-remove-line="${escapeHTML(item.id)}" type="button" aria-label="Remove line item ${index + 1}">×</button>
    </div>
  `).join('');

  $$('[data-remove-line]').forEach((button) => button.addEventListener('click', () => removeLineItem(button.dataset.removeLine)));
}

function renderTotalsEditor() {
  const totals = calculateInvoiceTotals(state.currentInvoice, state.settings);
  $('#totals-editor').innerHTML = `
    <div><span>Subtotal</span><strong>${totals.subtotalFormatted}</strong></div>
    <div><span>GST</span><strong>${totals.gstFormatted}</strong></div>
    <div class="totals-card__total"><span>Total payable</span><strong>${totals.totalFormatted}</strong></div>
    <small>${state.settings.gstRegistered ? `GST mode: rates ${state.settings.gstMode === 'inclusive' ? 'include' : 'exclude'} GST.` : 'GST disabled because business is marked as not GST registered.'}</small>
  `;
}

function updateInvoiceFromForm(event) {
  const invoice = state.currentInvoice;
  if (!invoice) return;

  invoice.invoiceNumber = getValue('invoice-number');
  invoice.status = getValue('invoice-status');
  invoice.invoiceDate = getValue('invoice-date');
  invoice.dueDate = getValue('due-date');
  invoice.reference = getValue('invoice-reference');
  invoice.notes = getValue('invoice-notes');
  invoice.client = {
    ...(invoice.client || {}),
    id: getValue('client-select'),
    name: getValue('client-name'),
    email: getValue('client-email'),
    address: getValue('client-address'),
    abn: normaliseABN(getValue('client-abn'))
  };

  const lineElement = event?.target?.closest?.('[data-line-id]');
  if (lineElement) {
    const line = invoice.lineItems.find((item) => item.id === lineElement.dataset.lineId);
    const field = event.target.dataset.lineField;
    if (line && field) line[field] = field === 'gstApplies' ? event.target.checked : event.target.value;
  }

  invoice.updatedAt = new Date().toISOString();
  renderTotalsEditor();
  renderPreview();
  $('#invoice-status-pill').textContent = statusLabel(invoiceDisplayStatus(invoice, todayISO()));
}

function addLineItem() {
  state.currentInvoice.lineItems.push(createLineItem());
  renderLineItems();
  renderTotalsEditor();
  renderPreview();
}

function removeLineItem(lineId) {
  if (state.currentInvoice.lineItems.length === 1) {
    toast('At least one line item is required.');
    return;
  }
  state.currentInvoice.lineItems = state.currentInvoice.lineItems.filter((item) => item.id !== lineId);
  renderLineItems();
  renderTotalsEditor();
  renderPreview();
}

async function resetCurrentInvoice() {
  state.currentInvoice = await newInvoiceDraft();
  renderBuilder();
  toast('Invoice reset.');
}

function applySelectedClient() {
  const clientId = getValue('client-select');
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) return;
  state.currentInvoice.client = { ...client };
  fillInvoiceForm();
  renderPreview();
}

async function saveCurrentClient() {
  updateInvoiceFromForm();
  const client = state.currentInvoice.client;
  if (!client.name.trim()) {
    toast('Client name is required before saving a client.');
    return;
  }

  const savedClient = {
    id: client.id || uid('client'),
    name: client.name.trim(),
    email: client.email.trim(),
    address: client.address.trim(),
    abn: normaliseABN(client.abn),
    updatedAt: new Date().toISOString()
  };

  await put('clients', savedClient);
  state.clients = await getAll('clients');
  state.currentInvoice.client = { ...savedClient };
  populateClientSelect();
  setValue('client-select', savedClient.id);
  renderClients();
  renderDashboard();
  toast('Client saved.');
}

async function saveInvoice(event) {
  event?.preventDefault?.();
  updateInvoiceFromForm();

  const totals = calculateInvoiceTotals(state.currentInvoice, state.settings);
  const invoice = {
    ...state.currentInvoice,
    id: state.currentInvoice.id || uid('invoice'),
    subtotal: roundCurrency(totals.subtotal),
    gst: roundCurrency(totals.gst),
    total: roundCurrency(totals.total),
    createdAt: state.currentInvoice.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!invoice.invoiceNumber.trim()) return toast('Invoice number is required.');
  if (!invoice.client.name.trim()) return toast('Client name is required.');
  if (!invoice.lineItems.some((line) => String(line.description || '').trim())) return toast('At least one line item description is required.');

  await put('invoices', invoice);
  await maybeAdvanceInvoiceSequence(invoice.invoiceNumber);
  state.currentInvoice = invoice;
  state.invoices = await getAll('invoices');
  state.invoices.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  renderDashboard();
  renderInvoices();
  renderBuilder();
  toast('Invoice saved locally.');
}

async function maybeAdvanceInvoiceSequence(invoiceNumber) {
  const match = String(invoiceNumber || '').match(/-(\d{4})$/);
  if (!match) return;
  const usedNumber = Number(match[1]);
  const meta = await get('meta', META_SEQUENCE_ID);
  const current = meta?.value || 1;
  if (usedNumber >= current) await put('meta', { id: META_SEQUENCE_ID, value: usedNumber + 1 });
}

function renderPreview() {
  const invoice = state.currentInvoice;
  const settings = state.settings;
  const totals = calculateInvoiceTotals(invoice, settings);
  const title = settings.gstRegistered ? 'Tax Invoice' : 'Invoice';

  $('#invoice-preview').innerHTML = `
    <header class="invoice-preview__header">
      <div>
        <p class="invoice-preview__title">${title}</p>
        <h2>${escapeHTML(settings.businessName || 'Your Business Name')}</h2>
        <p>${settings.abn ? `ABN ${escapeHTML(formatABN(settings.abn))}` : 'ABN not entered'}</p>
        <p>${escapeHTML(settings.address || '')}</p>
        <p>${escapeHTML([settings.email, settings.phone].filter(Boolean).join(' • '))}</p>
      </div>
      <div class="invoice-preview__meta">
        <p><span>Invoice No.</span><strong>${escapeHTML(invoice.invoiceNumber || '—')}</strong></p>
        <p><span>Invoice Date</span><strong>${formatDate(invoice.invoiceDate)}</strong></p>
        <p><span>Due Date</span><strong>${formatDate(invoice.dueDate)}</strong></p>
        ${invoice.reference ? `<p><span>Reference</span><strong>${escapeHTML(invoice.reference)}</strong></p>` : ''}
      </div>
    </header>

    <section class="invoice-preview__parties">
      <div>
        <span>Bill to</span>
        <strong>${escapeHTML(invoice.client?.name || 'Client name')}</strong>
        <p>${escapeHTML(invoice.client?.address || '')}</p>
        <p>${escapeHTML(invoice.client?.email || '')}</p>
        ${invoice.client?.abn ? `<p>ABN ${escapeHTML(formatABN(invoice.client.abn))}</p>` : ''}
      </div>
      <div><span>Status</span><strong>${statusLabel(invoiceDisplayStatus(invoice, todayISO()))}</strong></div>
    </section>

    <table class="invoice-table">
      <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>GST</th><th>Total</th></tr></thead>
      <tbody>
        ${invoice.lineItems.map((item, index) => {
          const row = totals.rows[index];
          return `<tr><td>${escapeHTML(item.description || 'Service / item')}</td><td>${formatNumber(row.quantity)}</td><td>${formatCurrency(row.rate)}</td><td>${settings.gstRegistered && item.gstApplies ? formatCurrency(row.gst) : '—'}</td><td>${formatCurrency(row.total)}</td></tr>`;
        }).join('')}
      </tbody>
    </table>

    <section class="invoice-preview__summary">
      <div class="payment-box">
        <span>Payment details</span>
        <p>${escapeHTML(settings.bankName || '')}</p>
        <p>BSB: ${escapeHTML(formatBSB(settings.bankBsb) || '—')}</p>
        <p>Account: ${escapeHTML(settings.bankAccountNumber || '—')}</p>
        <p>Account name: ${escapeHTML(settings.bankAccountName || settings.businessName || '—')}</p>
      </div>
      <div class="summary-box">
        <p><span>Subtotal</span><strong>${totals.subtotalFormatted}</strong></p>
        <p><span>GST</span><strong>${totals.gstFormatted}</strong></p>
        <p class="summary-box__total"><span>Total payable</span><strong>${totals.totalFormatted}</strong></p>
      </div>
    </section>

    <footer class="invoice-preview__footer">
      <strong>Notes</strong>
      <p>${escapeHTML(invoice.notes || 'Thank you for your business.')}</p>
      ${settings.gstRegistered ? `<small>GST has been calculated at 10%. Rates are ${settings.gstMode === 'inclusive' ? 'GST inclusive' : 'GST exclusive'}.</small>` : `<small>No GST has been charged.</small>`}
    </footer>
  `;
}

function renderInvoices() {
  const list = $('#invoice-list');
  let invoices = state.invoices.slice();

  if (state.invoiceFilter !== 'all') invoices = invoices.filter((invoice) => invoiceDisplayStatus(invoice, todayISO()) === state.invoiceFilter);
  if (state.invoiceSearch) {
    invoices = invoices.filter((invoice) => [invoice.invoiceNumber, invoice.client?.name, invoice.client?.email, invoice.total].join(' ').toLowerCase().includes(state.invoiceSearch));
  }

  list.innerHTML = invoices.length ? invoices.map(invoiceRow).join('') : emptyState('No matching invoices', 'Create an invoice or adjust the filter.');
  $$('[data-edit-invoice]').forEach((button) => button.addEventListener('click', () => editInvoice(button.dataset.editInvoice)));
  $$('[data-delete-invoice]').forEach((button) => button.addEventListener('click', () => deleteInvoice(button.dataset.deleteInvoice)));
  $$('[data-mark-paid]').forEach((button) => button.addEventListener('click', () => markInvoicePaid(button.dataset.markPaid)));
}

function invoiceRow(invoice) {
  const displayStatus = invoiceDisplayStatus(invoice, todayISO());
  return `
    <article class="table-row">
      <div><strong>${escapeHTML(invoice.invoiceNumber)}</strong><span>${escapeHTML(invoice.client?.name || 'No client')}</span></div>
      <div><span>Date</span><strong>${formatDate(invoice.invoiceDate)}</strong></div>
      <div><span>Due</span><strong>${formatDate(invoice.dueDate)}</strong></div>
      <div><span>Total</span><strong>${formatCurrency(invoice.total)}</strong></div>
      <div><span class="status-pill status-pill--${displayStatus}">${statusLabel(displayStatus)}</span></div>
      <div class="row-actions"><button class="button button--secondary" data-edit-invoice="${escapeHTML(invoice.id)}" type="button">Edit</button>${invoice.status !== 'paid' ? `<button class="button button--secondary" data-mark-paid="${escapeHTML(invoice.id)}" type="button">Mark paid</button>` : ''}<button class="button button--ghost" data-delete-invoice="${escapeHTML(invoice.id)}" type="button">Delete</button></div>
    </article>
  `;
}

function editInvoice(invoiceId) {
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  if (!invoice) return;
  state.currentInvoice = structuredCloneSafe(invoice);
  setView('builder');
  renderBuilder();
}

async function markInvoicePaid(invoiceId) {
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  if (!invoice) return;
  invoice.status = 'paid';
  invoice.paidAt = new Date().toISOString();
  invoice.updatedAt = new Date().toISOString();
  await put('invoices', invoice);
  state.invoices = await getAll('invoices');
  renderInvoices();
  renderDashboard();
  toast('Invoice marked as paid.');
}

async function deleteInvoice(invoiceId) {
  if (!confirm('Delete this invoice from local storage?')) return;
  await remove('invoices', invoiceId);
  state.invoices = await getAll('invoices');
  renderInvoices();
  renderDashboard();
  toast('Invoice deleted.');
}

function renderClients() {
  const list = $('#client-list');
  const clients = state.clients.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  list.innerHTML = clients.length ? clients.map((client) => `
    <article class="table-row table-row--client">
      <div><strong>${escapeHTML(client.name || 'Unnamed client')}</strong><span>${escapeHTML(client.email || '')}</span></div>
      <div><span>ABN</span><strong>${client.abn ? formatABN(client.abn) : '—'}</strong></div>
      <div><span>Address</span><strong>${escapeHTML(client.address || '—')}</strong></div>
      <div class="row-actions"><button class="button button--secondary" data-use-client="${escapeHTML(client.id)}" type="button">Use</button><button class="button button--ghost" data-delete-client="${escapeHTML(client.id)}" type="button">Delete</button></div>
    </article>
  `).join('') : emptyState('No clients saved', 'Save a client from the invoice builder.');

  $$('[data-use-client]').forEach((button) => button.addEventListener('click', () => useClient(button.dataset.useClient)));
  $$('[data-delete-client]').forEach((button) => button.addEventListener('click', () => deleteClient(button.dataset.deleteClient)));
}

function useClient(clientId) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) return;
  state.currentInvoice.client = { ...client };
  setView('builder');
  renderBuilder();
}

async function deleteClient(clientId) {
  if (!confirm('Delete this client from local storage? Existing invoices will keep their saved client details.')) return;
  await remove('clients', clientId);
  state.clients = await getAll('clients');
  renderClients();
  renderBuilder();
  renderDashboard();
  toast('Client deleted.');
}

function renderSettings() {
  setValue('business-name', state.settings.businessName);
  setValue('business-abn', formatABN(state.settings.abn));
  setValue('business-email', state.settings.email);
  setValue('business-phone', state.settings.phone);
  setValue('business-address', state.settings.address);
  $('#gst-registered').checked = Boolean(state.settings.gstRegistered);
  setValue('gst-mode', state.settings.gstMode);
  setValue('payment-terms-days', String(state.settings.paymentTermsDays));
  setValue('invoice-prefix', state.settings.invoicePrefix || 'INV');
  setValue('bank-name', state.settings.bankName);
  setValue('bank-bsb', formatBSB(state.settings.bankBsb));
  setValue('bank-account-number', state.settings.bankAccountNumber);
  setValue('bank-account-name', state.settings.bankAccountName);
  setValue('default-notes', state.settings.defaultNotes);
  renderABNHelp();
}

function handleSettingsPreview(event) {
  if (event.target.id === 'business-abn') {
    event.target.value = formatABN(event.target.value);
    renderABNHelp();
  }
  if (event.target.id === 'bank-bsb') event.target.value = formatBSB(event.target.value);
}

async function saveSettings(event) {
  event.preventDefault();
  const settings = {
    id: 'business',
    businessName: getValue('business-name').trim(),
    abn: normaliseABN(getValue('business-abn')),
    email: getValue('business-email').trim(),
    phone: getValue('business-phone').trim(),
    address: getValue('business-address').trim(),
    gstRegistered: $('#gst-registered').checked,
    gstMode: getValue('gst-mode'),
    paymentTermsDays: Number(getValue('payment-terms-days')) || 7,
    invoicePrefix: getValue('invoice-prefix').trim().toUpperCase() || 'INV',
    bankName: getValue('bank-name').trim(),
    bankBsb: formatBSB(getValue('bank-bsb')),
    bankAccountNumber: getValue('bank-account-number').trim(),
    bankAccountName: getValue('bank-account-name').trim(),
    defaultNotes: getValue('default-notes').trim(),
    updatedAt: new Date().toISOString()
  };

  await put('settings', settings);
  state.settings = settings;
  renderSettings();
  renderBuilder();
  renderDashboard();
  toast('Settings saved locally.');
}

function renderABNHelp() {
  const help = $('#business-abn-help');
  const abn = normaliseABN(getValue('business-abn'));
  if (!abn) {
    help.textContent = 'Enter your 11-digit Australian Business Number.';
    help.className = 'field-help';
    return;
  }
  const result = validateABN(abn);
  help.textContent = result.reason;
  help.className = `field-help ${result.valid ? 'field-help--success' : 'field-help--warning'}`;
}

async function exportBackup() {
  const backup = await exportAll();
  downloadJSON(`invoicemate-backup-${todayISO()}.json`, backup);
  toast('Backup exported.');
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    await importAll(backup);
    await loadState();
    state.currentInvoice = await newInvoiceDraft();
    renderAll();
    toast('Backup imported.');
  } catch (error) {
    console.error(error);
    toast('Backup import failed.');
  } finally {
    event.target.value = '';
  }
}

async function clearLocalData() {
  if (!confirm('This will delete all local InvoiceMate data from this browser. Export a backup first if needed. Continue?')) return;
  await clearAll();
  state.settings = { ...DEFAULT_SETTINGS };
  state.clients = [];
  state.invoices = [];
  state.currentInvoice = await newInvoiceDraft();
  renderAll();
  toast('Local data cleared.');
}

function printCurrentInvoice() {
  if (state.view !== 'builder') {
    setView('builder');
    renderBuilder();
  }
  window.print();
}

function emptyState(title, body) {
  return `<div class="empty-state"><strong>${escapeHTML(title)}</strong><span>${escapeHTML(body)}</span></div>`;
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value ?? '';
}

function getValue(id) {
  return document.getElementById(id)?.value ?? '';
}

function roundCurrency(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function structuredCloneSafe(value) {
  if (window.structuredClone) return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('is-visible');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => element.classList.remove('is-visible'), 2600);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js?v=0.1.4').catch((error) => {
      console.info('Service worker registration skipped:', error);
    });
  });
}
