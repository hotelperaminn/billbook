// ── Storage keys ──────────────────────────────────────────────────────────────
const SK = { SETTINGS: 'bb_settings', INVOICES: 'bb_invoices' };

// ── Default company settings ──────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  hotelName: 'H B HOTELS PERAM INN',
  gstin: '37AASFH7911B1ZA',
  address1: '21-1-56, GOVINDANAGAR ARCH, SRI RAM NAGAR',
  address2: 'Akkarampalle Road, Tirupati',
  city: 'Tirupati',
  state: 'ANDHRA PRADESH',
  stateCode: '37',
  pincode: '517509',
  phone: '',
  email: '',
  website: '',
  logo: null,
  invoicePrefix: 'INV-',
  nextNo: 425,
  defaultTax: 5,
  paymentDays: 6,
  bankName: '',
  bankAccount: '',
  bankIfsc: '',
  bankBranch: '',
  ejsServiceId: '',
  ejsTemplateId: '',
  ejsPublicKey: '',
  termsText: 'Thank you for staying with us. We hope to see you again!',
};

// ── Data access ───────────────────────────────────────────────────────────────
function getSettings() {
  const s = localStorage.getItem(SK.SETTINGS);
  return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : { ...DEFAULT_SETTINGS };
}
function saveSettings(s) { localStorage.setItem(SK.SETTINGS, JSON.stringify(s)); }

