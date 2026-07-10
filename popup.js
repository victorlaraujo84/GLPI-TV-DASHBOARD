const CONFIG_KEY = 'glpi_config';
const STORAGE_KEY = 'glpi_data';

// ── CARD DEFINITIONS (id do card no dashboard, label) ──
const CARD_DEFS = [
    { id: 'm-open-card', label: 'Abertos' },
    { id: 'm-crit-card', label: 'Críticos' },
    { id: 'm-sla-card', label: 'SLA < 60min' },
    { id: 'm-expired-card', label: 'Expirados (Semana)' },
    { id: 'm-solved-card', label: 'Solucionados Hoje' },
    { id: 'm-solved-week-card', label: 'Solucionados Semana' },
    { id: 'm-lote-card', label: 'Card Especial (Regras)' },
];

function toast(msg, color = '#4ade80') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.color = color;
    setTimeout(() => { el.style.display = 'none'; }, 2500);
}

// ─── TAB NAVIGATION ──────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
});

// ─── STATE ───────────────────────────────────────────────────────
let currentConfig = { profiles: [], activeProfileId: null };

// ─── FIELD REFS ──────────────────────────────────────────────────
const pSelect = document.getElementById('profileSelect');
const fOpen = document.getElementById('urlOpen');
const fSolved = document.getElementById('urlSolved');
const fWeek = document.getElementById('urlSolvedWeek');
const fInterval = document.getElementById('interval');
const fSnew = document.getElementById('soundNew');
const fScrit = document.getElementById('soundCrit');
const fTitle = document.getElementById('dashTitle');
const fLocMap = document.getElementById('locationMap');
const fWebhookTeams = document.getElementById('webhookTeams');
const fWebhookGoogle = document.getElementById('webhookGoogle');
const fApiKeySai = document.getElementById('apiKeySai');
const fTelegramBotToken = document.getElementById('telegramBotToken');
const fTelegramGlobalChatId = document.getElementById('telegramGlobalChatId');

// ─── PLAY BUTTONS ────────────────────────────────────────────────
document.getElementById('btnPlayNew')?.addEventListener('click', () => {
    const url = fSnew?.value?.trim();
    if (url) {
        new Audio(url).play().catch(e => toast('Erro ao reproduzir áudio', '#fa6060'));
    } else {
        toast('Nenhuma URL de áudio inserida', '#fa6060');
    }
});

document.getElementById('btnPlayCrit')?.addEventListener('click', () => {
    const url = fScrit?.value?.trim();
    if (url) {
        new Audio(url).play().catch(e => toast('Erro ao reproduzir áudio', '#fa6060'));
    } else {
        toast('Nenhuma URL de áudio inserida', '#fa6060');
    }
});

// ─── PROFILE HELPERS ─────────────────────────────────────────────
function getActiveProfile() {
    return currentConfig.profiles.find(x => x.id === currentConfig.activeProfileId)
        || currentConfig.profiles[0];
}

function renderProfiles() {
    if (!pSelect) return;
    pSelect.innerHTML = '';
    currentConfig.profiles.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        pSelect.appendChild(opt);
    });
    pSelect.value = currentConfig.activeProfileId;
    loadProfileToForm(currentConfig.activeProfileId);
}

function loadProfileToForm(profileId) {
    const p = currentConfig.profiles.find(x => x.id === profileId) || currentConfig.profiles[0];
    if (!p) return;
    fOpen.value = p.urlOpen || '';
    fSolved.value = p.urlSolved || '';
    fWeek.value = p.urlSolvedWeek || '';
    fInterval.value = p.intervalMin || 1;
    if (fSnew) fSnew.value = p.soundNew || '';
    if (fScrit) fScrit.value = p.soundCrit || '';
    if (fTitle) fTitle.value = p.dashTitle || '';
    if (fLocMap) fLocMap.value = p.locationMap ? JSON.stringify(p.locationMap, null, 2) : '';
    renderRules(p.groupRules || []);
    renderCardToggles(p.hiddenCards || []);
    renderContacts(p.contacts || []);
    if (fWebhookTeams) fWebhookTeams.value = p.webhookTeams || '';
    if (fWebhookGoogle) fWebhookGoogle.value = p.webhookGoogle || '';
    if (fApiKeySai) fApiKeySai.value = p.apiKeySai || '';
    if (fTelegramBotToken) fTelegramBotToken.value = p.telegramBotToken || '';
    if (fTelegramGlobalChatId) fTelegramGlobalChatId.value = p.telegramGlobalChatId || '';
}

