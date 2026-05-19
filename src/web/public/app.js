// State
let providers = [];
let config = {};
let editingId = null;

const OLLAMA_META = { icon: '🟣', label: 'Ollama' };

// ── API helpers ───────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Navigation ────────────────────────────────────────────────────────────────

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    if (btn.dataset.view === 'tools') loadTools();
    if (btn.dataset.view === 'settings') loadSettings();
  });
});

// ── Providers ─────────────────────────────────────────────────────────────────

async function loadProviders() {
  try {
    [providers, config] = await Promise.all([
      api('GET', '/providers'),
      api('GET', '/config'),
    ]);
    renderProviders();
    updateSettingsProviderSelect();
  } catch (e) {
    toast('Failed to load instances: ' + e.message, 'error');
  }
}

function renderProviders() {
  const grid = document.getElementById('providers-grid');
  grid.querySelectorAll('.provider-card').forEach(c => c.remove());

  if (providers.length === 0) {
    document.getElementById('providers-empty').style.display = 'block';
    return;
  }
  document.getElementById('providers-empty').style.display = 'none';

  for (const p of providers) {
    const isActive = p.id === config.activeProvider;

    const card = document.createElement('div');
    card.className = `provider-card type-ollama${isActive ? ' active-card' : ''}`;

    const badges = [];
    if (isActive) {
      badges.push('<span class="badge badge-current">● Active</span>');
    } else if (!p.enabled) {
      badges.push('<span class="badge badge-disabled">● Disabled</span>');
    }

    card.innerHTML = `
      <div class="provider-card-header">
        <div class="provider-info">
          <div class="provider-icon">${OLLAMA_META.icon}</div>
          <div>
            <div class="provider-name">${esc(p.name)}</div>
            <div class="provider-type">Ollama</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          ${badges.join('')}
        </div>
      </div>
      <div class="provider-card-body">
        ${p.defaultModel ? `<div class="provider-detail"><span class="provider-detail-label">Model</span><span class="provider-detail-value">${esc(p.defaultModel)}</span></div>` : ''}
        ${p.baseURL ? `<div class="provider-detail"><span class="provider-detail-label">Endpoint</span><span class="provider-detail-value">${esc(p.baseURL)}</span></div>` : ''}
      </div>
      <div class="provider-card-footer">
        <button class="btn btn-secondary btn-sm" onclick="testCard('${p.id}', this)">Test</button>
        ${!isActive ? `<button class="btn btn-secondary btn-sm" onclick="setActive('${p.id}')">Set Active</button>` : '<span class="btn btn-sm" style="cursor:default;opacity:.5">✓ Active</span>'}
        <button class="btn btn-secondary btn-sm" onclick="editProvider('${p.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProvider('${p.id}')">Delete</button>
      </div>
    `;
    grid.appendChild(card);
  }
}

async function testCard(id, btn) {
  const original = btn.textContent;
  btn.textContent = 'Testing…';
  btn.disabled = true;
  try {
    const result = await api('POST', `/providers/${id}/test`);
    toast(result.message, result.ok ? 'success' : 'error');
    btn.textContent = result.ok ? '✓ OK' : '✗ Failed';
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2500);
  } catch (e) {
    toast('Test failed: ' + e.message, 'error');
    btn.textContent = original;
    btn.disabled = false;
  }
}

async function setActive(id) {
  const provider = providers.find(p => p.id === id);
  if (!provider) return;
  try {
    await api('PATCH', '/config', { activeProvider: id, activeModel: provider.defaultModel || '' });
    config.activeProvider = id;
    config.activeModel = provider.defaultModel || '';
    renderProviders();
    updateSettingsProviderSelect();
    toast(`Active instance → ${provider.name}`, 'success');
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  }
}

