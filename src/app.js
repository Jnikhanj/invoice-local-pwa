(() => {
  const STORAGE_KEY = "invoicemate.liquid.v040";
  const GST_RATE = 0.10;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const defaultState = {
    settings: {
      businessName: "",
      abn: "",
      email: "",
      phone: "",
      address: "",
      gstRegistered: true,
      gstMode: "exclusive",
      paymentTerms: 7,
      invoicePrefix: "INV",
      bankName: "",
      bankBsb: "",
      bankAccountNumber: "",
      bankAccountName: "",
      defaultNotes: "Payment is due by the due date. Please include the invoice number as the payment reference."
    },
    style: {
      liquid: "medium",
      tint: "aqua",
      template: "classic"
    },
    clients: [],
    invoices: [],
    meta: { sequence: 1 }
  };

  let state = loadState();
  let route = "dashboard";
  let activeStep = "items";
  let filter = "all";
  let search = "";
  let draft = newDraft();

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    applyStyle();
    bindEvents();
    fillSettingsForm();
    hydrateDraft();
    renderAll();
    registerServiceWorker();
  }

  function bindEvents() {
    document.body.addEventListener("click", (event) => {
      const routeBtn = event.target.closest("[data-route]");
      if (routeBtn) showRoute(routeBtn.dataset.route);

      if (event.target.closest("[data-new-invoice]")) {
        draft = newDraft();
        hydrateDraft();
        showRoute("create");
        showStep("client");
      }

      if (event.target.closest("[data-reset-draft]")) {
        draft = newDraft();
        hydrateDraft();
        showToast("Draft reset.");
      }

      const stepBtn = event.target.closest("[data-step]");
      if (stepBtn) showStep(stepBtn.dataset.step);

      const filterBtn = event.target.closest("[data-filter]");
      if (filterBtn) {
        filter = filterBtn.dataset.filter;
        $$("[data-filter]").forEach(btn => btn.classList.toggle("is-active", btn === filterBtn));
        renderLedger();
      }

      const tintBtn = event.target.closest("[data-tint-choice]");
      if (tintBtn) {
        state.style.tint = tintBtn.dataset.tintChoice;
        saveState();
        applyStyle();
        renderStyle();
        renderPreview();
      }

      const templateBtn = event.target.closest("[data-template-choice]");
      if (templateBtn) {
        state.style.template = templateBtn.dataset.templateChoice;
        saveState();
        applyStyle();
        renderStyle();
        renderPreview();
      }

      const editInvoice = event.target.closest("[data-edit-invoice]");
      if (editInvoice) {
        const invoice = state.invoices.find(item => item.id === editInvoice.dataset.editInvoice);
        if (invoice) {
          draft = clone(invoice);
          hydrateDraft();
          showRoute("create");
          showStep("review");
        }
      }

      const markPaid = event.target.closest("[data-mark-paid]");
      if (markPaid) markInvoicePaid(markPaid.dataset.markPaid);

      const deleteClient = event.target.closest("[data-delete-client]");
      if (deleteClient) deleteClientById(deleteClient.dataset.deleteClient);

      const useClient = event.target.closest("[data-use-client]");
      if (useClient) {
        const client = state.clients.find(item => item.id === useClient.dataset.useClient);
        if (client) {
          draft.client = clone(client);
          hydrateDraft();
          showRoute("create");
          showStep("items");
        }
      }

      if (event.target.closest("[data-print]")) window.print();
    });

    $("#invoiceForm").addEventListener("input", updateDraftFromForm);
    $("#invoiceForm").addEventListener("change", updateDraftFromForm);
    $("#settingsForm").addEventListener("input", handleSettingsInput);
    $("#settingsForm").addEventListener("change", handleSettingsInput);

    $("#clientSelect").addEventListener("change", applySelectedClient);
    $("#addLineBtn").addEventListener("click", addLineItem);
    $("#saveClientBtn").addEventListener("click", saveCurrentClient);
    $("#saveInvoiceBtn").addEventListener("click", saveInvoice);
    $("#saveSettingsBtn").addEventListener("click", saveSettings);

    $("#invoiceSearch").addEventListener("input", (event) => {
      search = event.target.value.trim().toLowerCase();
      renderLedger();
    });

    $("#glassRange").addEventListener("input", (event) => {
      state.style.liquid = ["clear", "medium", "frosted"][Number(event.target.value)] || "medium";
      saveState();
      applyStyle();
    });

    $("#exportBackupBtn").addEventListener("click", exportBackup);
    $("#importBackupInput").addEventListener("change", importBackup);
    $("#clearDataBtn").addEventListener("click", clearLocalData);

    window.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (route === "create") saveInvoice();
        if (route === "settings") saveSettings();
      }
    });
  }

  function showRoute(nextRoute) {
    route = nextRoute;
    document.body.dataset.route = nextRoute;
    $$(".screen").forEach(screen => screen.classList.toggle("is-active", screen.id === `screen-${nextRoute}`));

    $$(".tab-item").forEach(btn => {
      const active = btn.dataset.route === nextRoute || (nextRoute === "preview" && btn.dataset.route === "invoices");
      btn.classList.toggle("is-active", active);
    });

    if (nextRoute === "preview") renderPreview();
    if (nextRoute === "invoices") renderLedger();
    if (nextRoute === "clients") renderClients();
    if (nextRoute === "settings") fillSettingsForm();
    if (nextRoute === "style") renderStyle();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showStep(step) {
    activeStep = step;
    $$("[data-step]").forEach(btn => btn.classList.toggle("is-active", btn.dataset.step === step));
    $("#formClient").classList.toggle("is-active", step === "client");
    $("#formItems").classList.toggle("is-active", step === "items");
    $("#formReview").classList.toggle("is-active", step === "review");
  }

  function loadState() {
    try {
      return mergeDeep(clone(defaultState), JSON.parse(localStorage.getItem(STORAGE_KEY)) || {});
    } catch {
      return clone(defaultState);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function mergeDeep(base, incoming) {
    for (const key of Object.keys(incoming || {})) {
      if (incoming[key] && typeof incoming[key] === "object" && !Array.isArray(incoming[key])) {
        base[key] = mergeDeep(base[key] || {}, incoming[key]);
      } else {
        base[key] = incoming[key];
      }
    }
    return base;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function todayISO() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Melbourne",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function addDaysISO(dateString, days) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + Number(days || 0));
    return date.toISOString().slice(0, 10);
  }

  function newLine() {
    return { id: uid("line"), description: "", quantity: 1, rate: 0, gstApplies: true };
  }

  function newDraft() {
    const today = todayISO();
    return {
      id: null,
      invoiceNumber: `${state.settings.invoicePrefix || "INV"}-${today.slice(0, 4)}-${String(state.meta.sequence || 1).padStart(4, "0")}`,
      invoiceDate: today,
      dueDate: addDaysISO(today, state.settings.paymentTerms || 7),
      status: "draft",
      reference: "",
      client: { id: "", name: "", email: "", address: "", abn: "" },
      lineItems: [newLine()],
      notes: state.settings.defaultNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function hydrateDraft() {
    $("#invoiceNumber").value = draft.invoiceNumber || "";
    $("#invoiceStatus").value = draft.status || "draft";
    $("#invoiceDate").value = draft.invoiceDate || todayISO();
    $("#dueDate").value = draft.dueDate || todayISO();
    $("#invoiceReference").value = draft.reference || "";
    $("#invoiceNotes").value = draft.notes || "";

    $("#clientName").value = draft.client?.name || "";
    $("#clientEmail").value = draft.client?.email || "";
    $("#clientAddress").value = draft.client?.address || "";
    $("#clientAbn").value = formatABN(draft.client?.abn || "");
    populateClientSelect();
    $("#clientSelect").value = draft.client?.id || "";

    renderLineItems();
    renderDraft();
  }

  function updateDraftFromForm(event) {
    draft.invoiceNumber = $("#invoiceNumber").value.trim();
    draft.status = $("#invoiceStatus").value;
    draft.invoiceDate = $("#invoiceDate").value;
    draft.dueDate = $("#dueDate").value;
    draft.reference = $("#invoiceReference").value.trim();
    draft.notes = $("#invoiceNotes").value.trim();

    draft.client = {
      ...(draft.client || {}),
      id: $("#clientSelect").value,
      name: $("#clientName").value.trim(),
      email: $("#clientEmail").value.trim(),
      address: $("#clientAddress").value.trim(),
      abn: normaliseABN($("#clientAbn").value)
    };

    const row = event?.target?.closest?.("[data-line-id]");
    if (row) {
      const line = draft.lineItems.find(item => item.id === row.dataset.lineId);
      if (line) {
        line.description = row.querySelector("[data-field='description']").value;
        line.quantity = row.querySelector("[data-field='quantity']").value;
        line.rate = row.querySelector("[data-field='rate']").value;
        line.gstApplies = row.querySelector("[data-field='gstApplies']").checked;
      }
    }

    draft.updatedAt = new Date().toISOString();
    renderDraft();
  }

  function addLineItem() {
    updateDraftFromForm();
    draft.lineItems.push(newLine());
    renderLineItems();
    renderDraft();
  }

  function removeLineItem(id) {
    if (draft.lineItems.length <= 1) {
      showToast("At least one item is required.");
      return;
    }
    draft.lineItems = draft.lineItems.filter(item => item.id !== id);
    renderLineItems();
    renderDraft();
  }

  function renderLineItems() {
    $("#lineItems").innerHTML = draft.lineItems.map((line, index) => `
      <div class="line-item" data-line-id="${escapeHTML(line.id)}">
        <div class="line-item__top">
          <strong>Item ${index + 1}</strong>
          <button class="remove-line" type="button" data-remove="${escapeHTML(line.id)}">Remove</button>
        </div>
        <label class="line-field">
          <span>Description</span>
          <input data-field="description" value="${escapeHTML(line.description)}" placeholder="Service or item description" />
        </label>
        <div class="two-col">
          <label class="line-field">
            <span>Quantity</span>
            <input data-field="quantity" inputmode="decimal" value="${escapeHTML(line.quantity)}" />
          </label>
          <label class="line-field">
            <span>Rate</span>
            <input data-field="rate" inputmode="decimal" value="${escapeHTML(line.rate)}" />
          </label>
        </div>
        <label class="toggle-line">
          <span>GST applies</span>
          <input data-field="gstApplies" type="checkbox" ${line.gstApplies ? "checked" : ""} ${state.settings.gstRegistered ? "" : "disabled"} />
        </label>
      </div>
    `).join("");

    $$("[data-remove]").forEach(btn => btn.addEventListener("click", () => removeLineItem(btn.dataset.remove)));
  }

  function renderDraft() {
    const totals = calculateTotals(draft);
    $("#draftTotal").textContent = money(totals.total);
    $("#draftTaxSummary").textContent = `Subtotal ${money(totals.subtotal)} · GST ${money(totals.gst)}`;
  }

  function calculateTotals(invoice) {
    const rows = (invoice.lineItems || []).map(line => {
      const qty = parseAmount(line.quantity);
      const rate = parseAmount(line.rate);
      const amount = qty * rate;
      const taxable = state.settings.gstRegistered && line.gstApplies;
      if (!taxable) return { qty, rate, net: amount, gst: 0, total: amount };
      if (state.settings.gstMode === "inclusive") {
        const gst = amount / 11;
        return { qty, rate, net: amount - gst, gst, total: amount };
      }
      const gst = amount * GST_RATE;
      return { qty, rate, net: amount, gst, total: amount + gst };
    });

    const subtotal = rows.reduce((sum, row) => sum + row.net, 0);
    const gst = rows.reduce((sum, row) => sum + row.gst, 0);
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    return { rows, subtotal, gst, total };
  }

  function saveInvoice() {
    updateDraftFromForm();

    if (!draft.client.name) {
      showToast("Client name is required.");
      showStep("client");
      return;
    }
    if (!draft.invoiceNumber) {
      showToast("Invoice number is required.");
      showStep("review");
      return;
    }
    if (!draft.lineItems.some(item => String(item.description || "").trim())) {
      showToast("Add an item description.");
      showStep("items");
      return;
    }

    const totals = calculateTotals(draft);
    const invoice = {
      ...clone(draft),
      id: draft.id || uid("invoice"),
      subtotal: round(totals.subtotal),
      gst: round(totals.gst),
      total: round(totals.total),
      updatedAt: new Date().toISOString()
    };

    const existing = state.invoices.findIndex(item => item.id === invoice.id);
    if (existing >= 0) state.invoices[existing] = invoice;
    else state.invoices.unshift(invoice);

    advanceSequence(invoice.invoiceNumber);
    draft = clone(invoice);
    saveState();
    renderAll();
    showToast("Invoice saved locally.");
  }

  function advanceSequence(invoiceNumber) {
    const match = String(invoiceNumber || "").match(/-(\d{4})$/);
    if (!match) return;
    const used = Number(match[1]);
    if (used >= state.meta.sequence) state.meta.sequence = used + 1;
  }

  function markInvoicePaid(id) {
    const invoice = state.invoices.find(item => item.id === id);
    if (!invoice) return;
    invoice.status = "paid";
    invoice.paidAt = new Date().toISOString();
    invoice.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
    showToast("Marked paid.");
  }

  function populateClientSelect() {
    $("#clientSelect").innerHTML = [`<option value="">Manual entry</option>`].concat(
      state.clients.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(client =>
        `<option value="${escapeHTML(client.id)}">${escapeHTML(client.name)}</option>`
      )
    ).join("");
  }

  function applySelectedClient() {
    const client = state.clients.find(item => item.id === $("#clientSelect").value);
    if (!client) return;
    draft.client = clone(client);
    hydrateDraft();
  }

  function saveCurrentClient() {
    updateDraftFromForm();
    if (!draft.client.name) {
      showToast("Client name is required.");
      return;
    }
    const client = {
      id: draft.client.id || uid("client"),
      name: draft.client.name,
      email: draft.client.email,
      address: draft.client.address,
      abn: normaliseABN(draft.client.abn),
      updatedAt: new Date().toISOString()
    };

    const index = state.clients.findIndex(item => item.id === client.id);
    if (index >= 0) state.clients[index] = client;
    else state.clients.push(client);

    draft.client = clone(client);
    saveState();
    populateClientSelect();
    $("#clientSelect").value = client.id;
    renderClients();
    showToast("Client saved.");
  }

  function deleteClientById(id) {
    if (!confirm("Delete this client? Existing invoices keep their saved details.")) return;
    state.clients = state.clients.filter(item => item.id !== id);
    saveState();
    renderClients();
    populateClientSelect();
    showToast("Client deleted.");
  }

  function renderAll() {
    renderOverview();
    renderLedger();
    renderClients();
    renderStyle();
    renderPreview();
  }

  function renderOverview() {
    const today = todayISO();
    const open = state.invoices.filter(inv => inv.status !== "paid");
    const outstanding = open.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const paidMonth = state.invoices
      .filter(inv => inv.status === "paid" && String(inv.paidAt || inv.updatedAt || "").slice(0, 7) === today.slice(0, 7))
      .reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const drafts = state.invoices.filter(inv => inv.status === "draft").length;
    const dueSoon = state.invoices.filter(inv => inv.status !== "paid" && inv.dueDate && inv.dueDate >= today && inv.dueDate <= addDaysISO(today, 7)).length;

    $("#outstandingAmount").textContent = money(outstanding);
    $("#summaryStatus").textContent = outstanding > 0 ? "Open" : "Clear";
    $("#outstandingHelper").textContent = outstanding > 0 ? "Invoices awaiting payment" : "No unpaid invoices";
    $("#openInvoiceCount").textContent = `${open.length}`;
    $("#paidThisMonth").textContent = money(paidMonth);
    $("#draftCount").textContent = drafts;
    $("#dueSoonCount").textContent = dueSoon;

    const recent = state.invoices.slice(0, 4);
    $("#recentList").innerHTML = recent.length ? recent.map(invoiceRowCard).join("") : `<div class="empty-state">No invoices yet. Create one to begin.</div>`;
  }

  function renderLedger() {
    let invoices = state.invoices.slice();
    if (filter !== "all") invoices = invoices.filter(inv => displayStatus(inv) === filter);
    if (search) invoices = invoices.filter(inv => `${inv.invoiceNumber} ${inv.client?.name} ${inv.total}`.toLowerCase().includes(search));

    $("#invoiceRows").innerHTML = invoices.length ? invoices.map(invoiceLedgerRow).join("") : `
      <div class="empty-state">No invoices found. <button class="link-button" type="button" data-new-invoice>Create invoice</button></div>
    `;
  }

  function invoiceRowCard(invoice) {
    return `
      <div class="row-card">
        <button type="button" data-edit-invoice="${escapeHTML(invoice.id)}">
          <strong>${escapeHTML(invoice.invoiceNumber)}</strong>
          <span>${escapeHTML(invoice.client?.name || "No client")} · ${formatDate(invoice.dueDate)}</span>
        </button>
        <div class="row-end">
          <strong>${money(invoice.total)}</strong>
          <span>${statusLabel(displayStatus(invoice))}</span>
        </div>
      </div>
    `;
  }

  function invoiceLedgerRow(invoice) {
    const status = displayStatus(invoice);
    return `
      <div class="ledger-row">
        <button type="button" data-edit-invoice="${escapeHTML(invoice.id)}">
          <strong>${escapeHTML(invoice.invoiceNumber)}</strong>
          <span class="status-word">${statusLabel(status)}</span>
        </button>
        <button type="button" data-edit-invoice="${escapeHTML(invoice.id)}">
          <strong>${escapeHTML(invoice.client?.name || "No client")}</strong>
          <span>${formatDate(invoice.dueDate)}</span>
        </button>
        <div>
          <strong>${money(invoice.total)}</strong>
          <span>${invoice.status !== "paid" ? `<button class="link-button" type="button" data-mark-paid="${escapeHTML(invoice.id)}">Paid</button>` : "Paid"}</span>
        </div>
      </div>
    `;
  }

  function renderClients() {
    const clients = state.clients.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    $("#clientRows").innerHTML = clients.length ? clients.map(client => `
      <div class="row-card">
        <button type="button" data-use-client="${escapeHTML(client.id)}">
          <strong>${escapeHTML(client.name)}</strong>
          <span>${escapeHTML(client.email || "No email")} ${client.abn ? "· ABN " + formatABN(client.abn) : ""}</span>
        </button>
        <div class="row-end"><button class="link-button" type="button" data-delete-client="${escapeHTML(client.id)}">Delete</button></div>
      </div>
    `).join("") : `<div class="empty-state">No saved clients. Save a client from the invoice form.</div>`;
  }

  function renderPreview() {
    const inv = draft;
    const totals = calculateTotals(inv);
    const title = state.settings.gstRegistered ? "Tax Invoice" : "Invoice";
    const rows = inv.lineItems.map((item, index) => {
      const row = totals.rows[index];
      return `
        <tr>
          <td>${escapeHTML(item.description || "Service / item")}</td>
          <td>${item.gstApplies && state.settings.gstRegistered ? money(row.gst) : "—"}</td>
          <td>${money(row.total)}</td>
        </tr>
      `;
    }).join("");

    $("#templateName").textContent = templateLabel(state.style.template);

    $("#invoicePreview").innerHTML = `
      <header class="paper-header">
        <div>
          <p class="paper-title">${title}</p>
          <p class="paper-business">${escapeHTML(state.settings.businessName || "Your Business Name")}</p>
          <p class="paper-muted">${state.settings.abn ? "ABN " + formatABN(state.settings.abn) : "ABN not entered"}</p>
          <p class="paper-muted">${escapeHTML(state.settings.address || "")}</p>
          <p class="paper-muted">${escapeHTML([state.settings.email, state.settings.phone].filter(Boolean).join(" · "))}</p>
        </div>
        <div class="paper-meta">
          <strong>${escapeHTML(inv.invoiceNumber || "—")}</strong>
          <p class="paper-muted">${formatDate(inv.invoiceDate)}</p>
          <p class="paper-muted">Due ${formatDate(inv.dueDate)}</p>
          ${inv.reference ? `<p class="paper-muted">Ref ${escapeHTML(inv.reference)}</p>` : ""}
        </div>
      </header>
      <div class="paper-accent"></div>
      <section class="paper-bill">
        <p class="paper-label">Bill to</p>
        <p class="paper-business">${escapeHTML(inv.client?.name || "Client Name")}</p>
        <p class="paper-muted">${escapeHTML(inv.client?.address || "")}</p>
        <p class="paper-muted">${escapeHTML(inv.client?.email || "")}</p>
        ${inv.client?.abn ? `<p class="paper-muted">ABN ${formatABN(inv.client.abn)}</p>` : ""}
      </section>
      <table class="paper-table">
        <thead><tr><th>Description</th><th>GST</th><th>Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="paper-summary">
        <p><span>Subtotal</span><strong>${money(totals.subtotal)}</strong></p>
        <p><span>GST</span><strong>${money(totals.gst)}</strong></p>
        <p class="total"><span>Total</span><strong>${money(totals.total)}</strong></p>
      </section>
      <footer class="paper-footer">
        <p><strong>Payment:</strong> ${escapeHTML(state.settings.bankName || "")} BSB ${escapeHTML(formatBSB(state.settings.bankBsb) || "—")} · Account ${escapeHTML(state.settings.bankAccountNumber || "—")} · ${escapeHTML(state.settings.bankAccountName || state.settings.businessName || "—")}</p>
        <p>${escapeHTML(inv.notes || "")}</p>
      </footer>
    `;
  }

  function renderStyle() {
    $("#glassRange").value = { clear: 0, medium: 1, frosted: 2 }[state.style.liquid] ?? 1;
    $$("[data-tint-choice]").forEach(btn => btn.classList.toggle("is-active", btn.dataset.tintChoice === state.style.tint));
    $$("[data-template-choice]").forEach(btn => btn.classList.toggle("is-active", btn.dataset.templateChoice === state.style.template));
  }

  function applyStyle() {
    document.body.dataset.liquid = state.style.liquid;
    document.body.dataset.tint = state.style.tint;
    document.body.dataset.template = state.style.template;
  }

  function fillSettingsForm() {
    const s = state.settings;
    $("#businessName").value = s.businessName || "";
    $("#businessAbn").value = formatABN(s.abn || "");
    $("#businessEmail").value = s.email || "";
    $("#businessPhone").value = s.phone || "";
    $("#businessAddress").value = s.address || "";
    $("#gstRegistered").checked = !!s.gstRegistered;
    $("#gstMode").value = s.gstMode || "exclusive";
    $("#paymentTerms").value = String(s.paymentTerms || 7);
    $("#invoicePrefix").value = s.invoicePrefix || "INV";
    $("#bankName").value = s.bankName || "";
    $("#bankBsb").value = formatBSB(s.bankBsb || "");
    $("#bankAccountNumber").value = s.bankAccountNumber || "";
    $("#bankAccountName").value = s.bankAccountName || "";
    renderABNHelp();
  }

  function handleSettingsInput(event) {
    if (event.target.id === "businessAbn") {
      event.target.value = formatABN(event.target.value);
      renderABNHelp();
    }
    if (event.target.id === "bankBsb") {
      event.target.value = formatBSB(event.target.value);
    }
  }

  function saveSettings() {
    state.settings = {
      ...state.settings,
      businessName: $("#businessName").value.trim(),
      abn: normaliseABN($("#businessAbn").value),
      email: $("#businessEmail").value.trim(),
      phone: $("#businessPhone").value.trim(),
      address: $("#businessAddress").value.trim(),
      gstRegistered: $("#gstRegistered").checked,
      gstMode: $("#gstMode").value,
      paymentTerms: Number($("#paymentTerms").value) || 7,
      invoicePrefix: ($("#invoicePrefix").value.trim() || "INV").toUpperCase(),
      bankName: $("#bankName").value.trim(),
      bankBsb: formatBSB($("#bankBsb").value),
      bankAccountNumber: $("#bankAccountNumber").value.trim(),
      bankAccountName: $("#bankAccountName").value.trim()
    };
    saveState();
    renderAll();
    showToast("Settings saved.");
  }

  function renderABNHelp() {
    const help = $("#abnHelp");
    const abn = normaliseABN($("#businessAbn").value);
    if (!abn) {
      help.textContent = "Enter your 11-digit Australian Business Number.";
      return;
    }
    const result = validateABN(abn);
    help.textContent = result.valid ? "ABN format looks valid." : result.reason;
  }

  function exportBackup() {
    const data = { app: "InvoiceMate", version: "0.4.0", exportedAt: new Date().toISOString(), state };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoicemate-backup-${todayISO()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exported.");
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (!backup.state) throw new Error("Invalid backup");
      state = mergeDeep(clone(defaultState), backup.state);
      saveState();
      draft = newDraft();
      applyStyle();
      hydrateDraft();
      fillSettingsForm();
      renderAll();
      showToast("Backup imported.");
    } catch {
      showToast("Backup import failed.");
    } finally {
      event.target.value = "";
    }
  }

  function clearLocalData() {
    if (!confirm("Clear all local InvoiceMate data? Export a backup first if needed.")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = clone(defaultState);
    draft = newDraft();
    applyStyle();
    hydrateDraft();
    fillSettingsForm();
    renderAll();
    showToast("Local data cleared.");
  }

  function displayStatus(invoice) {
    if (invoice.status !== "paid" && invoice.dueDate && invoice.dueDate < todayISO()) return "overdue";
    return invoice.status || "draft";
  }

  function statusLabel(status) {
    return ({ draft: "Draft", sent: "Sent", paid: "Paid", overdue: "Overdue" })[status] || "Draft";
  }

  function templateLabel(template) {
    return ({ classic: "Classic Glass", modern: "Modern Accent", compact: "Compact" })[template] || "Classic Glass";
  }

  function money(value) {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
  }

  function parseAmount(value) {
    const num = Number(String(value || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(num) ? num : 0;
  }

  function round(value) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  function normaliseABN(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function formatABN(value) {
    const digits = normaliseABN(value);
    if (!digits) return "";
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4");
  }

  function validateABN(value) {
    const digits = normaliseABN(value);
    if (!digits) return { valid: false, reason: "ABN is blank." };
    if (!/^\d{11}$/.test(digits)) return { valid: false, reason: "ABN must contain 11 digits." };
    const weights = [10,1,3,5,7,9,11,13,15,17,19];
    const numbers = digits.split("").map(Number);
    numbers[0] -= 1;
    const total = numbers.reduce((sum, digit, index) => sum + digit * weights[index], 0);
    return { valid: total % 89 === 0, reason: "ABN checksum is not valid." };
  }

  function formatBSB(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 6);
    if (digits.length <= 3) return digits;
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2300);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(console.info);
    });
  }
})();