function saveFormToProfile() {
    const p = getActiveProfile();
    if (!p) return;
    p.urlOpen = fOpen.value.trim();
    p.urlSolved = fSolved.value.trim();
    p.urlSolvedWeek = fWeek.value.trim();
    p.intervalMin = parseInt(fInterval.value) || 1;
    if (fSnew) p.soundNew = fSnew.value.trim();
    if (fScrit) p.soundCrit = fScrit.value.trim();
    if (fTitle) p.dashTitle = fTitle.value.trim();
    // Location Map
    if (fLocMap && fLocMap.value.trim()) {
        try { p.locationMap = JSON.parse(fLocMap.value); }
        catch { toast('JSON do Mapa inválido', '#fa6060'); }
    } else {
        p.locationMap = null; // null => usa o padrão do dashboard
    }
    // Rules
    p.groupRules = collectRules();
    // Cards
    p.hiddenCards = collectHiddenCards();
    // Contacts
    p.contacts = collectContacts();
    if (fWebhookTeams) p.webhookTeams = fWebhookTeams.value.trim();
    if (fWebhookGoogle) p.webhookGoogle = fWebhookGoogle.value.trim();
    if (fApiKeySai) p.apiKeySai = fApiKeySai.value.trim();
    if (fTelegramBotToken) p.telegramBotToken = fTelegramBotToken.value.trim();
    if (fTelegramGlobalChatId) p.telegramGlobalChatId = fTelegramGlobalChatId.value.trim();
}

// ─── GROUPING RULES ──────────────────────────────────────────────
function renderRules(rules) {
    const list = document.getElementById('rules-list');
    if (!list) return;
    list.innerHTML = '';
    rules.forEach((r, i) => addRuleRow(r.keyword, r.group, i));
}

function addRuleRow(keyword = '', group = '', idx) {
    const list = document.getElementById('rules-list');
    const row = document.createElement('div');
    row.style = 'display:flex; gap:4px; align-items:center;';
    row.innerHTML = `
        <input type="text" placeholder="Palavra-chave" value="${keyword}"
            style="flex:1; background:#161b28; border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:5px 8px; font-size:11px; color:#e8ecf4; outline:none;">
        <span style="color: rgba(232,236,244,0.3); font-size:11px;">→</span>
        <input type="text" placeholder="Grupo destino" value="${group}"
            style="flex:1; background:#161b28; border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:5px 8px; font-size:11px; color:#e8ecf4; outline:none;">
        <button style="background: rgba(246,59,59,0.15); border:1px solid rgba(246,59,59,0.4); border-radius:4px; color:#fa6060; cursor:pointer; padding:4px 7px; font-size:11px;" data-del>✕</button>`;
    row.querySelector('[data-del]').addEventListener('click', () => row.remove());
    list.appendChild(row);
}

function collectRules() {
    const rows = document.querySelectorAll('#rules-list > div');
    const rules = [];
    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const keyword = inputs[0].value.trim();
        const group = inputs[1].value.trim();
        if (keyword && group) rules.push({ keyword, group });
    });
    return rules;
}

document.getElementById('btnAddRule')?.addEventListener('click', () => addRuleRow());

document.getElementById('btnSaveRules')?.addEventListener('click', () => {
    saveFormToProfile();
    persistConfig(false);
    toast('✓ Regras salvas');
});

// ─── CARD TOGGLES ────────────────────────────────────────────────
function renderCardToggles(hiddenCards) {
    const container = document.getElementById('cards-toggles');
    if (!container) return;
    container.innerHTML = '';
    CARD_DEFS.forEach(def => {
        const isHidden = hiddenCards.includes(def.id);
        const row = document.createElement('label');
        row.style = 'display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none;';
        row.innerHTML = `
            <input type="checkbox" data-card="${def.id}" ${isHidden ? '' : 'checked'}
                style="accent-color: #3b82f6; width:15px; height:15px; cursor:pointer;">
            <span style="font-size:12px; color: #e8ecf4;">${def.label}</span>`;
        container.appendChild(row);
    });
}

function collectHiddenCards() {
    const hidden = [];
    document.querySelectorAll('#cards-toggles [data-card]').forEach(cb => {
        if (!cb.checked) hidden.push(cb.dataset.card);
    });
    return hidden;
}

document.getElementById('btnSaveCards')?.addEventListener('click', () => {
    saveFormToProfile();
    persistConfig(false);
    toast('✓ Cards salvos');
});

