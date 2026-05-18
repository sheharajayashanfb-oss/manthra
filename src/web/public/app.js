// State
let providers = [];
let config = {};
let editingId = null;

// Provider metadata
const PROVIDER_META = {
  anthropic:      { icon: '🟠', label: 'Anthropic', needsKey: true, hasBaseUrl: false, hasApiVersion: false },
  openai:         { icon: '🟢', label: 'OpenAI', needsKey: true, hasBaseUrl: false, hasApiVersion: false },
  'azure-openai': { icon: '🔵', label: 'Azure OpenAI', needsKey: true, hasBaseUrl: true, hasApiVersion: true },
  gemini:         { icon: '🟡', label: 'Google Gemini', needsKey: true, hasBaseUrl: false, hasApiVersion: false },
  ollama:         { icon: '🟣', label: 'Ollama', needsKey: false, hasBaseUrl: true, hasApiVersion: false, defaultUrl: 'http://127.0.0.1:11434' },
  lmstudio:       { icon: '🩵', label: 'LM Studio', needsKey: false, hasBaseUrl: true, hasApiVersion: false, defaultUrl: 'http://127.0.0.1:1234' },
  openrouter:     { icon: '🔀', label: 'OpenRouter', needsKey: true, hasBaseUrl: false, hasApiVersion: false, hasFree: true },
  zen:            { icon: '⚡', label: 'ZEN (OpenCode)', needsKey: true, hasBaseUrl: false, hasApiVersion: false, hasFree: true },
  'custom-openai':{ icon: '⚙️', label: 'Custom OpenAI-compatible', needsKey: true, hasBaseUrl: true, hasApiVersion: false },
};

const API_KEY_HINTS = {
  anthropic:      'Get your API key at console.anthropic.com',
  openai:         'Get your API key at platform.openai.com',
  'azure-openai': 'Find your key in Azure portal → Cognitive Services → Keys',
  gemini:         'Get your API key at aistudio.google.com',
  openrouter:     'Get a free API key at openrouter.ai — free models available without billing',
  zen:            'Get your API key at opencode.ai — free models: Big Pickle, DeepSeek V4 Flash, and more',
  'custom-openai':'API key for your custom endpoint (leave blank or use "none" if no auth required)',
};

