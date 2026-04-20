// Authentication — roles: admin | editor | viewer
const AUTH_KEY = 'bb_auth';
const USERS_KEY = 'bb_users';

async function hashPassword(pwd) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function loadUsers() {
  // Try GitHub first, fall back to localStorage cache
  try {
    const resp = await fetch('data/users.json?_=' + Date.now());
    if (resp.ok) {
      const users = await resp.json();
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return users;
    }
  } catch (e) { /* fall through */ }
  const cached = localStorage.getItem(USERS_KEY);
  return cached ? JSON.parse(cached) : [];
}

async function loginUser(username, password) {
  const users = await loadUsers();
  const hash = await hashPassword(password);
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === hash);
  if (!user) return false;
  sessionStorage.setItem(AUTH_KEY, JSON.stringify({
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role,
    loginTime: Date.now(),
  }));
  return true;
}

function getCurrentUser() {
  const s = sessionStorage.getItem(AUTH_KEY);
  return s ? JSON.parse(s) : null;
}

function getRole() { return getCurrentUser()?.role || null; }

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  window.location.href = 'login.html';
}

// Redirect to login if not authenticated; returns false if redirecting
function requireAuth() {
  if (!getCurrentUser()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Permissions
function canEdit()           { return ['admin', 'editor'].includes(getRole()); }
function canDelete()         { return getRole() === 'admin'; }
function canManageSettings() { return getRole() === 'admin'; }
function canManageUsers()    { return getRole() === 'admin'; }

// Inject user badge + logout into navbar
function renderAuthBadge() {
  const user = getCurrentUser();
  if (!user) return;
  const nav = document.querySelector('.navbar-nav');
  if (!nav) return;
  // Remove settings link for non-admin
  if (!canManageSettings()) {
    nav.querySelectorAll('a[href="settings.html"]').forEach(el => el.closest('li')?.remove());
  }
  const roleLabel = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }[user.role] || user.role;
  const li = document.createElement('li');
  li.innerHTML = `<span class="auth-badge">
    <span class="auth-user">${user.displayName}</span>
    <span class="auth-role auth-role-${user.role}">${roleLabel}</span>
    <button class="auth-logout-btn" onclick="logout()">Logout</button>
  </span>`;
  nav.appendChild(li);
}