// ─── CONTACTS (Roteamento Fila → Telegram) ───────────────────────────
function renderContacts(contacts) {
    const list = document.getElementById('contacts-list');
    if (!list) return;
    list.innerHTML = '';
    contacts.forEach(c => addContactRow(c));
}

function addContactRow(c = { name: '', queue: '', telegramChatId: '', active: true }) {
    const list = document.getElementById('contacts-list');
    const row = document.createElement('div');
    row.style = 'background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 10px; display: flex; flex-direction: column; gap: 8px;';
    row.innerHTML = `
        <div style="display:flex; gap:6px; align-items:center;">
            <input type="text" placeholder="Nome / Descrição" value="${c.name || ''}" data-field="name"
                style="flex:2; background:#161b28; border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:5px 8px; font-size:11px; color:#e8ecf4; outline:none;">
            <label style="display:flex; align-items:center; gap:4px; cursor:pointer; white-space:nowrap;">
                <input type="checkbox" data-field="active" ${c.active !== false ? 'checked' : ''} style="width:14px; height:14px; accent-color:#3b82f6;">
                <span style="font-size:10px; color:rgba(255,255,255,0.4)">Ativo</span>
            </label>
        </div>
        <div style="display:flex; gap:6px;">
            <input type="text" placeholder="Fila GLPI (palavra-chave ex: N1, Impressora...)" value="${c.queue || ''}" data-field="queue"
                style="flex:1; background:#161b28; border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:5px 8px; font-size:11px; color:#e8ecf4; outline:none;">
            <input type="text" placeholder="Telegram Chat ID (-100... ou ID pessoal)" value="${c.telegramChatId || ''}" data-field="telegramChatId"
                style="flex:1; background:#161b28; border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:5px 8px; font-size:11px; color:#e8ecf4; outline:none; font-family:monospace;">
            <button style="background: rgba(246,59,59,0.1); border:1px solid rgba(246,59,59,0.3); border-radius:4px; color:#fa6060; cursor:pointer; padding:4px 8px; font-size:12px;" data-del-contact>✕</button>
        </div>
    `;
    row.querySelector('[data-del-contact]').addEventListener('click', () => row.remove());
    list.appendChild(row);
}

function collectContacts() {
    const list = document.getElementById('contacts-list');
    if (!list) return [];
    const rows = list.querySelectorAll(':scope > div');
    const contacts = [];
    rows.forEach(row => {
        const name = row.querySelector('[data-field="name"]')?.value.trim() || '';
        const queue = row.querySelector('[data-field="queue"]')?.value.trim() || '';
        const telegramChatId = row.querySelector('[data-field="telegramChatId"]')?.value.trim() || '';
        const active = row.querySelector('[data-field="active"]')?.checked !== false;
        if (queue || telegramChatId) {
            contacts.push({ name, queue, telegramChatId, active });
        }
    });
    return contacts;
}

document.getElementById('btnAddContact')?.addEventListener('click', () => addContactRow());

document.getElementById('btnSaveContacts')?.addEventListener('click', () => {
    saveFormToProfile();
    persistConfig(false);
    toast('✓ Contatos salvos');
});

// ─── PROFILE SELECTOR ────────────────────────────────────────────
pSelect?.addEventListener('change', (e) => {
    saveFormToProfile();
    currentConfig.activeProfileId = e.target.value;
    loadProfileToForm(currentConfig.activeProfileId);
    persistConfig(false);
});

document.getElementById('btnNewProfile')?.addEventListener('click', () => {
    const name = prompt('Nome do Novo Perfil de Operação:');
    if (!name?.trim()) return;
    saveFormToProfile();
    const newId = 'prof_' + Date.now();
    currentConfig.profiles.push({
        id: newId, name: name.trim(),
        urlOpen: '', urlSolved: '', urlSolvedWeek: '', intervalMin: 5,
        soundNew: '', soundCrit: '', dashTitle: '',
        groupRules: [], hiddenCards: [], locationMap: null,
        contacts: [], webhookTeams: '', webhookGoogle: '', apiKeySai: 'oR/CU4a890qIKP7sdfsafdaf',
        telegramBotToken: '', telegramGlobalChatId: ''
    });
    currentConfig.activeProfileId = newId;
    renderProfiles();
    persistConfig(false);
});

