/*
 * InvoiceMate Liquid Glass App Logic
 *
 * Handles state management, navigation, invoice creation, client management,
 * business profile persistence, and appearance customisation. Data is stored
 * in localStorage to remain local to the device. GST calculations assume a
 * 10% tax rate common in Australia. Invoice numbers are generated based on
 * the current year and a running counter.
 */

// Data storage keys
const STORAGE_KEYS = {
  settings: 'invoicemate_settings',
  clients: 'invoicemate_clients',
  invoices: 'invoicemate_invoices',
  counter: 'invoicemate_counter'
};

// Default settings
const defaultSettings = {
  businessName: '',
  abn: '',
  address: '',
  email: '',
  phone: '',
  bsb: '',
  account: '',
  gstRegistered: true,
  accent: '#007aff',
  accentRgb: '0,122,255',
  glassStrength: 'balanced' // clear, balanced, frosted
};

// Load state from storage or fallback
let settings = loadObject(STORAGE_KEYS.settings, defaultSettings);
let clients = loadObject(STORAGE_KEYS.clients, []);
let invoices = loadObject(STORAGE_KEYS.invoices, []);
let invoiceCounter = parseInt(localStorage.getItem(STORAGE_KEYS.counter) || '0', 10);

// Helper to load JSON objects with default
function loadObject(key, defaultValue) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (err) {
    console.error(err);
    return defaultValue;
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

function saveClients() {
  localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(clients));
}

function saveInvoices() {
  localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify(invoices));
}

function saveCounter() {
  localStorage.setItem(STORAGE_KEYS.counter, String(invoiceCounter));
}

// Format currency in AUD
function formatCurrency(value) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
}

// Compute totals for invoice items
function computeTotals(items) {
  let subtotal = 0;
  items.forEach(item => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    subtotal += qty * rate;
  });
  // GST registered: 10%
  const gst = settings.gstRegistered ? subtotal * 0.1 : 0;
  const total = subtotal + gst;
  return { subtotal, gst, total };
}

// Generate invoice number like INV-2026-0001
function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  invoiceCounter += 1;
  saveCounter();
  return `INV-${year}-${String(invoiceCounter).padStart(4, '0')}`;
}

// Navigation
const tabButtons = document.querySelectorAll('.tab-button');
const sections = document.querySelectorAll('.section');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    if (target) {
      showSection(target);
    }
  });
});

function showSection(id) {
  sections.forEach(section => {
    section.classList.toggle('active', section.id === id);
  });
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === id);
  });
  if (id === 'home-section') {
    updateSummary();
  }
  if (id === 'invoices-section') {
    renderInvoiceList();
  }
  if (id === 'clients-section') {
    renderClientList();
  }

  // Update scroll edge effect for the current section
  sections.forEach(section => {
    const header = section.querySelector('.page-header');
    if (!header) return;
    if (section.id === id) {
      // Add scroll listener to update header shadow when scrolling
      section.addEventListener('scroll', handleScrollEdge);
      // Immediately set the initial state
      handleScrollEdge.call(section);
    } else {
      section.removeEventListener('scroll', handleScrollEdge);
      header.classList.remove('scrolled');
    }
  });
}

// Scroll edge handler: toggles a 'scrolled' class on the page header when
// the section content is scrolled beyond the top. This provides a subtle
// separation between floating navigation bars and content.
function handleScrollEdge() {
  const header = this.querySelector('.page-header');
  if (!header) return;
  if (this.scrollTop > 1) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
}

// Summary update
function updateSummary() {
  const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const unpaid = invoices.filter(inv => inv.status === 'unpaid').reduce((sum, inv) => sum + inv.total, 0);
  const overdue = invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.total, 0);
  document.getElementById('summary-total-value').textContent = formatCurrency(total);
  document.getElementById('summary-unpaid-value').textContent = formatCurrency(unpaid);
  document.getElementById('summary-overdue-value').textContent = formatCurrency(overdue);
  // Recent invoices (show last 5)
  const recentUl = document.getElementById('recent-invoices');
  recentUl.innerHTML = '';
  const recent = invoices.slice(-5).reverse();
  recent.forEach(inv => {
    const li = document.createElement('li');
    li.textContent = `${inv.number} • ${inv.clientName} • ${formatCurrency(inv.total)}`;
    recentUl.appendChild(li);
  });
}

// Render invoice list
function renderInvoiceList() {
  const list = document.getElementById('invoice-list');
  list.innerHTML = '';
  invoices.forEach(inv => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.innerHTML = `<h3>${inv.number}</h3><p>${inv.clientName}</p>`;
    const right = document.createElement('div');
    right.innerHTML = `<p>${formatCurrency(inv.total)}</p>`;
    li.appendChild(left);
    li.appendChild(right);
    list.appendChild(li);
  });
}

// Render client list
function renderClientList() {
  const list = document.getElementById('client-list');
  list.innerHTML = '';
  clients.forEach(client => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.innerHTML = `<h3>${client.name}</h3><p>${client.email || ''}</p>`;
    const right = document.createElement('div');
    right.innerHTML = '';
    li.appendChild(left);
    li.appendChild(right);
    list.appendChild(li);
  });
}

