// Invoice create/edit page
let currentInvoice = null;
let itemCounter = 0;

const UNITS = ['DAY', 'NIGHT', 'HOUR', 'WEEK', 'MONTH', 'PCS', 'NOS'];
const SAC_CODES = [
  { code: '996311', label: 'Room/Accommodation (General)' },
  { code: '996312', label: 'Convention/Meeting Room' },
  { code: '996322', label: 'Room Service' },
  { code: '996331', label: 'Restaurant Services' },
  { code: '998551', label: 'Laundry Services' },
  { code: '996334', label: 'Bar/Lounge Services' },
];

function init() {
  renderNavBrand();
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const settings = getSettings();

  // Populate state dropdowns
  populateStateSelect(document.getElementById('bill-state'), settings.stateCode);
  populateStateSelect(document.getElementById('supply-code'), settings.stateCode);

  if (id) {
    currentInvoice = getInvoiceById(id);
    if (!currentInvoice) { showToast('Invoice not found', 'danger'); return; }
    populateForm(currentInvoice);
    document.getElementById('page-title').textContent = 'Edit Invoice';
  } else {
    currentInvoice = createBlank(settings);
    populateForm(currentInvoice);
  }

  attachListeners();
  updatePreview();
}

function renderNavBrand() {
  const s = getSettings();
  document.getElementById('nav-hotel-name').textContent = s.hotelName;
  const logoEl = document.getElementById('nav-logo');
  if (s.logo) logoEl.innerHTML = `<img src="${s.logo}" class="navbar-logo" alt="Logo">`;
}

function createBlank(settings) {
  return {
    id: genId(),
    invoiceNo: getNextInvoiceNo(),
    customerName: '', customerCompany: '', customerGstin: '', customerPhone: '', customerEmail: '',
    billAddr1: '', billAddr2: '', billCity: '', billState: '', billPin: '',
    supplyCode: settings.stateCode,
    reference: '',
    checkIn: '', checkInTime: '12:00',
    checkOut: '', checkOutTime: '11:00',
    items: [{ id: genId(), description: 'ROOM SERVICE', sac: '996322', rate: '', qty: 1, unit: 'DAY', taxRate: settings.defaultTax || 5 }],
    notes: '',
    status: 'draft',
    total: 0,
  };
}

function populateForm(inv) {
  setVal('invoice-no', inv.invoiceNo);
  setVal('cust-name', inv.customerName);
  setVal('cust-company', inv.customerCompany);
  setVal('cust-gstin', inv.customerGstin);
  setVal('cust-phone', inv.customerPhone);
  setVal('cust-email', inv.customerEmail);
  setVal('bill-addr1', inv.billAddr1);
  setVal('bill-addr2', inv.billAddr2);
  setVal('bill-city', inv.billCity);
  setVal('bill-pin', inv.billPin);
  setVal('reference', inv.reference);
  setVal('check-in', inv.checkIn);
  setVal('check-in-time', inv.checkInTime || '12:00');
  setVal('check-out', inv.checkOut);
  setVal('check-out-time', inv.checkOutTime || '11:00');
  setVal('notes', inv.notes);
  if (inv.billState) setSelectVal('bill-state', inv.billState);
  if (inv.supplyCode) setSelectVal('supply-code', inv.supplyCode);

  // Render items
  const tbody = document.getElementById('items-tbody');
  tbody.innerHTML = '';
  (inv.items || []).forEach(item => addItemRow(item));
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}
function setSelectVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function addItemRow(item = {}) {
  itemCounter++;
  const id = item.id || genId();
  const tbody = document.getElementById('items-tbody');
  const unitOptions = UNITS.map(u => `<option value="${u}" ${(item.unit || 'DAY') === u ? 'selected' : ''}>${u}</option>`).join('');
  const sacOptions = SAC_CODES.map(s =>
    `<option value="${s.code}" ${item.sac === s.code ? 'selected' : ''}>${s.code}</option>`
  ).join('');

  const tr = document.createElement('tr');
  tr.setAttribute('data-item-id', id);
  tr.innerHTML = `
    <td style="width:28px;text-align:center;color:#888;">${tbody.children.length + 1}</td>
    <td style="min-width:140px;">
      <input type="text" class="form-control item-desc" placeholder="Description" value="${item.description || ''}">
    </td>
    <td style="width:100px;">
      <select class="form-control item-sac">${sacOptions}</select>
    </td>
    <td style="width:90px;">
      <input type="number" class="form-control item-rate" placeholder="Rate" value="${item.rate || ''}" min="0" step="0.01">
    </td>
    <td style="width:70px;">
      <input type="number" class="form-control item-qty" placeholder="Qty" value="${item.qty || 1}" min="1" step="0.5">
    </td>
    <td style="width:80px;">
      <select class="form-control item-unit">${unitOptions}</select>
    </td>
    <td style="width:75px;">
      <select class="form-control item-tax">
        ${[0,5,12,18,28].map(r => `<option value="${r}" ${(item.taxRate||5)==r?'selected':''}>${r}%</option>`).join('')}
      </select>
    </td>
    <td style="width:90px;text-align:right;padding-right:6px;" class="item-amount-cell">₹0.00</td>
    <td style="width:32px;text-align:center;">
      <button class="del-item-btn" onclick="removeItemRow(this)" title="Remove">×</button>
    </td>`;
  tbody.appendChild(tr);

  // Event listeners on this row
  tr.querySelectorAll('input,select').forEach(el => el.addEventListener('input', () => { calcRowAmount(tr); updatePreview(); }));
  calcRowAmount(tr);
}