document.getElementById('btnDelProfile')?.addEventListener('click', () => {
    if (currentConfig.profiles.length <= 1) { alert('Você não pode excluir o último perfil.'); return; }
    if (confirm('Tem certeza que deseja excluir o perfil atual?')) {
        currentConfig.profiles = currentConfig.profiles.filter(x => x.id !== currentConfig.activeProfileId);
        currentConfig.activeProfileId = currentConfig.profiles[0].id;
        renderProfiles();
        persistConfig(false);
    }
});

// ─── MAIN SAVE ───────────────────────────────────────────────────
function persistConfig(runScraper = true) {
    chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', config: currentConfig }, () => {
        if (runScraper) toast('✓ Salvo — coleta iniciada');
    });
}

document.getElementById('btnSave')?.addEventListener('click', () => {
    saveFormToProfile();
    persistConfig(true);
});

document.getElementById('btnRefresh')?.addEventListener('click', () => {
    saveFormToProfile();
    chrome.storage.local.set({ [CONFIG_KEY]: currentConfig }, () => {
        chrome.runtime.sendMessage({ type: 'FORCE_REFRESH' }, () => toast('↻ Scraping executado'));
    });
});

document.getElementById('btnDash')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

// ─── BOOT: LOAD STORAGE ──────────────────────────────────────────
chrome.storage.local.get(CONFIG_KEY, (res) => {
    let cfg = res[CONFIG_KEY];
    if (!cfg || !cfg.profiles) {
        cfg = {
            profiles: [{
                id: 'default', name: 'Operação Padrão',
                urlOpen: cfg?.urlOpen || '', urlSolved: cfg?.urlSolved || '',
                urlSolvedWeek: cfg?.urlSolvedWeek || '', intervalMin: cfg?.intervalMin || 5,
                soundNew: cfg?.soundNew || '', soundCrit: cfg?.soundCrit || '',
                dashTitle: '', groupRules: [], hiddenCards: [], locationMap: null,
                contacts: [], webhookTeams: '', webhookGoogle: '', apiKeySai: 'oR/CU4a890qIKP7sdfsafdaf',
                telegramBotToken: '', telegramGlobalChatId: ''
            }],
            activeProfileId: 'default'
        };
        chrome.storage.local.set({ [CONFIG_KEY]: cfg });
    }
    // Migra perfis antigos que não têm os campos novos
    cfg.profiles.forEach(p => {
        if (!p.groupRules) p.groupRules = [];
        if (!p.hiddenCards) p.hiddenCards = [];
        if (!('locationMap' in p)) p.locationMap = null;
        if (!p.dashTitle) p.dashTitle = '';
        if (!p.contacts) p.contacts = [];
        if (!p.webhookTeams) p.webhookTeams = '';
        if (!p.webhookGoogle) p.webhookGoogle = '';
        if (!p.apiKeySai) p.apiKeySai = 'oR/CU4a890qIKP7sdfsafdaf';
        if (!p.telegramBotToken) p.telegramBotToken = '';
        if (!p.telegramGlobalChatId) p.telegramGlobalChatId = '';
        // Migra contatos antigos com phone/group para novo formato
        p.contacts = (p.contacts || []).map(c => ({
            name: c.name || '',
            queue: c.queue || '',
            telegramChatId: c.telegramChatId || '',
            active: c.active !== false
        }));
    });
    currentConfig = cfg;
    renderProfiles();
});

// ─── STATUS BAR ──────────────────────────────────────────────────
chrome.storage.local.get(STORAGE_KEY, (res) => {
    const data = res[STORAGE_KEY];
    if (data) {
        const dot = document.getElementById('statusDot');
        const txt = document.getElementById('statusText');
        const last = document.getElementById('lastUpdate');
        if (dot) dot.classList.remove('off');
        if (txt) txt.textContent = `${data.openTickets?.length || 0} abertos · ${data.solvedTickets?.length || 0} solucionados`;
        if (last) last.textContent = data.scrapedAt ? new Date(data.scrapedAt).toLocaleTimeString('pt-BR') : '—';
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'DATA_UPDATED') {
        const d = msg.payload;
        const dot = document.getElementById('statusDot');
        const txt = document.getElementById('statusText');
        const last = document.getElementById('lastUpdate');
        if (dot) dot.classList.remove('off');
        if (txt) txt.textContent = `${d.openTickets?.length || 0} abertos · ${d.solvedTickets?.length || 0} solucionados`;
        if (last) last.textContent = new Date().toLocaleTimeString('pt-BR');
    }
});