// Invoice editor logic
const invoiceEditor = document.getElementById('invoice-editor');
const invoiceForm = document.getElementById('invoice-form');
const lineItemsContainer = document.getElementById('line-items');
const subtotalEl = document.getElementById('subtotal-value');
const gstEl = document.getElementById('gst-value');
const totalEl = document.getElementById('total-value');
const invoiceClientSelect = document.getElementById('invoice-client');

document.getElementById('new-invoice-btn').addEventListener('click', () => openInvoiceEditor());
document.getElementById('add-invoice-btn').addEventListener('click', () => openInvoiceEditor());
document.getElementById('close-editor').addEventListener('click', () => closeInvoiceEditor());
document.getElementById('add-line-item').addEventListener('click', () => addLineItem());

function openInvoiceEditor(editInvoice) {
  invoiceForm.reset();
  lineItemsContainer.innerHTML = '';
  // populate client options
  invoiceClientSelect.innerHTML = '';
  clients.forEach((client, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = client.name;
    invoiceClientSelect.appendChild(option);
  });
  if (clients.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No clients available';
    invoiceClientSelect.appendChild(opt);
  }
  // Set default dates
  const now = new Date().toISOString().split('T')[0];
  document.getElementById('invoice-date').value = now;
  const due = new Date();
  due.setDate(due.getDate() + 14);
  document.getElementById('invoice-due').value = due.toISOString().split('T')[0];
  // Add one default line item
  addLineItem();
  updateTotals();
  invoiceEditor.classList.remove('hidden');
}

function closeInvoiceEditor() {
  invoiceEditor.classList.add('hidden');
}

function addLineItem(item = { description: '', quantity: 1, rate: 0 }) {
  const row = document.createElement('div');
  row.className = 'line-item-row';
  row.style.display = 'flex';
  row.style.gap = '0.5rem';
  row.style.marginBottom = '0.5rem';
  // Description
  const desc = document.createElement('input');
  desc.type = 'text';
  desc.placeholder = 'Description';
  desc.value = item.description;
  desc.style.flex = '2';
  // Quantity
  const qty = document.createElement('input');
  qty.type = 'number';
  qty.min = '0';
  qty.step = '1';
  qty.value = item.quantity;
  qty.style.flex = '0.8';
  // Rate
  const rate = document.createElement('input');
  rate.type = 'number';
  rate.min = '0';
  rate.step = '0.01';
  rate.value = item.rate;
  rate.style.flex = '1';
  // Remove
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '×';
  removeBtn.className = 'icon-btn';
  removeBtn.style.flex = '0 0 auto';
  removeBtn.addEventListener('click', () => {
    row.remove();
    updateTotals();
  });
  [desc, qty, rate].forEach(input => {
    input.addEventListener('input', () => updateTotals());
  });
  row.appendChild(desc);
  row.appendChild(qty);
  row.appendChild(rate);
  row.appendChild(removeBtn);
  lineItemsContainer.appendChild(row);
  updateTotals();
}

// Update totals display
function updateTotals() {
  const items = [];
  lineItemsContainer.querySelectorAll('.line-item-row').forEach(row => {
    const [desc, qty, rate] = row.querySelectorAll('input');
    items.push({
      description: desc.value,
      quantity: parseFloat(qty.value) || 0,
      rate: parseFloat(rate.value) || 0
    });
  });
  const { subtotal, gst, total } = computeTotals(items);
  subtotalEl.textContent = formatCurrency(subtotal);
  gstEl.textContent = formatCurrency(gst);
  totalEl.textContent = formatCurrency(total);
}

// Submit invoice
invoiceForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const clientIndex = invoiceClientSelect.value;
  if (clientIndex === '' || !clients[clientIndex]) {
    alert('Please select a client');
    return;
  }
  const items = [];
  lineItemsContainer.querySelectorAll('.line-item-row').forEach(row => {
    const [desc, qty, rate] = row.querySelectorAll('input');
    if (!desc.value.trim()) return;
    items.push({
      description: desc.value,
      quantity: parseFloat(qty.value) || 0,
      rate: parseFloat(rate.value) || 0
    });
  });
  if (items.length === 0) {
    alert('Please add at least one line item');
    return;
  }
  const totals = computeTotals(items);
  const invoice = {
    number: generateInvoiceNumber(),
    clientName: clients[clientIndex].name,
    clientId: clientIndex,
    date: document.getElementById('invoice-date').value,
    due: document.getElementById('invoice-due').value,
    items,
    subtotal: totals.subtotal,
    gst: totals.gst,
  total: totals.total,
    status: 'unpaid'
  };
  invoices.push(invoice);
  saveInvoices();
  updateSummary();
  closeInvoiceEditor();
  // Switch to invoices section
  showSection('invoices-section');
  renderInvoiceList();
});

// Client editor logic
const clientEditor = document.getElementById('client-editor');
const clientForm = document.getElementById('client-form');

document.getElementById('add-client-btn').addEventListener('click', () => openClientEditor());
document.getElementById('close-client-editor').addEventListener('click', () => closeClientEditor());