function calcRowAmount(tr) {
  const rate = parseFloat(tr.querySelector('.item-rate')?.value || 0);
  const qty = parseFloat(tr.querySelector('.item-qty')?.value || 0);
  const tax = parseFloat(tr.querySelector('.item-tax')?.value || 0);
  const taxable = rate * qty;
  const total = taxable + taxable * tax / 100;
  const cell = tr.querySelector('.item-amount-cell');
  if (cell) cell.textContent = fmtCur(total);
}

function removeItemRow(btn) {
  const tr = btn.closest('tr');
  const tbody = document.getElementById('items-tbody');
  if (tbody.children.length <= 1) { showToast('At least one item required', 'warning'); return; }
  tr.remove();
  // Re-number
  [...tbody.children].forEach((row, i) => {
    const first = row.querySelector('td:first-child');
    if (first) first.textContent = i + 1;
  });
  updatePreview();
}

function collectItems() {
  return [...document.querySelectorAll('#items-tbody tr')].map(tr => ({
    id: tr.getAttribute('data-item-id') || genId(),
    description: tr.querySelector('.item-desc')?.value.trim() || '',
    sac: tr.querySelector('.item-sac')?.value || '',
    rate: parseFloat(tr.querySelector('.item-rate')?.value || 0),
    qty: parseFloat(tr.querySelector('.item-qty')?.value || 1),
    unit: tr.querySelector('.item-unit')?.value || 'DAY',
    taxRate: parseFloat(tr.querySelector('.item-tax')?.value || 0),
  }));
}

function collectFormData() {
  return {
    ...currentInvoice,
    invoiceNo: getVal('invoice-no'),
    customerName: getVal('cust-name'),
    customerCompany: getVal('cust-company'),
    customerGstin: getVal('cust-gstin'),
    customerPhone: getVal('cust-phone'),
    customerEmail: getVal('cust-email'),
    billAddr1: getVal('bill-addr1'),
    billAddr2: getVal('bill-addr2'),
    billCity: getVal('bill-city'),
    billState: getVal('bill-state'),
    billPin: getVal('bill-pin'),
    supplyCode: getVal('supply-code'),
    reference: getVal('reference'),
    checkIn: getVal('check-in'),
    checkInTime: getVal('check-in-time') || '12:00',
    checkOut: getVal('check-out'),
    checkOutTime: getVal('check-out-time') || '11:00',
    notes: getVal('notes'),
    items: collectItems(),
  };
}

function updatePreview() {
  const inv = collectFormData();
  const settings = getSettings();
  const { total } = calcTotals(inv.items || [], settings.stateCode, inv.supplyCode || settings.stateCode);
  inv.total = total;

  document.getElementById('invoice-preview-container').innerHTML = renderInvoice(inv, settings);

  // Scale preview to fit container
  const wrapper = document.querySelector('.preview-wrapper');
  const sheet = document.querySelector('.invoice-sheet');
  if (wrapper && sheet) {
    const scale = (wrapper.clientWidth - 32) / 794;
    sheet.style.transform = `scale(${Math.min(scale, 1)})`;
    sheet.style.transformOrigin = 'top left';
    sheet.style.width = '794px';
    const scaledH = sheet.scrollHeight * Math.min(scale, 1);
    wrapper.style.minHeight = scaledH + 'px';
  }
}

function attachListeners() {
  document.querySelectorAll('#form-panel input, #form-panel select, #form-panel textarea').forEach(el => {
    el.addEventListener('input', debounce(updatePreview, 250));
  });

  // Auto check-out nights calc
  document.getElementById('check-in').addEventListener('change', syncStayDates);
  document.getElementById('check-out').addEventListener('change', syncStayDates);

  document.getElementById('btn-add-item').addEventListener('click', () => { addItemRow(); updatePreview(); });
  document.getElementById('btn-save').addEventListener('click', saveInvoice);
  document.getElementById('btn-pdf').addEventListener('click', downloadPDF);
  document.getElementById('btn-email').addEventListener('click', sendEmail);
  document.getElementById('btn-print').addEventListener('click', printInvoice);
  document.getElementById('btn-new-from-here').addEventListener('click', () => {
    if (confirm('Save current invoice and start a new one?')) {
      saveInvoice(null, () => window.location.href = 'invoice.html');
    }
  });
}