function getInvoices() {
  const s = localStorage.getItem(SK.INVOICES);
  return s ? JSON.parse(s) : [];
}
function getInvoiceById(id) { return getInvoices().find(i => i.id === id) || null; }
function saveInvoiceData(inv) {
  const list = getInvoices();
  const idx = list.findIndex(i => i.id === inv.id);
  if (idx >= 0) { list[idx] = inv; } else { list.unshift(inv); }
  const s = getSettings();
  const numPart = parseInt(inv.invoiceNo.replace(s.invoicePrefix, '')) + 1;
  if (!isNaN(numPart) && numPart > s.nextNo) { s.nextNo = numPart; saveSettings(s); }
  localStorage.setItem(SK.INVOICES, JSON.stringify(list));
  if (typeof GHS !== 'undefined') GHS.save(list);
}
function deleteInvoiceById(id) {
  const list = getInvoices().filter(i => i.id !== id);
  localStorage.setItem(SK.INVOICES, JSON.stringify(list));
  if (typeof GHS !== 'undefined') GHS.save(list);
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function getNextInvoiceNo() { const s = getSettings(); return s.invoicePrefix + s.nextNo; }

// ── Formatting helpers ────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
function addDays(d, n) { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0]; }
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(date, time) {
  if (!date) return '';
  const dt = new Date(date + 'T' + (time || '00:00'));
  const datePart = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${datePart}, ${timePart}`;
}
function fmtNum(n, dec = 2) {
  return parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtCur(n) { return '₹' + fmtNum(n); }

// ── Amount in words (Indian) ──────────────────────────────────────────────────
function numToWords(amount) {
  const num = Math.round(parseFloat(amount || 0) * 100) / 100;
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  const o = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const t = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function conv(n) {
    if (n === 0) return '';
    if (n < 20) return o[n];
    if (n < 100) return t[Math.floor(n / 10)] + (n % 10 ? ' ' + o[n % 10] : '');
    if (n < 1000) return o[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' And ' + conv(n % 100) : '');
    if (n < 100000) return conv(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + conv(n % 1000) : '');
    if (n < 10000000) return conv(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + conv(n % 100000) : '');
    return conv(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + conv(n % 10000000) : '');
  }
  let res = 'INR ' + (conv(rupees) || 'Zero') + ' Rupees';
  if (paise > 0) res += ' And ' + conv(paise) + ' Paise';
  return res + ' Only.';
}

// ── GST calculation ────────────────────────────────────────────────────────────
function calcTotals(items, hotelCode, supplyCode) {
  const inter = hotelCode !== supplyCode;
  let taxable = 0, cgst = 0, sgst = 0, igst = 0;
  items.forEach(item => {
    const t = parseFloat(item.rate || 0) * parseFloat(item.qty || 0);
    const tax = t * parseFloat(item.taxRate || 0) / 100;
    taxable += t;
    if (inter) igst += tax; else { cgst += tax / 2; sgst += tax / 2; }
  });
  return { taxable, cgst, sgst, igst, inter, total: taxable + cgst + sgst + igst };
}

function buildTaxRows(items, inter) {
  const rateMap = {};
  items.forEach(item => {
    const r = parseFloat(item.taxRate || 0);
    const taxable = parseFloat(item.rate || 0) * parseFloat(item.qty || 0);
    if (!rateMap[r]) rateMap[r] = 0;
    rateMap[r] += taxable * r / 100;
  });
  let rows = '';
  Object.entries(rateMap).forEach(([rate, tax]) => {
    if (parseFloat(rate) === 0) return;
    if (inter) {
      rows += `<tr><td class="inv-tlbl">IGST ${rate}%</td><td class="inv-tval">${fmtCur(tax)}</td></tr>`;
    } else {
      const h = parseFloat(rate) / 2;
      rows += `<tr><td class="inv-tlbl">CGST ${h}%</td><td class="inv-tval">${fmtCur(tax / 2)}</td></tr>`;
      rows += `<tr><td class="inv-tlbl">SGST ${h}%</td><td class="inv-tval">${fmtCur(tax / 2)}</td></tr>`;
    }
  });
  return rows;
}

// ── Indian States ─────────────────────────────────────────────────────────────
const STATES = [
  { code: '01', name: 'JAMMU AND KASHMIR' }, { code: '02', name: 'HIMACHAL PRADESH' },
  { code: '03', name: 'PUNJAB' }, { code: '04', name: 'CHANDIGARH' },
  { code: '05', name: 'UTTARAKHAND' }, { code: '06', name: 'HARYANA' },
  { code: '07', name: 'DELHI' }, { code: '08', name: 'RAJASTHAN' },
  { code: '09', name: 'UTTAR PRADESH' }, { code: '10', name: 'BIHAR' },
  { code: '11', name: 'SIKKIM' }, { code: '12', name: 'ARUNACHAL PRADESH' },
  { code: '13', name: 'NAGALAND' }, { code: '14', name: 'MANIPUR' },
  { code: '15', name: 'MIZORAM' }, { code: '16', name: 'TRIPURA' },
  { code: '17', name: 'MEGHALAYA' }, { code: '18', name: 'ASSAM' },
  { code: '19', name: 'WEST BENGAL' }, { code: '20', name: 'JHARKHAND' },
  { code: '21', name: 'ODISHA' }, { code: '22', name: 'CHHATTISGARH' },
  { code: '23', name: 'MADHYA PRADESH' }, { code: '24', name: 'GUJARAT' },
  { code: '26', name: 'DADRA AND NAGAR HAVELI' }, { code: '27', name: 'MAHARASHTRA' },
  { code: '29', name: 'KARNATAKA' }, { code: '30', name: 'GOA' },
  { code: '32', name: 'KERALA' }, { code: '33', name: 'TAMIL NADU' },
  { code: '34', name: 'PUDUCHERRY' }, { code: '36', name: 'TELANGANA' },
  { code: '37', name: 'ANDHRA PRADESH' }, { code: '38', name: 'LADAKH' },
];
function stateLabel(code) {
  const s = STATES.find(x => x.code === code);
  return s ? `${s.code}-${s.name}` : code;
}
function populateStateSelect(el, selected) {
  el.innerHTML = '<option value="">-- Select State --</option>';
  STATES.forEach(s => {
    const o = document.createElement('option');
    o.value = s.code; o.textContent = `${s.code}-${s.name}`;
    if (s.code === selected) o.selected = true;
    el.appendChild(o);
  });
}

// ── Toast notifications ───────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  let tc = document.getElementById('toast-container');
  if (!tc) { tc = document.createElement('div'); tc.id = 'toast-container'; document.body.appendChild(tc); }
  const id = 'toast-' + Date.now();
  tc.insertAdjacentHTML('beforeend', `
    <div id="${id}" class="bb-toast bb-toast-${type}">
      <span>${msg}</span>
      <button onclick="document.getElementById('${id}').remove()">×</button>
    </div>`);
  setTimeout(() => { const el = document.getElementById(id); if (el) el.remove(); }, 4000);
}

// ── Invoice HTML renderer ─────────────────────────────────────────────────────
function renderInvoice(inv, settings) {
  const supplyCode = inv.supplyCode || settings.stateCode;
  const { taxable, cgst, sgst, igst, inter, total } = calcTotals(inv.items || [], settings.stateCode, supplyCode);
  const taxRows = buildTaxRows(inv.items || [], inter);

  let totalQty = 0;
  const itemRows = (inv.items || []).map((item, i) => {
    const t = parseFloat(item.rate || 0) * parseFloat(item.qty || 0);
    const tax = t * parseFloat(item.taxRate || 0) / 100;
    totalQty += parseFloat(item.qty || 0);
    return `<tr>
      <td style="text-align:center;padding:6px 4px;">${i + 1}</td>
      <td style="padding:6px 8px;">
        <strong>${item.description || ''}</strong>
        ${item.sac ? `<br><span style="font-size:11px;color:#555;">SAC: ${item.sac}</span>` : ''}
      </td>
      <td style="text-align:right;padding:6px 8px;">${fmtNum(item.rate)}</td>
      <td style="text-align:center;padding:6px 4px;">${item.qty} ${item.unit || ''}</td>
      <td style="text-align:right;padding:6px 8px;">${fmtNum(t)}</td>
      <td style="text-align:right;padding:6px 8px;">${fmtNum(tax)} (${item.taxRate}%)</td>
      <td style="text-align:right;padding:6px 8px;">${fmtNum(t + tax)}</td>
    </tr>`;
  }).join('');

  const hotelAddr = [settings.address1, settings.address2,
    [settings.city, settings.state, settings.pincode].filter(Boolean).join(', ')
  ].filter(Boolean).join('<br>');

  const billAddr = [inv.billAddr1, inv.billAddr2,
    [inv.billCity, inv.billState, inv.billPin].filter(Boolean).join(', ')
  ].filter(Boolean).join('<br>');

  const logo = settings.logo
    ? `<img src="${settings.logo}" style="max-height:60px;max-width:120px;object-fit:contain;" alt="Logo">`
    : '';

  return `<div class="invoice-sheet" id="invoice-print">
  <table style="width:100%;border-bottom:2px solid #1a3c5e;padding-bottom:4px;margin-bottom:0;">
    <tr>
      <td style="font-size:13px;font-weight:700;letter-spacing:3px;color:#00796b;">TAX INVOICE</td>
      <td style="text-align:right;font-size:11px;color:#555;font-weight:600;">ORIGINAL FOR RECIPIENT</td>
    </tr>
  </table>
  <table style="width:100%;margin:10px 0 6px 0;">
    <tr>
      <td style="vertical-align:middle;padding-right:10px;">${logo}</td>
      <td style="vertical-align:top;">
        <div style="font-size:22px;font-weight:800;color:#1a3c5e;line-height:1.2;">${settings.hotelName}</div>
        <div style="font-size:12px;font-weight:700;margin-top:2px;">GSTIN <span style="font-weight:700;">${settings.gstin || ''}</span></div>
        <div style="font-size:11.5px;color:#333;margin-top:2px;line-height:1.5;">${hotelAddr}</div>
        ${settings.phone ? `<div style="font-size:11.5px;">Ph: ${settings.phone}</div>` : ''}
      </td>
    </tr>
  </table>
  <hr style="border:none;border-top:1px solid #ccc;margin:6px 0;">
  <table style="width:100%;margin:6px 0;">
    <tr>
      <td style="font-size:12px;"><strong>Invoice #:</strong> ${inv.invoiceNo || ''}</td>
      <td style="font-size:12px;text-align:center;"><strong>Check-in:</strong> ${fmtDateTime(inv.checkIn, inv.checkInTime)}</td>
      <td style="font-size:12px;text-align:right;"><strong>Check-out:</strong> ${fmtDateTime(inv.checkOut, inv.checkOutTime)}</td>
    </tr>
  </table>
  <hr style="border:none;border-top:1px solid #ccc;margin:6px 0;">
  <table style="width:100%;margin:6px 0;">
    <tr>
      <td style="width:50%;vertical-align:top;font-size:12px;padding-right:10px;">
        <div style="font-size:11px;color:#555;margin-bottom:4px;">Customer Details:</div>
        <div style="font-weight:700;">${inv.customerName || ''}</div>
        ${inv.customerCompany ? `<div style="font-weight:600;">${inv.customerCompany}</div>` : ''}
        ${inv.customerGstin ? `<div><strong>GSTIN:</strong> ${inv.customerGstin}</div>` : ''}
        ${inv.customerPhone ? `<div>Ph: ${inv.customerPhone}</div>` : ''}
      </td>
      <td style="width:50%;vertical-align:top;font-size:12px;">
        <div style="font-size:11px;color:#555;margin-bottom:4px;">Billing Address:</div>
        <div>${billAddr}</div>
      </td>
    </tr>
    <tr style="margin-top:6px;">
      <td style="padding-top:8px;font-size:12px;">
        <div style="font-size:11px;color:#555;">Place of Supply:</div>
        <div style="font-weight:700;">${stateLabel(supplyCode)}</div>
      </td>
      <td style="padding-top:8px;font-size:12px;">
        ${inv.reference ? `<strong>Reference:</strong> ${inv.reference}` : ''}
      </td>
    </tr>
  </table>
  <hr style="border:none;border-top:1px solid #ccc;margin:6px 0;">
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead>
      <tr style="background:#f5f5f5;border-top:1px solid #ddd;border-bottom:1px solid #ddd;">
        <th style="padding:7px 4px;text-align:center;width:4%;">#</th>
        <th style="padding:7px 8px;text-align:left;width:34%;">Item</th>
        <th style="padding:7px 8px;text-align:right;width:12%;">Rate / Item</th>
        <th style="padding:7px 4px;text-align:center;width:10%;">Qty</th>
        <th style="padding:7px 8px;text-align:right;width:13%;">Taxable Value</th>
        <th style="padding:7px 8px;text-align:right;width:13%;">Tax Amount</th>
        <th style="padding:7px 8px;text-align:right;width:14%;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <hr style="border:none;border-top:1px solid #ccc;margin:6px 0;">
  <table style="width:100%;font-size:12px;border-collapse:collapse;">
    <tr>
      <td rowspan="10" style="vertical-align:top;padding:4px 6px 4px 0;width:55%;border-right:1px solid #eee;">
        <div style="font-size:11.5px;">Total Items / Qty : ${(inv.items || []).length} / ${totalQty}</div>
        <div style="font-size:11px;color:#333;margin-top:6px;line-height:1.5;">Total amount (in words): ${numToWords(total)}</div>
      </td>
      <td style="padding:4px 8px;text-align:right;">Taxable Amount</td>
      <td style="padding:4px 8px;text-align:right;font-weight:600;">${fmtCur(taxable)}</td>
    </tr>
    ${taxRows}
    <tr style="border-top:1px solid #ccc;">
      <td style="padding:6px 8px;text-align:right;font-size:16px;font-weight:700;">Total</td>
      <td style="padding:6px 8px;text-align:right;font-size:16px;font-weight:700;">${fmtCur(total)}</td>
    </tr>
  </table>
  <table style="width:100%;font-size:12px;border-collapse:collapse;border-top:1px solid #ccc;">
    <tr>
      <td style="width:55%;padding:4px 0;"></td>
      <td style="padding:4px 8px;text-align:right;font-weight:700;">Amount Payable:</td>
      <td style="padding:4px 8px;text-align:right;font-weight:700;">${fmtCur(total)}</td>
    </tr>
  </table>
  <div style="margin-top:40px;text-align:right;font-size:12px;">
    <div>For ${settings.hotelName}</div>
    <div style="height:50px;"></div>
    <div>Authorized Signatory</div>
  </div>
  ${inv.notes ? `<div style="margin-top:12px;font-size:11px;border-top:1px solid #eee;padding-top:8px;"><strong>Notes:</strong> ${inv.notes}</div>` : ''}
  ${settings.bankName ? `<div style="margin-top:8px;font-size:11px;border-top:1px solid #eee;padding-top:8px;">
    <strong>Bank Details:</strong> ${settings.bankName} | A/c: ${settings.bankAccount} | IFSC: ${settings.bankIfsc} | Branch: ${settings.bankBranch}
  </div>` : ''}
  ${settings.termsText ? `<div style="margin-top:8px;font-size:11px;color:#555;">${settings.termsText}</div>` : ''}
  <hr style="border:none;border-top:1px solid #eee;margin:12px 0 4px 0;">
  <div style="text-align:center;font-size:10px;color:#999;">Page 1 / 1 &bull; This is a computer generated document and requires no signature.</div>
</div>`;
}