function openClientEditor() {
  clientForm.reset();
  clientEditor.classList.remove('hidden');
}
function closeClientEditor() {
  clientEditor.classList.add('hidden');
}

clientForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('client-name').value.trim();
  if (!name) {
    alert('Please enter a client name');
    return;
  }
  const email = document.getElementById('client-email').value;
  const phone = document.getElementById('client-phone').value;
  const abn = document.getElementById('client-abn').value;
  const address = document.getElementById('client-address').value;
  clients.push({ name, email, phone, abn, address });
  saveClients();
  closeClientEditor();
  renderClientList();
});

// Business profile form logic
const businessForm = document.getElementById('business-form');

function populateBusinessForm() {
  document.getElementById('business-name').value = settings.businessName;
  document.getElementById('business-abn').value = settings.abn;
  document.getElementById('business-address').value = settings.address;
  document.getElementById('business-email').value = settings.email;
  document.getElementById('business-phone').value = settings.phone;
  document.getElementById('business-bsb').value = settings.bsb;
  document.getElementById('business-account').value = settings.account;
  document.getElementById('gst-registered').checked = settings.gstRegistered;
}

function attachBusinessFormListeners() {
  businessForm.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
      switch (input.id) {
        case 'business-name': settings.businessName = input.value; break;
        case 'business-abn': settings.abn = input.value; break;
        case 'business-address': settings.address = input.value; break;
        case 'business-email': settings.email = input.value; break;
        case 'business-phone': settings.phone = input.value; break;
        case 'business-bsb': settings.bsb = input.value; break;
        case 'business-account': settings.account = input.value; break;
        case 'gst-registered': settings.gstRegistered = input.checked; break;
      }
      saveSettings();
    });
  });
  document.getElementById('gst-registered').addEventListener('change', (e) => {
    settings.gstRegistered = e.target.checked;
    saveSettings();
  });
}

// Theme customisation
const accentSwatchContainer = document.getElementById('accent-options');
const glassSwatchContainer = document.getElementById('glass-options');

const ACCENTS = [
  { name: 'Blue', color: '#007aff', rgb: '0,122,255' },
  { name: 'Green', color: '#30d158', rgb: '48,209,88' },
  { name: 'Purple', color: '#af52de', rgb: '175,82,222' },
  { name: 'Orange', color: '#ff9500', rgb: '255,149,0' },
  { name: 'Red', color: '#ff3b30', rgb: '255,59,48' },
  { name: 'Teal', color: '#59aadf', rgb: '89,170,223' }
];

const GLASS = [
  { name: 'Clear', value: 'clear', blur: '10px', opacity: 0.3 },
  { name: 'Balanced', value: 'balanced', blur: '20px', opacity: 0.6 },
  { name: 'Frosted', value: 'frosted', blur: '30px', opacity: 0.8 }
];

function renderAppearanceOptions() {
  accentSwatchContainer.innerHTML = '';
  ACCENTS.forEach(acc => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.backgroundColor = acc.color;
    if (acc.color.toLowerCase() === settings.accent.toLowerCase()) sw.classList.add('selected');
    sw.title = acc.name;
    sw.addEventListener('click', () => {
      settings.accent = acc.color;
      settings.accentRgb = acc.rgb;
      saveSettings();
      applyTheme();
      renderAppearanceOptions();
    });
    accentSwatchContainer.appendChild(sw);
  });
  glassSwatchContainer.innerHTML = '';
  GLASS.forEach(gl => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.backgroundColor = `rgba(255, 255, 255, ${gl.opacity})`;
    sw.style.backdropFilter = `blur(${gl.blur})`;
    if (gl.value === settings.glassStrength) sw.classList.add('selected');
    sw.title = gl.name;
    sw.addEventListener('click', () => {
      settings.glassStrength = gl.value;
      saveSettings();
      applyTheme();
      renderAppearanceOptions();
    });
    glassSwatchContainer.appendChild(sw);
  });
}

function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty('--accent-color', settings.accent);
  root.style.setProperty('--accent-color-rgb', settings.accentRgb);
  // adjust glass properties
  let glassOpacity = 0.6;
  let blur = '20px';
  switch (settings.glassStrength) {
    case 'clear': glassOpacity = 0.3; blur = '10px'; break;
    case 'frosted': glassOpacity = 0.8; blur = '30px'; break;
    case 'balanced': default: glassOpacity = 0.6; blur = '20px'; break;
  }
  root.style.setProperty('--glass-color-light', `rgba(255, 255, 255, ${glassOpacity})`);
  root.style.setProperty('--glass-color-dark', `rgba(28, 28, 30, ${glassOpacity})`);
  root.style.setProperty('--glass-blur', blur);
}

// Initialise app
function init() {
  populateBusinessForm();
  attachBusinessFormListeners();
  renderAppearanceOptions();
  applyTheme();
  updateSummary();
  renderInvoiceList();
  renderClientList();
  // Set initial active tab
  showSection('home-section');
}

// Wait for DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  init();
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
  }
});