const BASE_URL_HINTS = {
  'azure-openai': 'e.g. https://your-resource.openai.azure.com',
  ollama: 'Default: http://localhost:11434',
  lmstudio: 'Default: http://localhost:1234',
  'custom-openai': 'Base URL of your OpenAI-compatible API',
};

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
    toast('Failed to load providers: ' + e.message, 'error');
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
    const meta = PROVIDER_META[p.type] || { icon: '⚡', label: p.type };
    const isActive = p.id === config.activeProvider;

    const card = document.createElement('div');
    card.className = `provider-card type-${p.type}${isActive ? ' active-card' : ''}`;

    // Status badges row
    const badges = [];
    if (PROVIDER_META[p.type]?.hasFree) {
      badges.push('<span class="badge-free">has free</span>');
    }
    if (isActive) {
      badges.push('<span class="badge badge-current">● Current</span>');
    } else if (!p.enabled) {
      badges.push('<span class="badge badge-disabled">● Disabled</span>');
    }

    card.innerHTML = `
      <div class="provider-card-header">
        <div class="provider-info">
          <div class="provider-icon">${meta.icon}</div>
          <div>
            <div class="provider-name">${esc(p.name)}</div>
            <div class="provider-type">${meta.label || p.type}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          ${badges.join('')}
        </div>
      </div>
      <div class="provider-card-body">
        ${p.defaultModel ? `<div class="provider-detail"><span class="provider-detail-label">Model</span><span class="provider-detail-value">${esc(p.defaultModel)}</span></div>` : ''}
        ${p.baseURL ? `<div class="provider-detail"><span class="provider-detail-label">Endpoint</span><span class="provider-detail-value">${esc(p.baseURL)}</span></div>` : ''}
        ${p.apiKey ? `<div class="provider-detail"><span class="provider-detail-label">API Key</span><span class="provider-detail-value">${esc(p.apiKey)}</span></div>` : ''}
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
    toast(`Active provider → ${provider.name}`, 'success');
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  }
}

async function deleteProvider(id) {
  const p = providers.find(p => p.id === id);
  if (!p || !confirm(`Delete provider "${p.name}"?`)) return;
  try {
    await api('DELETE', `/providers/${id}`);
    providers = providers.filter(p => p.id !== id);
    if (config.activeProvider === id) config.activeProvider = '';
    renderProviders();
    toast('Provider deleted', 'success');
  } catch (e) {
    toast('Delete failed: ' + e.message, 'error');
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function showAddForm() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add Provider';
  document.getElementById('provider-form').reset();
  document.getElementById('form-provider-id').value = '';
  document.getElementById('form-enabled').checked = true;
  resetTypeFields('');
  document.getElementById('test-result').style.display = 'none';
  document.getElementById('models-dropdown').style.display = 'none';
  showModal();
}

function editProvider(id) {
  const p = providers.find(p => p.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Provider';
  document.getElementById('form-provider-id').value = id;
  document.getElementById('form-type').value = p.type;
  document.getElementById('form-name').value = p.name;
  document.getElementById('form-apikey').value = p.apiKey || '';
  document.getElementById('form-baseurl').value = p.baseURL || '';
  document.getElementById('form-apiversion').value = p.apiVersion || '';
  document.getElementById('form-defaultmodel').value = p.defaultModel || '';
  document.getElementById('form-enabled').checked = p.enabled !== false;
  onTypeChange(p.type);
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

function onTypeChange(type) {
  const meta = PROVIDER_META[type] || {};
  resetTypeFields(type);

  const keyField = document.getElementById('field-apikey');
  keyField.style.display = meta.needsKey !== false ? 'block' : 'none';
  document.getElementById('apikey-hint').textContent = API_KEY_HINTS[type] || '';

  const urlField = document.getElementById('field-baseurl');
  urlField.style.display = meta.hasBaseUrl ? 'block' : 'none';
  document.getElementById('baseurl-hint').textContent = BASE_URL_HINTS[type] || '';
  if (meta.defaultUrl && !document.getElementById('form-baseurl').value) {
    document.getElementById('form-baseurl').value = meta.defaultUrl;
  }

  document.getElementById('field-apiversion').style.display = meta.hasApiVersion ? 'block' : 'none';
  document.getElementById('btn-list-models').style.display = type ? 'inline-flex' : 'none';
}

function resetTypeFields(type) {
  if (!type) {
    document.getElementById('field-apikey').style.display = 'block';
    document.getElementById('field-baseurl').style.display = 'none';
    document.getElementById('field-apiversion').style.display = 'none';
    document.getElementById('btn-list-models').style.display = 'none';
  }
}

function toggleApiKey() {
  const input = document.getElementById('form-apikey');
  const btn = document.querySelector('.toggle-visibility');
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}

// ── Save provider ─────────────────────────────────────────────────────────────

function getFormBody() {
  const type = document.getElementById('form-type').value;
  const name = document.getElementById('form-name').value.trim();
  const apiKey = document.getElementById('form-apikey').value.trim();
  const baseURL = document.getElementById('form-baseurl').value.trim();
  const apiVersion = document.getElementById('form-apiversion').value.trim();
  const defaultModel = document.getElementById('form-defaultmodel').value.trim();
  const enabled = document.getElementById('form-enabled').checked;
  return { type, name, apiKey, baseURL, apiVersion, defaultModel, enabled };
}

async function saveProvider() {
  const { type, name, apiKey, baseURL, apiVersion, defaultModel, enabled } = getFormBody();

  if (!type) { toast('Please select a provider type', 'error'); return; }
  if (!name) { toast('Please enter a display name', 'error'); return; }

  const body = { type, name, enabled };
  if (apiKey && !apiKey.startsWith('***')) body.apiKey = apiKey;
  if (baseURL) body.baseURL = baseURL;
  if (apiVersion) body.apiVersion = apiVersion;
  if (defaultModel) body.defaultModel = defaultModel;

  try {
    if (editingId) {
      const updated = await api('PUT', `/providers/${editingId}`, body);
      providers = providers.map(p => p.id === editingId ? updated : p);
      toast('Provider updated', 'success');
    } else {
      const created = await api('POST', '/providers', body);
      providers.push(created);
      editingId = created.id; // so test/models work after add
      toast('Provider added — you can now test connection or list models', 'success');
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
      // Test saved provider
      result = await api('POST', `/providers/${editingId}/test`);
    } else {
      // Test with current form values (no save needed)
      const { type, name, apiKey, baseURL, apiVersion, defaultModel, enabled } = getFormBody();
      if (!type) { toast('Select a provider type first', 'error'); btn.textContent = 'Test Connection'; btn.disabled = false; return; }
      const body = { type, name, enabled };
      if (apiKey && !apiKey.startsWith('***')) body.apiKey = apiKey;
      if (baseURL) body.baseURL = baseURL;
      if (apiVersion) body.apiVersion = apiVersion;
      if (defaultModel) body.defaultModel = defaultModel;
      result = await api('POST', '/providers/test-inline', body);
    }
    const type = document.getElementById('form-type').value;
    const isOllama = type === 'ollama' || type === 'lmstudio';
    const failHint = (!result.ok && isOllama)
      ? ' — is Ollama running? Try: ollama serve'
      : '';
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
      // Fetch models using current form values (no save needed)
      const { type, name, apiKey, baseURL, apiVersion, defaultModel, enabled } = getFormBody();
      if (!type) { dropdown.innerHTML = '<div style="padding:10px;color:var(--error)">Select a provider type first</div>'; return; }
      const body = { type, name, enabled };
      if (apiKey && !apiKey.startsWith('***')) body.apiKey = apiKey;
      if (baseURL) body.baseURL = baseURL;
      if (apiVersion) body.apiVersion = apiVersion;
      if (defaultModel) body.defaultModel = defaultModel;
      models = await api('POST', '/providers/list-models-inline', body);
    }

    const free = models.filter(m => m.plan === 'free');
    const rest = models.filter(m => m.plan !== 'free');
    const ordered = [...free, ...rest];

    let html = '';
    if (free.length > 0) {
      html += `<div style="padding:6px 12px 2px;font-size:11px;color:#34d399;font-weight:600;letter-spacing:.5px">FREE MODELS</div>`;
    }
    ordered.forEach((m, i) => {
      if (i === free.length && rest.length > 0) {
        html += `<div style="padding:6px 12px 2px;font-size:11px;color:var(--text-muted);font-weight:600;letter-spacing:.5px">PAID / PREVIEW</div>`;
      }
      html += `<div class="model-option" onclick="selectModel('${esc(m.id)}')">
        <div class="model-option-name">${esc(m.id)}${planBadgeHTML(m.plan)}</div>
        <div class="model-option-ctx">${m.name !== m.id ? esc(m.name || '') + ' · ' : ''}${m.contextWindow ? (m.contextWindow/1000).toFixed(0)+'k ctx' : ''}</div>
      </div>`;
    });
    if (html) {
      dropdown.innerHTML = html;
    } else {
      const type = document.getElementById('form-type').value;
      const isOllama = type === 'ollama' || type === 'lmstudio';
      dropdown.innerHTML = isOllama
        ? `<div style="padding:12px;color:var(--warning);font-size:12px;line-height:1.6">
            No models found. Make sure Ollama is running:<br>
            <code style="color:var(--cyan)">ollama serve</code><br><br>
            Then pull a model, e.g.:<br>
            <code style="color:var(--cyan)">ollama pull llama3.2</code>
           </div>`
        : '<div style="padding:10px;color:var(--text-muted)">No models found</div>';
    }
  } catch (e) {
    const type = document.getElementById('form-type').value;
    const isOllama = type === 'ollama' || type === 'lmstudio';
    const hint = isOllama
      ? '<br><br>Make sure Ollama is running (<code style="color:var(--cyan)">ollama serve</code>) and the base URL is correct.'
      : '';
    dropdown.innerHTML = `<div style="padding:10px;color:var(--error);font-size:12px;line-height:1.6">${esc(e.message)}${hint}</div>`;
  }
}

function planBadgeHTML(plan) {
  if (!plan) return '';
  const styles = {
    free:    'background:#064e3b;color:#34d399;border:1px solid #065f46',
    paid:    'background:#1e1b4b;color:#818cf8;border:1px solid #312e81',
    preview: 'background:#451a03;color:#fbbf24;border:1px solid #78350f',
  };
  const style = styles[plan] || styles.paid;
  return `<span style="font-size:10px;padding:1px 6px;border-radius:10px;margin-left:6px;${style}">${plan}</span>`;
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
