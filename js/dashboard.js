// Dashboard page logic
let allInvoices = [];

async function init() {
  if (!requireAuth()) return;
  renderNavBrand();
  renderAuthBadge();
  applyDashboardRoles();
  await initGitHubSync();
  allInvoices = getInvoices();
  renderStats();
  renderTable(allInvoices);
  document.getElementById('search-input').addEventListener('input', applyFilters);
  document.getElementById('status-filter').addEventListener('change', applyFilters);
  document.getElementById('sort-select').addEventListener('change', applyFilters);

  window.addEventListener('bb-invoices-updated', () => {
    allInvoices = getInvoices();
    renderStats();
    renderTable(allInvoices);
  });
  GHS.startPolling();
}

function applyDashboardRoles() {
  // Viewer: hide create invoice button
  if (!canEdit()) {
    document.querySelectorAll('a[href="invoice.html"]').forEach(el => el.style.display = 'none');
    // Show read-only banner
    document.body.insertAdjacentHTML('afterbegin',
      '<div class="role-banner">👁️ Read-only access — you can view and download invoices but not create or edit them.</div>');
  }
}

function renderNavBrand() {
  const s = getSettings();
  document.getElementById('nav-hotel-name').textContent = s.hotelName;
  const logoEl = document.getElementById('nav-logo');
  if (s.logo) logoEl.innerHTML = `<img src="${s.logo}" class="navbar-logo" alt="Logo">`;
}

function renderStats() {
  const invoices = getInvoices();
  const total = invoices.length;
  const revenue = invoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + (i.total || 0), 0);
  const paid = invoices.filter(i => i.status === 'paid').length;
  const pending = invoices.filter(i => i.status === 'sent' || i.status === 'draft').length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-revenue').textContent = fmtCur(revenue);
  document.getElementById('stat-paid').textContent = paid;
  document.getElementById('stat-pending').textContent = pending;
}

function applyFilters() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const status = document.getElementById('status-filter').value;
  const sort = document.getElementById('sort-select').value;

  let list = [...allInvoices];
  if (q) {
    list = list.filter(i =>
      (i.invoiceNo || '').toLowerCase().includes(q) ||
      (i.customerName || '').toLowerCase().includes(q) ||
      (i.reference || '').toLowerCase().includes(q) ||
      (i.customerCompany || '').toLowerCase().includes(q)
    );
  }
  if (status) list = list.filter(i => i.status === status);

  list.sort((a, b) => {
    if (sort === 'date-desc') return (b.invoiceDate || '').localeCompare(a.invoiceDate || '');
    if (sort === 'date-asc') return (a.invoiceDate || '').localeCompare(b.invoiceDate || '');
    if (sort === 'amount-desc') return (b.total || 0) - (a.total || 0);
    if (sort === 'amount-asc') return (a.total || 0) - (b.total || 0);
    return 0;
  });

  renderTable(list);
}

function renderTable(invoices) {
  const tbody = document.getElementById('invoice-tbody');
  const role = getRole();

  if (!invoices.length) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <div class="empty-state-icon">🏨</div>
        <h3>No invoices found</h3>
        <p>Create your first invoice to get started</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = invoices.map(inv => {
    // Status: viewer sees plain text, others get dropdown
    const statusCell = role === 'viewer'
      ? `<span class="badge" style="background:#e3f2fd;color:#1565c0;">${inv.status}</span>`
      : `<select class="form-select form-control-sm" style="width:auto;min-width:90px;font-size:11px;"
           onchange="updateStatus('${inv.id}', this.value)">
           ${['draft','sent','paid','pending','cancelled'].map(s =>
             `<option value="${s}" ${inv.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
           ).join('')}
         </select>`;

    // Edit button: only for admin/editor
    const editBtn = canEdit()
      ? `<a href="invoice.html?id=${inv.id}" class="btn btn-sm btn-outline" title="Edit">✏️</a>`
      : `<a href="invoice.html?id=${inv.id}" class="btn btn-sm btn-outline" title="View">👁️</a>`;

    // Delete button: admin only
    const deleteBtn = canDelete()
      ? `<button class="btn btn-sm btn-danger" title="Delete" onclick="confirmDelete('${inv.id}')">🗑️</button>`
      : '';

    return `<tr>
      <td><span class="invoice-no">${inv.invoiceNo || ''}</span></td>
      <td>
        <div class="customer-name">${inv.customerName || ''}</div>
        ${inv.customerCompany ? `<div class="text-muted">${inv.customerCompany}</div>` : ''}
      </td>
      <td>${inv.reference || '<span class="text-muted">—</span>'}</td>
      <td>${inv.checkIn ? fmtDate(inv.checkIn) : '<span class="text-muted">—</span>'}</td>
      <td>${inv.invoiceDate ? fmtDate(inv.invoiceDate) : ''}</td>
      <td class="text-right amount-cell">${fmtCur(inv.total || 0)}</td>
      <td class="text-center">${statusCell}</td>
      <td>
        <div class="flex gap-8" style="justify-content:flex-end;">
          ${editBtn}
          <button class="btn btn-sm btn-info" title="Download PDF" onclick="downloadPDF('${inv.id}')">⬇️</button>
          ${deleteBtn}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function updateStatus(id, status) {
  if (!canEdit()) return;
  const inv = getInvoiceById(id);
  if (!inv) return;
  inv.status = status;
  saveInvoiceData(inv);
  allInvoices = getInvoices();
  renderStats();
  showToast('Status updated', 'success');
}

function confirmDelete(id) {
  if (!canDelete()) { showToast('No permission to delete invoices', 'danger'); return; }
  const inv = getInvoiceById(id);
  if (!inv) return;
  showConfirmModal(
    'Delete Invoice',
    `Are you sure you want to delete invoice <strong>${inv.invoiceNo}</strong>? This cannot be undone.`,
    () => {
      deleteInvoiceById(id);
      allInvoices = getInvoices();
      renderStats();
      renderTable(allInvoices);
      showToast('Invoice deleted', 'danger');
    }
  );
}

function showConfirmModal(title, msg, onConfirm) {
  const existing = document.getElementById('confirm-modal');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="confirm-modal">
      <div class="modal-box">
        <div class="modal-title">${title}</div>
        <p style="font-size:14px;color:#444;">${msg}</p>
        <div class="modal-actions">
          <button class="btn btn-light" onclick="document.getElementById('confirm-modal').remove()">Cancel</button>
          <button class="btn btn-danger" id="confirm-ok-btn">Delete</button>
        </div>
      </div>
    </div>
  `);
  document.getElementById('confirm-ok-btn').onclick = () => {
    document.getElementById('confirm-modal').remove();
    onConfirm();
  };
}

async function downloadPDF(id) {
  const inv = getInvoiceById(id);
  const settings = getSettings();
  if (!inv) return;

  const html = renderInvoice(inv, settings);
  const el = document.createElement('div');
  el.innerHTML = html;
  el.style.position = 'fixed'; el.style.left = '-9999px';
  el.style.top = '0'; el.style.width = '794px';
  document.body.appendChild(el);

  try {
    await html2pdf().set({
      margin: 8, filename: `${inv.invoiceNo}_${(inv.customerName || '').replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(el.firstElementChild).save();
    showToast('PDF downloaded', 'success');
  } catch (e) {
    showToast('PDF generation failed', 'danger');
    console.error(e);
  } finally {
    document.body.removeChild(el);
  }
}

document.addEventListener('DOMContentLoaded', init);