async function deleteProvider(id) {
  const p = providers.find(p => p.id === id);
  if (!p || !confirm(`Delete instance "${p.name}"?`)) return;
  try {
    await api('DELETE', `/providers/${id}`);
    providers = providers.filter(p => p.id !== id);
    if (config.activeProvider === id) config.activeProvider = '';
    renderProviders();
    toast('Instance deleted', 'success');
  } catch (e) {
    toast('Delete failed: ' + e.message, 'error');
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function showAddForm() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add Ollama Instance';
  document.getElementById('provider-form').reset();
  document.getElementById('form-provider-id').value = '';
  document.getElementById('form-type').value = 'ollama';
  document.getElementById('form-baseurl').value = 'http://localhost:11434';
  document.getElementById('form-enabled').checked = true;
  document.getElementById('test-result').style.display = 'none';
  document.getElementById('models-dropdown').style.display = 'none';
  showModal();
}

function editProvider(id) {
  const p = providers.find(p => p.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Ollama Instance';
  document.getElementById('form-provider-id').value = id;
  document.getElementById('form-type').value = 'ollama';
  document.getElementById('form-name').value = p.name;
  document.getElementById('form-baseurl').value = p.baseURL || 'http://localhost:11434';
  document.getElementById('form-defaultmodel').value = p.defaultModel || '';
  document.getElementById('form-enabled').checked = p.enabled !== false;
  document.getElementById('test-result').style.display = 'none';
  document.getElementById('models-dropdown').style.display = 'none';
  showModal();
}

function showModal() {
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  editingId = null;
}

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ── Save instance ─────────────────────────────────────────────────────────────

function getFormBody() {
  const name = document.getElementById('form-name').value.trim();
  const baseURL = document.getElementById('form-baseurl').value.trim();
  const defaultModel = document.getElementById('form-defaultmodel').value.trim();
  const enabled = document.getElementById('form-enabled').checked;
  return { type: 'ollama', name, baseURL, defaultModel, enabled };
}

async function saveProvider() {
  const { type, name, baseURL, defaultModel, enabled } = getFormBody();

  if (!name) { toast('Please enter a display name', 'error'); return; }

  const body = { type, name, enabled };
  if (baseURL) body.baseURL = baseURL;
  if (defaultModel) body.defaultModel = defaultModel;

  try {
    if (editingId) {
      const updated = await api('PUT', `/providers/${editingId}`, body);
      providers = providers.map(p => p.id === editingId ? updated : p);
      toast('Instance updated', 'success');
    } else {
      const created = await api('POST', '/providers', body);
      providers.push(created);
      editingId = created.id;
      toast('Instance added — you can now test connection or list models', 'success');
    }
    renderProviders();
    updateSettingsProviderSelect();
    closeModal();
  } catch (e) {
    toast('Save failed: ' + e.message, 'error');
  }
}

// ── Test connection (modal) ────────────────────────────────────────────────────

async function testProvider() {
  const resultEl = document.getElementById('test-result');
  const btn = document.getElementById('btn-test');
  btn.textContent = 'Testing…';
  btn.disabled = true;
  resultEl.style.display = 'none';

  try {
    let result;
    if (editingId) {
      result = await api('POST', `/providers/${editingId}/test`);
    } else {
      const { type, name, baseURL, defaultModel, enabled } = getFormBody();
      result = await api('POST', '/providers/test-inline', { type, name, baseURL, defaultModel, enabled });
    }
    const failHint = !result.ok ? ' — is Ollama running? Try: ollama serve' : '';
    resultEl.textContent = (result.ok ? '✓ ' : '✗ ') + result.message + failHint;
    resultEl.className = `test-result ${result.ok ? 'success' : 'error'}`;
    resultEl.style.display = 'block';
  } catch (e) {
    resultEl.textContent = '✗ ' + e.message;
    resultEl.className = 'test-result error';
    resultEl.style.display = 'block';
  }

  btn.textContent = 'Test Connection';
  btn.disabled = false;
}

// ── List models (modal) ───────────────────────────────────────────────────────

async function listModels() {
  const dropdown = document.getElementById('models-dropdown');
  dropdown.innerHTML = '<div style="padding:10px;color:var(--text-muted)">Loading models…</div>';
  dropdown.style.display = 'block';

  try {
    let models;
    if (editingId) {
      models = await api('GET', `/providers/${editingId}/models`);
    } else {
      const { type, name, baseURL, defaultModel, enabled } = getFormBody();
      models = await api('POST', '/providers/list-models-inline', { type, name, baseURL, defaultModel, enabled });
    }

    let html = '';
    models.forEach(m => {
      html += `<div class="model-option" onclick="selectModel('${esc(m.id)}')">
        <div class="model-option-name">${esc(m.id)}</div>
        <div class="model-option-ctx">${m.name !== m.id ? esc(m.name || '') : ''}</div>
      </div>`;
    });

    if (html) {
      dropdown.innerHTML = html;
    } else {
      dropdown.innerHTML = `<div style="padding:12px;color:var(--warning);font-size:12px;line-height:1.6">
          No models found. Make sure Ollama is running:<br>
          <code style="color:var(--cyan)">ollama serve</code><br><br>
          Then pull a model, e.g.:<br>
          <code style="color:var(--cyan)">ollama pull qwen2.5-coder</code>
         </div>`;
    }
  } catch (e) {
    dropdown.innerHTML = `<div style="padding:10px;color:var(--error);font-size:12px;line-height:1.6">${esc(e.message)}<br><br>Make sure Ollama is running (<code style="color:var(--cyan)">ollama serve</code>) and the base URL is correct.</div>`;
  }
}

function selectModel(id) {
  document.getElementById('form-defaultmodel').value = id;
  document.getElementById('models-dropdown').style.display = 'none';
}

// ── Settings ──────────────────────────────────────────────────────────────────

async function loadSettings() {
  try {
    config = await api('GET', '/config');
    document.getElementById('setting-active-model').value = config.activeModel || '';
    document.getElementById('setting-max-tokens').value = config.maxTokens || 8192;
    document.getElementById('setting-temperature').value = config.temperature || 0;
    document.getElementById('setting-temperature-val').textContent = (config.temperature || 0).toFixed(2);
    updateSettingsProviderSelect();
  } catch (e) {
    toast('Failed to load settings', 'error');
  }
}

function updateSettingsProviderSelect() {
  const sel = document.getElementById('setting-active-provider');
  if (!sel) return;
  const current = config.activeProvider;
  sel.innerHTML = '<option value="">— None —</option>' +
    providers.map(p => `<option value="${p.id}"${p.id === current ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
}

document.getElementById('setting-temperature').addEventListener('input', (e) => {
  document.getElementById('setting-temperature-val').textContent = parseFloat(e.target.value).toFixed(2);
});

document.getElementById('btn-save-settings').addEventListener('click', async () => {
  try {
    await api('PATCH', '/config', {
      activeProvider: document.getElementById('setting-active-provider').value || null,
      activeModel: document.getElementById('setting-active-model').value,
      maxTokens: parseInt(document.getElementById('setting-max-tokens').value, 10),
      temperature: parseFloat(document.getElementById('setting-temperature').value),
    });
    config = await api('GET', '/config');
    renderProviders();
    toast('Settings saved', 'success');
  } catch (e) {
    toast('Save failed: ' + e.message, 'error');
  }
});

// ── Tools ─────────────────────────────────────────────────────────────────────

async function loadTools() {
  const list = document.getElementById('tools-list');
  list.innerHTML = '<p style="color:var(--text-muted);padding:20px">Loading tools...</p>';
  try {
    const tools = await api('GET', '/tools');
    const TOOL_ICONS = {
      bash: '💻', read: '📖', write: '✏️', edit: '🔧',
      glob: '🔍', grep: '🔎', web_fetch: '🌐', list_dir: '📁', http_request: '🔗',
    };
    list.innerHTML = tools.map(t => `
      <div class="tool-card">
        <div class="tool-icon">${TOOL_ICONS[t.name] || '⚙️'}</div>
        <div>
          <div class="tool-name">${esc(t.name)}</div>
          <div class="tool-desc">${esc(t.description)}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = `<p style="color:var(--error)">Failed to load tools: ${esc(e.message)}</p>`;
  }
}

// ── Wiring ────────────────────────────────────────────────────────────────────

document.getElementById('btn-add-provider').addEventListener('click', showAddForm);

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────

loadProviders();
