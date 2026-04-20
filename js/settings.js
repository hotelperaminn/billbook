// Settings page logic — admin only
async function init() {
  if (!requireAuth()) return;
  if (!canManageSettings()) {
    showToast('Settings are restricted to admin only', 'danger');
    setTimeout(() => window.location.href = 'index.html', 1500);
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const setupToken = params.get('setup');
  if (setupToken) {
    const s = getSettings();
    s.ghToken = setupToken;
    saveSettings(s);
    history.replaceState({}, '', 'settings.html');
    showToast('Cloud sync configured automatically! Invoices will now sync across all devices.', 'success');
    setTimeout(() => window.location.href = 'index.html', 2000);
    return;
  }

  renderAuthBadge();
  await initGitHubSync();

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
  document.getElementById('btn-test-gh').addEventListener('click', testGitHub);
  document.getElementById('btn-sync-now').addEventListener('click', syncNow);

  document.getElementById('gstin').addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase();
  });

  const bankToggle = document.getElementById('toggle-bank');
  const bankSection = document.getElementById('bank-section');
  bankToggle.addEventListener('change', () => {
    bankSection.style.display = bankToggle.checked ? 'block' : 'none';
  });
  if (s.bankName) { bankToggle.checked = true; bankSection.style.display = 'block'; }

  if (window.location.hash === '#email') {
    document.getElementById('email-section').scrollIntoView({ behavior: 'smooth' });
  }

  renderUsersTable();
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
  set('gh-token', s.ghToken);

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
    const s = getSettings(); s.logo = dataUrl; saveSettings(s);
    showToast('Logo uploaded', 'success');
    document.getElementById('nav-logo').innerHTML = `<img src="${dataUrl}" class="navbar-logo" alt="Logo">`;
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  const s = getSettings(); s.logo = null; saveSettings(s);
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
  s.ejsServiceId  = getVal('ejs-service-id');
  s.ejsTemplateId = getVal('ejs-template-id');
  s.ejsPublicKey  = getVal('ejs-public-key');
  s.ghToken       = getVal('gh-token');

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
  if (!serviceId || !templateId || !publicKey) { showToast('Please fill in all EmailJS fields first', 'warning'); return; }
  if (!testAddr) { showToast('Enter a test email address', 'warning'); return; }
  const btn = document.getElementById('btn-test-email');
  btn.disabled = true; btn.textContent = '⏳ Sending…';
  try {
    const s = getSettings();
    await emailjs.send(serviceId, templateId, {
      to_email: testAddr, to_name: 'Test', from_name: s.hotelName || 'Hotel',
      invoice_no: 'TEST-001', invoice_date: fmtDate(todayStr()),
      due_date: fmtDate(addDays(todayStr(), 6)), room_ref: 'ROOM NO: 101',
      check_in: fmtDate(todayStr()), check_out: fmtDate(addDays(todayStr(), 2)),
      amount: '₹2,360.00', hotel_address: [s.address1, s.city, s.state].filter(Boolean).join(', '),
      pdf_attachment: '',
    }, publicKey);
    showToast(`Test email sent to ${testAddr}`, 'success');
  } catch (err) {
    showToast('Test failed: ' + (err.text || err.message || 'Check credentials'), 'danger');
  } finally {
    btn.disabled = false; btn.textContent = '🧪 Send Test Email';
  }
}

async function testGitHub() {
  const token = getVal('gh-token');
  if (!token) { showToast('Enter a GitHub token first', 'warning'); return; }
  const s = getSettings(); s.ghToken = token; saveSettings(s);
  const btn = document.getElementById('btn-test-gh');
  const result = document.getElementById('gh-test-result');
  btn.disabled = true; btn.textContent = '⏳ Testing…';
  result.textContent = '';
  const { ok, msg } = await GHS.testConnection();
  result.textContent = (ok ? '✅ ' : '❌ ') + msg;
  result.style.color = ok ? '#2e7d32' : '#c62828';
  btn.disabled = false; btn.textContent = '🔗 Test Connection';
  if (ok) showToast(msg, 'success');
}

async function syncNow() {
  const btn = document.getElementById('btn-sync-now');
  btn.disabled = true; btn.textContent = '⏳ Syncing…';
  const invoices = await GHS.manualSync();
  btn.disabled = false; btn.textContent = '🔄 Pull Latest from GitHub';
  if (invoices !== null) showToast(`Synced — ${invoices.length} invoice(s) loaded`, 'success');
  else showToast('Sync failed — check token and connection', 'danger');
}

// ── User Management ────────────────────────────────────────────────────────────