function syncStayDates() {
  const checkIn = getVal('check-in');
  const checkOut = getVal('check-out');
  if (!checkIn || !checkOut) return;
  const days = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  if (days <= 0) return;

  // Update qty of first item
  const firstQty = document.querySelector('#items-tbody tr .item-qty');
  if (firstQty) { firstQty.value = days; firstQty.dispatchEvent(new Event('input')); }
}

function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function saveInvoice(e, callback) {
  const inv = collectFormData();
  if (!inv.customerName) { showToast('Customer name is required', 'warning'); return; }
  if (!inv.invoiceDate) { showToast('Invoice date is required', 'warning'); return; }

  const settings = getSettings();
  const { total } = calcTotals(inv.items || [], settings.stateCode, inv.supplyCode || settings.stateCode);
  inv.total = total;

  saveInvoiceData(inv);
  currentInvoice = inv;
  showToast('Invoice saved', 'success');
  if (callback) callback();

  // Update URL to include id
  const url = new URL(window.location.href);
  url.searchParams.set('id', inv.id);
  history.replaceState({}, '', url.toString());
}

async function downloadPDF() {
  const inv = collectFormData();
  const settings = getSettings();
  const { total } = calcTotals(inv.items || [], settings.stateCode, inv.supplyCode || settings.stateCode);
  inv.total = total;

  const html = renderInvoice(inv, settings);
  const el = document.createElement('div');
  el.innerHTML = html;
  el.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;';
  document.body.appendChild(el);

  const btn = document.getElementById('btn-pdf');
  btn.disabled = true; btn.textContent = '⏳ Generating…';

  try {
    await html2pdf().set({
      margin: 8,
      filename: `${inv.invoiceNo}_${(inv.customerName || 'Invoice').replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(el.firstElementChild).save();
    showToast('PDF downloaded', 'success');
  } catch (err) {
    showToast('PDF generation failed', 'danger');
    console.error(err);
  } finally {
    document.body.removeChild(el);
    btn.disabled = false; btn.textContent = '⬇️ Download PDF';
  }
}

function printInvoice() {
  const inv = collectFormData();
  const settings = getSettings();
  const { total } = calcTotals(inv.items || [], settings.stateCode, inv.supplyCode || settings.stateCode);
  inv.total = total;

  const html = renderInvoice(inv, settings);
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>${inv.invoiceNo}</title>
    <style>
      body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
      @media print { body { padding: 0; } }
    </style>
  </head><body>${html}
    <script>window.onload = () => { window.print(); window.close(); }<\/script>
  </body></html>`);
  win.document.close();
}

async function sendEmail() {
  const settings = getSettings();
  if (!settings.ejsPublicKey) {
    showToast('Configure EmailJS settings first', 'warning');
    window.open('settings.html#email', '_blank');
    return;
  }
  const inv = collectFormData();
  const { total } = calcTotals(inv.items || [], settings.stateCode, inv.supplyCode || settings.stateCode);
  inv.total = total;

  if (!inv.customerEmail) {
    const email = prompt('Enter customer email address:');
    if (!email) return;
    inv.customerEmail = email;
    document.getElementById('cust-email').value = email;
  }

  const btn = document.getElementById('btn-email');
  btn.disabled = true; btn.textContent = '⏳ Sending…';

  try {
    const html = renderInvoice(inv, settings);
    const el = document.createElement('div');
    el.innerHTML = html;
    el.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;';
    document.body.appendChild(el);

    let pdfBase64 = '';
    try {
      const pdfBlob = await html2pdf().set({
        margin: 8, html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(el.firstElementChild).outputPdf('blob');

      pdfBase64 = await new Promise(res => {
        const reader = new FileReader();
        reader.onloadend = () => res(reader.result.split(',')[1]);
        reader.readAsDataURL(pdfBlob);
      });
    } catch (_) { /* attachment optional */ }
    document.body.removeChild(el);

    await emailjs.send(settings.ejsServiceId, settings.ejsTemplateId, {
      to_email: inv.customerEmail,
      to_name: inv.customerName || '',
      from_name: settings.hotelName,
      invoice_no: inv.invoiceNo,
      invoice_date: fmtDate(inv.invoiceDate),
      due_date: fmtDate(inv.dueDate),
      room_ref: inv.reference || '',
      check_in: inv.checkIn ? fmtDate(inv.checkIn) : '',
      check_out: inv.checkOut ? fmtDate(inv.checkOut) : '',
      amount: fmtCur(inv.total),
      hotel_address: [settings.address1, settings.city, settings.state].filter(Boolean).join(', '),
      pdf_attachment: pdfBase64,
    }, settings.ejsPublicKey);

    inv.status = 'sent';
    saveInvoiceData(inv);
    showToast(`Email sent to ${inv.customerEmail}`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Email failed: ' + (err.text || err.message || 'Check EmailJS settings'), 'danger');
  } finally {
    btn.disabled = false; btn.textContent = '📧 Send Email';
  }
}

document.addEventListener('DOMContentLoaded', init);
