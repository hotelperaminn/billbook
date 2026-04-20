// Settings page logic
function init() {
  const s = getSettings();
  loadForm(s);
  populateStateSelect(document.getElementById('state-code'), s.stateCode);

  document.getElementById('nav-hotel-name').textContent = s.hotelName;
  const logoEl = document.getElementById('nav-logo');
  if (s.logo) logoEl.innerHTML = `<img src="${s.logo}" class="navbar-logo" alt="Logo">`;

  // Logo upload
  const logoInput = document.getElementById('logo-input');
  const logoArea = document.getElementById('logo-upload-area');
  logoArea.addEventListener('click', () => logoInput.click());
  logoArea.addEventListener('dragover', e => { e.preventDefault(); logoArea.style.borderColor = '#1a3c5e'; });
  logoArea.addEventListener('dragleave', () => { logoArea.style.borderColor = ''; });
  logoArea.addEventListener('drop', e => {
    e.preventDefault(); logoArea.style.borderColor = '';
    if (e.dataTransfer.files[0]) handleLogoFile(e.dataTransfer.files[0]);
  });
  logoInput.addEventListener('change', e => { if (e.target.files[0]) handleLogoFile(e.target.files[0]); });

  document.getElementById('btn-remove-logo').addEventListener('click', removeLogo);
  document.getElementById('btn-save').addEventListener('click', saveAll);
  document.getElementById('btn-test-email').addEventListener('click', testEmail);

  // Auto-format GSTIN
  document.getElementById('gstin').addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase();
  });

  // Show/hide bank details
  const bankToggle = document.getElementById('toggle-bank');
  const bankSection = document.getElementById('bank-section');
  bankToggle.addEventListener('change', () => {
    bankSection.style.display = bankToggle.checked ? 'block' : 'none';
  });
  if (s.bankName) { bankToggle.checked = true; bankSection.style.display = 'block'; }

  // Hash navigation
  if (window.location.hash === '#email') {
    document.getElementById('email-section').scrollIntoView({ behavior: 'smooth' });
  }
}

function loadForm(s) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('hotel-name', s.hotelName);
  set('gstin', s.gstin);
  set('address1', s.address1);
  set('address2', s.address2);
  set('city', s.city);
  set('pincode', s.pincode);
  set('phone', s.phone);
  set('email', s.email);
  set('website', s.website);
  set('invoice-prefix', s.invoicePrefix);
  set('next-no', s.nextNo);
  set('default-tax', s.defaultTax);
  set('payment-days', s.paymentDays);
  set('bank-name', s.bankName);
  set('bank-account', s.bankAccount);
  set('bank-ifsc', s.bankIfsc);
  set('bank-branch', s.bankBranch);
  set('terms-text', s.termsText);
  set('ejs-service-id', s.ejsServiceId);
  set('ejs-template-id', s.ejsTemplateId);
  set('ejs-public-key', s.ejsPublicKey);

  if (s.logo) {
    document.getElementById('logo-preview').src = s.logo;
    document.getElementById('logo-preview').style.display = 'block';
    document.getElementById('logo-upload-hint').textContent = 'Click or drag to replace logo';
    document.getElementById('btn-remove-logo').style.display = 'inline-flex';
  }
}

function handleLogoFile(file) {
  if (!file.type.startsWith('image/')) { showToast('Please upload an image file', 'warning'); return; }
  if (file.size > 2 * 1024 * 1024) { showToast('Logo must be under 2MB', 'warning'); return; }

  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    document.getElementById('logo-preview').src = dataUrl;
    document.getElementById('logo-preview').style.display = 'block';
    document.getElementById('logo-upload-hint').textContent = 'Click or drag to replace logo';
    document.getElementById('btn-remove-logo').style.display = 'inline-flex';

    const s = getSettings();
    s.logo = dataUrl;
    saveSettings(s);
    showToast('Logo uploaded', 'success');

    document.getElementById('nav-logo').innerHTML = `<img src="${dataUrl}" class="navbar-logo" alt="Logo">`;
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  const s = getSettings();
  s.logo = null;
  saveSettings(s);
  document.getElementById('logo-preview').style.display = 'none';
  document.getElementById('logo-preview').src = '';
  document.getElementById('logo-upload-hint').textContent = 'Click or drag your hotel logo here';
  document.getElementById('btn-remove-logo').style.display = 'none';
  document.getElementById('nav-logo').innerHTML = `<div class="navbar-logo-placeholder">🏨</div>`;
  showToast('Logo removed', 'info');
}

function getVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

function saveAll() {
  const s = getSettings();
  s.hotelName   = getVal('hotel-name');
  s.gstin       = getVal('gstin').toUpperCase();
  s.address1    = getVal('address1');
  s.address2    = getVal('address2');
  s.city        = getVal('city');
  s.stateCode   = getVal('state-code');
  s.state       = STATES.find(x => x.code === s.stateCode)?.name || s.state;
  s.pincode     = getVal('pincode');
  s.phone       = getVal('phone');
  s.email       = getVal('email');
  s.website     = getVal('website');
  s.invoicePrefix = getVal('invoice-prefix') || 'INV-';
  s.nextNo      = parseInt(getVal('next-no')) || s.nextNo;
  s.defaultTax  = parseFloat(getVal('default-tax')) || 5;
  s.paymentDays = parseInt(getVal('payment-days')) || 6;
  s.bankName    = getVal('bank-name');
  s.bankAccount = getVal('bank-account');
  s.bankIfsc    = getVal('bank-ifsc');
  s.bankBranch  = getVal('bank-branch');
  s.termsText   = getVal('terms-text');
  s.ejsServiceId = getVal('ejs-service-id');
  s.ejsTemplateId = getVal('ejs-template-id');
  s.ejsPublicKey = getVal('ejs-public-key');

  if (!s.hotelName) { showToast('Hotel name is required', 'warning'); return; }

  saveSettings(s);

  document.getElementById('nav-hotel-name').textContent = s.hotelName;
  showToast('Settings saved successfully', 'success');
}

async function testEmail() {
  const serviceId = getVal('ejs-service-id');
  const templateId = getVal('ejs-template-id');
  const publicKey = getVal('ejs-public-key');
  const testAddr = document.getElementById('test-email-addr').value.trim();

  if (!serviceId || !templateId || !publicKey) {
    showToast('Please fill in all EmailJS fields first', 'warning'); return;
  }
  if (!testAddr) { showToast('Enter a test email address', 'warning'); return; }

  const btn = document.getElementById('btn-test-email');
  btn.disabled = true; btn.textContent = '⏳ Sending…';

  try {
    const s = getSettings();
    await emailjs.send(serviceId, templateId, {
      to_email: testAddr,
      to_name: 'Test',
      from_name: s.hotelName || 'Hotel',
      invoice_no: 'TEST-001',
      invoice_date: fmtDate(todayStr()),
      due_date: fmtDate(addDays(todayStr(), 6)),
      room_ref: 'ROOM NO: 101',
      check_in: fmtDate(todayStr()),
      check_out: fmtDate(addDays(todayStr(), 2)),
      amount: '₹2,360.00',
      hotel_address: [s.address1, s.city, s.state].filter(Boolean).join(', '),
      pdf_attachment: '',
    }, publicKey);
    showToast(`Test email sent to ${testAddr}`, 'success');
  } catch (err) {
    showToast('Test failed: ' + (err.text || err.message || 'Check credentials'), 'danger');
    console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = '🧪 Send Test Email';
  }
}

document.addEventListener('DOMContentLoaded', init);
