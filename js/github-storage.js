// GitHub Storage — saves invoices to data/invoices.json in the repo
// Acts as a cloud database accessible from any device

const GHS = {
  _sha: null,
  _syncing: false,
  _pendingData: null,

  coords() {
    const host = window.location.hostname;
    if (host.endsWith('.github.io')) {
      const owner = host.replace('.github.io', '');
      const repo = window.location.pathname.split('/').filter(Boolean)[0] || '';
      return { owner, repo };
    }
    // Local dev fallback — read from settings
    const s = getSettings();
    return { owner: s.ghOwner || 'hotelperaminn', repo: s.ghRepo || 'billbook' };
  },

  token() { return getSettings().ghToken || ''; },

  isReady() {
    const { owner, repo } = this.coords();
    return !!(owner && repo && this.token());
  },

  async _fetch(path, options = {}) {
    const { owner, repo } = this.coords();
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `token ${this.token()}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    return res;
  },

  async read(path) {
    const res = await this._fetch(path);
    if (res.status === 404) return { data: null, sha: null };
    if (!res.ok) throw new Error(`GitHub read error ${res.status}`);
    const json = await res.json();
    // Decode base64 with Unicode support
    const raw = decodeURIComponent(escape(atob(json.content.replace(/\s/g, ''))));
    return { data: JSON.parse(raw), sha: json.sha };
  },

  async write(path, data, sha) {
    // Encode with Unicode support
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const body = { message: `[billbook] update ${path}`, content, branch: 'main' };
    if (sha) body.sha = sha;

    const res = await this._fetch(path, { method: 'PUT', body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub write error ${res.status}`);
    }
    const json = await res.json();
    return json.content.sha;
  },

  // ── Public API ──────────────────────────────────────────────────────────────

  async load() {
    if (!this.isReady()) { setSyncStatus('offline'); return null; }
    setSyncStatus('loading');
    try {
      const { data, sha } = await this.read('data/invoices.json');
      this._sha = sha;
      setSyncStatus('synced');
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('GHS load failed:', e);
      setSyncStatus('error', e.message);
      return null;
    }
  },

  async save(invoices) {
    if (!this.isReady()) return;

    // Queue if already syncing
    if (this._syncing) { this._pendingData = invoices; return; }

    this._syncing = true;
    setSyncStatus('saving');
    try {
      this._sha = await this.write('data/invoices.json', invoices, this._sha);
      setSyncStatus('synced');
    } catch (e) {
      // SHA conflict — refresh SHA and retry once
      if (e.message && (e.message.includes('SHA') || e.message.includes('sha') || e.message.includes('409'))) {
        try {
          const { sha } = await this.read('data/invoices.json');
          this._sha = sha;
          this._sha = await this.write('data/invoices.json', invoices, this._sha);
          setSyncStatus('synced');
        } catch (e2) {
          setSyncStatus('error', 'Conflict — refresh page');
          console.error('GHS retry failed:', e2);
        }
      } else {
        console.error('GHS save failed:', e);
        setSyncStatus('error', e.message);
      }
    } finally {
      this._syncing = false;
      if (this._pendingData) {
        const next = this._pendingData;
        this._pendingData = null;
        this.save(next);
      }
    }
  },

  async testConnection() {
    if (!this.isReady()) return { ok: false, msg: 'Token not configured' };
    try {
      const { owner, repo } = this.coords();
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { 'Authorization': `token ${this.token()}` }
      });
      if (res.status === 404) return { ok: false, msg: 'Repository not found' };
      if (res.status === 401) return { ok: false, msg: 'Invalid token' };
      if (!res.ok) return { ok: false, msg: `Error ${res.status}` };
      const json = await res.json();
      return { ok: true, msg: `Connected to ${json.full_name}` };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  },

  async manualSync() {
    const invoices = await this.load();
    if (invoices !== null) {
      localStorage.setItem('bb_invoices', JSON.stringify(invoices));
      return invoices;
    }
    return null;
  },

  async saveSettings(settings) {
    if (!this.isReady()) return;
    // Exclude large logo from cloud sync to keep file small
    const { logo, ...rest } = settings;
    try {
      const res = await this.read('data/settings.json').catch(() => ({ data: null, sha: null }));
      await this.write('data/settings.json', rest, res.sha);
    } catch (e) { /* silent */ }
  },

  async loadSettings() {
    if (!this.isReady()) return null;
    try {
      const { data } = await this.read('data/settings.json');
      return data;
    } catch (e) { return null; }
  },

  // Poll GitHub every 30s and fire 'bb-invoices-updated' if data changed
  startPolling(interval = 30000) {
    if (this._pollTimer) return;
    this._pollTimer = setInterval(async () => {
      if (!this.isReady()) return;
      try {
        const { data, sha } = await this.read('data/invoices.json');
        if (!data) return;
        const current = localStorage.getItem('bb_invoices') || '[]';
        const incoming = JSON.stringify(data);
        if (incoming !== current) {
          this._sha = sha;
          localStorage.setItem('bb_invoices', incoming);
          window.dispatchEvent(new CustomEvent('bb-invoices-updated'));
        }
      } catch (e) { /* silent */ }
    }, interval);
  }
};

// ── Sync status indicator ────────────────────────────────────────────────────
function setSyncStatus(status, msg) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const map = {
    loading: { icon: '🔵', text: 'Loading…',  cls: 'sync-loading' },
    saving:  { icon: '🟡', text: 'Saving…',   cls: 'sync-saving'  },
    synced:  { icon: '🟢', text: 'Synced',    cls: 'sync-synced'  },
    error:   { icon: '🔴', text: msg || 'Sync error', cls: 'sync-error' },
    offline: { icon: '⚫', text: 'Local only', cls: 'sync-offline' },
  };
  const s = map[status] || map.offline;
  el.innerHTML = `<span class="sync-icon">${s.icon}</span><span class="sync-text">${s.text}</span>`;
  el.className = `sync-badge ${s.cls}`;
  if (msg) el.title = msg;
}

// ── Init: called on every page load ─────────────────────────────────────────
async function initGitHubSync() {
  if (!GHS.token()) {
    try {
      const resp = await fetch('data/config.json?_=' + Date.now());
      if (resp.ok) {
        const cfg = await resp.json();
        if (Array.isArray(cfg.k)) {
          const s = getSettings();
          s.ghToken = String.fromCharCode(...cfg.k);
          saveSettings(s);
        }
      }
    } catch (e) { /* silent */ }
  }

  // Pull settings from GitHub (preserves local logo)
  const cloudSettings = await GHS.loadSettings();
  if (cloudSettings) {
    const local = JSON.parse(localStorage.getItem('bb_settings') || '{}');
    localStorage.setItem('bb_settings', JSON.stringify({ ...local, ...cloudSettings, logo: local.logo || null }));
  }

  const invoices = await GHS.load();
  if (invoices !== null) {
    localStorage.setItem('bb_invoices', JSON.stringify(invoices));
    return invoices;
  }
  return JSON.parse(localStorage.getItem('bb_invoices') || '[]');
}