function renderUsersTable() {
  const users = JSON.parse(localStorage.getItem('bb_users') || '[]');
  const container = document.getElementById('users-tbody');
  if (!container) return;

  container.innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.username}</strong></td>
      <td>${u.displayName || u.username}</td>
      <td><span class="auth-role auth-role-${u.role}">${u.role}</span></td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-sm btn-outline" onclick="openEditUser('${u.username}')">✏️ Edit</button>
          ${u.username !== getCurrentUser()?.username
            ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.username}')">🗑️</button>`
            : '<span class="text-muted" style="font-size:11px;padding:4px 8px;">current</span>'}
        </div>
      </td>
    </tr>`).join('') || '<tr><td colspan="4" class="text-muted" style="padding:16px;">No users found.</td></tr>';
}

function openAddUser() {
  showUserModal({ username: '', displayName: '', role: 'editor', passwordHash: '' }, false);
}

function openEditUser(username) {
  const users = JSON.parse(localStorage.getItem('bb_users') || '[]');
  const user = users.find(u => u.username === username);
  if (user) showUserModal(user, true);
}

function showUserModal(user, isEdit) {
  document.getElementById('user-modal')?.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="user-modal">
      <div class="modal-box" style="max-width:420px;">
        <div class="modal-title">${isEdit ? 'Edit User' : 'Add New User'}</div>
        <div class="form-group">
          <label class="form-label">Username</label>
          <input type="text" id="um-username" class="form-control" value="${user.username}" ${isEdit ? 'readonly' : ''} placeholder="e.g. reception">
        </div>
        <div class="form-group">
          <label class="form-label">Display Name</label>
          <input type="text" id="um-displayname" class="form-control" value="${user.displayName || ''}" placeholder="e.g. Front Desk">
        </div>
        <div class="form-group">
          <label class="form-label">Role</label>
          <select id="um-role" class="form-select">
            <option value="admin" ${user.role==='admin'?'selected':''}>Admin — full access</option>
            <option value="editor" ${user.role==='editor'?'selected':''}>Editor — create/edit invoices, no delete or settings</option>
            <option value="viewer" ${user.role==='viewer'?'selected':''}>Viewer — read only</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">${isEdit ? 'New Password (leave blank to keep current)' : 'Password'}</label>
          <input type="password" id="um-password" class="form-control" placeholder="${isEdit ? 'Leave blank to keep current' : 'Enter password'}">
        </div>
        <div class="modal-actions">
          <button class="btn btn-light" onclick="document.getElementById('user-modal').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="saveUser('${user.username}', ${isEdit})">${isEdit ? 'Save Changes' : 'Add User'}</button>
        </div>
      </div>
    </div>`);
}

async function saveUser(originalUsername, isEdit) {
  const username = document.getElementById('um-username').value.trim().toLowerCase();
  const displayName = document.getElementById('um-displayname').value.trim();
  const role = document.getElementById('um-role').value;
  const password = document.getElementById('um-password').value;

  if (!username) { showToast('Username is required', 'warning'); return; }
  if (!isEdit && !password) { showToast('Password is required for new users', 'warning'); return; }

  const users = JSON.parse(localStorage.getItem('bb_users') || '[]');

  if (!isEdit && users.find(u => u.username === username)) {
    showToast('Username already exists', 'warning'); return;
  }

  let passwordHash;
  if (password) {
    passwordHash = await hashPassword(password);
  } else {
    passwordHash = users.find(u => u.username === originalUsername)?.passwordHash || '';
  }

  const updatedUser = { username, displayName: displayName || username, role, passwordHash };

  let updatedList;
  if (isEdit) {
    updatedList = users.map(u => u.username === originalUsername ? updatedUser : u);
  } else {
    updatedList = [...users, updatedUser];
  }

  localStorage.setItem('bb_users', JSON.stringify(updatedList));
  await GHS.saveUsers(updatedList);

  document.getElementById('user-modal').remove();
  renderUsersTable();
  showToast(isEdit ? 'User updated' : 'User added', 'success');
}

async function deleteUser(username) {
  if (username === getCurrentUser()?.username) { showToast('Cannot delete your own account', 'danger'); return; }
  if (!confirm(`Delete user "${username}"?`)) return;

  const users = JSON.parse(localStorage.getItem('bb_users') || '[]');
  const updated = users.filter(u => u.username !== username);
  localStorage.setItem('bb_users', JSON.stringify(updated));
  await GHS.saveUsers(updated);
  renderUsersTable();
  showToast('User deleted', 'danger');
}

document.addEventListener('DOMContentLoaded', init);
