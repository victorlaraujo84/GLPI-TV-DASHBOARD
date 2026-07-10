const CONFIG_KEY = 'glpi_config';
const STORAGE_KEY = 'glpi_data';

const DEFAULT_CONFIG = {
  urlOpen: '',
  urlSolved: '',
  intervalMin: 5
};

// ── CICLO DE VIDA ────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(CONFIG_KEY, (res) => {
    if (!res[CONFIG_KEY]) {
      chrome.storage.local.set({ [CONFIG_KEY]: DEFAULT_CONFIG });
    }
  });
  startAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  startAlarms();
});

function startAlarms() {
  chrome.storage.local.get(CONFIG_KEY, (res) => {
    let min = 5;
    const c = res[CONFIG_KEY];
    if (c) {
      if (c.profiles && c.activeProfileId) {
        const p = c.profiles.find(x => x.id === c.activeProfileId);
        if (p) min = p.intervalMin || 5;
      } else {
        min = c.intervalMin || 5;
      }
    }
    chrome.alarms.create('GLPI_POLLING', { periodInMinutes: min });
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'GLPI_POLLING') {
    runScraper();
  }
});

// ── MENSAGENS ───────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SAVE_CONFIG') {
    chrome.storage.local.set({ [CONFIG_KEY]: msg.config }, () => {
      startAlarms();
      runScraper();
      sendResponse({ status: 'ok' });
    });
    return true;
  }
  if (msg.type === 'FORCE_REFRESH') {
    runScraper();
    sendResponse({ status: 'ok' });
    return true;
  }
  if (msg.type === 'MANUAL_NOTIFY') {
    getConfig().then(cfg => {
      processUrgentTicket(msg.ticket, cfg).then(() => {
        sendResponse({ status: 'ok' });
      }).catch(err => {
        console.error(err);
        sendResponse({ status: 'error', error: err.message });
      });
    });
    return true;
  }
});

// ── CORE SCRAPER ────────────────────────────────────────────────
async function runScraper() {
  const cfg = await getConfig();
  if (!cfg.urlOpen) return;

  const windowsOpen = await new Promise(resolve => {
    chrome.windows.getAll({}, (windows) => {
      if (chrome.runtime.lastError) { /* ignora erro */ }
      resolve(windows && windows.length > 0);
    });
  });

  if (!windowsOpen) {
    console.warn("Nenhuma janela do navegador aberta. Scraper abortado.");
    return;
  }

  try {
    const tabOpen = await createHiddenTab(cfg.urlOpen);
    const dataOpen = await scrapeTabAndHandleLimit(tabOpen.id);
    await chrome.tabs.remove(tabOpen.id).catch(() => { });

    // Aborta ciclo para evitar zerar o dash em timeouts ou falhas de parse do GLPI
    if (dataOpen.error === 'TABLE_NOT_FOUND' || dataOpen.error === 'SCRAPE_FAILED' || dataOpen.error === 'LIMIT_CHANGED_RELOADING') {
      console.warn("Falha ao raspar a página principal. Abortando este ciclo para evitar zerar o dashboard.");
      return;
    }

    let dataSolved = { tickets: [] };
    if (cfg.urlSolved) {
      const tabSolved = await createHiddenTab(cfg.urlSolved);
      dataSolved = await scrapeTabAndHandleLimit(tabSolved.id);
      await chrome.tabs.remove(tabSolved.id).catch(() => { });
    }

    let dataSolvedWeek = { tickets: [] };
    if (cfg.urlSolvedWeek) {
      const tabSolvedWeek = await createHiddenTab(cfg.urlSolvedWeek);
      dataSolvedWeek = await scrapeTabAndHandleLimit(tabSolvedWeek.id);
      await chrome.tabs.remove(tabSolvedWeek.id).catch(() => { });
    }

    // Calcula Expirados (Soluções tardias na semana)
    let expiredWeekCount = 0;
    if (dataSolvedWeek.tickets) {
      dataSolvedWeek.tickets.forEach(t => {
        if (t.solDate && t.slaText) {
          const parseDate = (str) => {
            let m = str.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
            return m ? new Date(m[3], m[2] - 1, m[1], m[4], m[5]) : null;
          };
          const sol = parseDate(t.solDate);
          const deadline = parseDate(t.slaText);
          if (sol && deadline && sol >= deadline) {
            expiredWeekCount++;
          }
        }
      });
    }

    const payload = {
      openTickets: dataOpen.tickets || [],
      solvedTickets: dataSolved.tickets || [],
      solvedWeekTickets: dataSolvedWeek.tickets || [],
      expiredCount: expiredWeekCount,
      urlOpen: cfg.urlOpen,
      scrapedAt: new Date().getTime(),
      error: dataOpen.error || null
    };

    chrome.storage.local.set({ [STORAGE_KEY]: payload }, () => {
      chrome.runtime.sendMessage({ type: 'DATA_UPDATED', payload }).catch(() => { });
    });

    // --- NOTIFICAÇÃO DE CHAMADOS URGENTES ---
    handleUrgentNotifications(payload.openTickets, cfg);

  } catch (err) {
    console.error('Erro no scraper:', err);
  }
}

function createHiddenTab(url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!tab || !tab.id) {
        return reject(new Error("Não foi possível criar a aba. Aba não retornada."));
      }
      // Espera carregar um pouco, aumenta o tempo para evitar falhas em filas grandes
      setTimeout(() => resolve(tab), 10000);
    });
  });
}

function scrapeTab(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId },
      func: extractGLPIData
    }, (results) => {
      if (chrome.runtime.lastError) {
        return resolve({ tickets: [], error: 'SCRAPE_FAILED' });
      }
      if (results && results[0]?.result) {
        resolve(results[0].result);
      } else {
        resolve({ tickets: [], error: 'SCRAPE_FAILED' });
      }
    });
  });
}

async function scrapeTabAndHandleLimit(tabId) {
  let data = await scrapeTab(tabId);
  if (data && data.error === 'LIMIT_CHANGED_RELOADING') {
    // Aguarda o recarregamento da página (ajax ou form submit)
    await new Promise(resolve => setTimeout(resolve, 6000));
    data = await scrapeTab(tabId);
  }
  return data;
}

// ── FUNÇÃO INJETADA ──────────────────────────────────────────────
function extractGLPIData() {
  const limitSelect = document.querySelector('.search-limit-dropdown');
  if (limitSelect && limitSelect.value !== '10000') {
    limitSelect.value = '10000';
    limitSelect.dispatchEvent(new Event('change', { bubbles: true }));
    const form = limitSelect.closest('form');
    if (form) {
      try {
        const btn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (btn) btn.click();
        else form.submit();
      } catch (e) { }
    }
    return { tickets: [], error: 'LIMIT_CHANGED_RELOADING' };
  }

  const table = document.querySelector('table.search-results') ||
    document.querySelector('.table-responsive-lg table') ||
    document.querySelector('table.tab_cadre_fixehov');

  if (!table) return { tickets: [], error: 'TABLE_NOT_FOUND' };

  if (document.querySelector('form#form_login') || document.title.toLowerCase().includes('login')) {
    return { tickets: [], error: 'SESSION_EXPIRED' };
  }

  const headers = Array.from(table.querySelectorAll('thead th'));
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  const colMap = {};

  headers.forEach((th, idx) => {
    const text = th.innerText.toLowerCase().trim();
    if (text === 'id' || text === '#') colMap.id = idx;
    else if (text.includes('título') || text.includes('titulo')) colMap.title = idx;
    else if (text.includes('solicitante') || text.includes('requerente')) colMap.user = idx;
    else if (text.includes('urgência') || text.includes('urgencia')) colMap.urgency = idx;
    // Mapeia status apenas pelo cabeçalho exato "status" ou "estado",
    // ignorando colunas de item/equipamento que possam conter "status" como substring
    else if (text === 'status' || text === 'estado' || text === 'situação') colMap.status = idx;
    else if (!colMap.status && (text.includes('status') || text.includes('estado'))) colMap.status = idx;
    else if (text.includes('grupo')) colMap.group = idx;
    else if (text.includes('atribuído') || text.includes('tecnico') || text.includes('técnico')) colMap.assignee = idx;
    else if (text.includes('tempo para solução') || text.includes('sla')) colMap.sla = idx;
    else if (text.includes('data de solução')) colMap.solDate = idx;
    else if (text.includes('atualização') || text.includes('abertura')) colMap.date = idx;
    else if (text.includes('tempo interno para') || text.includes('tempo limite para') || text.includes('sla')) colMap.sla = idx;
  });

  const tickets = rows.map(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) return null;

    // ── DATA DE ABERTURA ──
    let openingDate = null;
    if (colMap.date !== undefined && cells[colMap.date]) {
      const dRaw = cells[colMap.date].innerText.trim();
      let dMatch = dRaw.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
      if (dMatch) {
        openingDate = new Date(dMatch[3], dMatch[2] - 1, dMatch[1], dMatch[4], dMatch[5]);
      }
    }

    // ── SLA: Cálculo manual via Tempo Decorrido vs Tempo Total ──
    let slaText = '';
    let slaPercent = 0;
    let slaColor = 'var(--accent)';
    let slaMinutes = null;

    if (colMap.sla !== undefined) {
      const cell = cells[colMap.sla];
      if (cell) {
        const dateSpan = cell.querySelector('.text-nowrap') || cell.querySelector('span');
        slaText = dateSpan ? dateSpan.innerText.trim() : cell.innerText.split('\n')[0].trim();

        // Tenta pegar a data limite (deadline)
        let deadlineDate = null;
        let dMatch = slaText.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
        if (dMatch) {
          deadlineDate = new Date(dMatch[3], dMatch[2] - 1, dMatch[1], dMatch[4], dMatch[5]);
        }

        const now = new Date();

        if (openingDate && deadlineDate) {
          const totalAllowed = deadlineDate - openingDate;
          const elapsed = now - openingDate;

          if (totalAllowed > 0) {
            slaPercent = Math.round((elapsed / totalAllowed) * 100);
          }

          slaMinutes = Math.round((deadlineDate - now) / 60000);
        } else {
          // Fallback se não conseguir calcular precisamente
          const progressBar = cell.querySelector('.progress-bar');
          if (progressBar) {
            slaPercent = parseInt(progressBar.getAttribute('aria-valuenow')) || 0;
          }
        }

        // Cor baseada no status
        if (slaMinutes !== null || slaPercent >= 100) {
          if (slaMinutes < 0 || slaPercent >= 100) {
            slaColor = '#f55d5d'; // Expirado
          } else if (slaMinutes <= 60) {
            slaColor = '#ffac33'; // Alerta
          } else if (slaPercent < 50) {
            slaColor = '#adf567'; // Tranquilo
          } else {
            slaColor = '#7da1e8'; // Normal
          }
        }
      }
    }

    // ── Solicitante: Captura nome e setor (se disponível) ──
    let userName = 'N/I';
    let userSector = '';
    if (colMap.user !== undefined) {
      const userCell = cells[colMap.user];
      if (userCell) {
        // Nome principal
        const nameLink = userCell.querySelector('a');
        userName = (nameLink ? nameLink.innerText : userCell.innerText.split('\n')[0]).trim() || 'N/I';

        // Busca agressiva via Regex caso o querySelector falhe (devido a shadow dom ou aninhamento complexo)
        const html = userCell.innerHTML;
        const catMatch = html.match(/title="Categoria"[^>]*>([\s\S]*?)<\/div>/i) ||
          html.match(/title="Localização"[^>]*>([\s\S]*?)<\/div>/i);

        if (catMatch) {
          // Limpa o HTML (remove tags de ícone e espaços)
          let raw = catMatch[1].replace(/<[^>]*>/g, '').trim();
          userSector = raw.replace(/\s\s+/g, ' ');

          // Pega o último nível se houver hierarquia
          if (userSector.includes('>')) {
            userSector = userSector.split('>').pop().trim();
          }
        } else {
          // Tenta via DOM se o Regex não bater
          const sectorEl = userCell.querySelector('[title="Categoria"]') ||
            userCell.querySelector('[title="Localização"]');
          if (sectorEl) {
            userSector = sectorEl.innerText.trim();
          }
        }
      }
    }

    // ── Técnico Atribuído ──
    let assignee = '';
    if (colMap.assignee !== undefined && cells[colMap.assignee]) {
      assignee = cells[colMap.assignee].innerText.trim();
    }

    // Fallback estrutural: Procura em todas as células por um link de usuário (padrão GLPI para técnico)
    if (!assignee || assignee === '') {
      for (let i = 0; i < cells.length; i++) {
        if (i === colMap.user) continue; // Ignora a coluna do solicitante
        const userLink = cells[i].querySelector('a[href*="user.form.php"]');
        if (userLink) {
          let raw = cells[i].innerText.split('\n')[0].trim();
          if (raw) {
            assignee = raw;
            break;
          }
        }
      }
    }

    // Segundo Fallback: Abaixo do título
    if ((!assignee || assignee === '') && colMap.title !== undefined) {
      const titleCell = cells[colMap.title];
      const lines = titleCell.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 1) {
        assignee = lines[1];
      }
    }

    // Limpeza final (remove ruídos de scripts se houver)
    assignee = assignee.split(/[\/\<\[]/)[0].trim();
    assignee = assignee.replace(/^(Técnico|Atribuído a|Responsável):\s*/i, '').trim();

    let urgRaw = (cells[colMap.urgency]?.innerText || 'media').toLowerCase();
    let urgency = 'media';
    if (urgRaw.includes('crítica') || urgRaw.includes('alta') || urgRaw.includes('muito alta')) urgency = 'critica';
    else if (urgRaw.includes('baixa')) urgency = 'baixa';

    // Extrai status corretamente: pega apenas a primeira linha de texto que
    // NÃO seja um número puro (patrimônio de equipamento)
    let statusRaw = 'N/A';
    if (colMap.status !== undefined && cells[colMap.status]) {
      const statusCell = cells[colMap.status];
      // Tenta pegar via span de ícone ou badge (padrão GLPI moderno)
      const statusBadge = statusCell.querySelector('.badge, .status-badge, [class*="status"], span[title]');
      if (statusBadge && statusBadge.innerText.trim() && !/^\d+$/.test(statusBadge.innerText.trim())) {
        statusRaw = statusBadge.innerText.trim();
      } else {
        // Percorre as linhas de texto da célula e pega a primeira que não seja número puro
        const lines = statusCell.innerText.split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0 && !/^\d+$/.test(l));
        statusRaw = lines[0] || statusCell.innerText.trim() || 'N/A';
      }
    }

    return {
      id: cells[colMap.id]?.innerText.trim() || '?',
      title: cells[colMap.title]?.innerText.split('\n')[0].trim() || 'Sem Título',
      user: userName,
      userSector: userSector,
      urgency: urgency,
      status: statusRaw,
      assignee: assignee,
      group: cells[colMap.group]?.innerText.trim() || 'Geral',
      date: cells[colMap.date]?.innerText.trim() || '',
      solDate: cells[colMap.solDate]?.innerText.trim() || '',
      slaText: slaText,
      slaPercent: slaPercent,
      slaColor: slaColor,
      slaMinutes: slaMinutes
    };
  }).filter(t => t !== null && t.id.length > 2);

  return { tickets };
}

// ── NOTIFICAÇÕES ──────────────────────────────────────────────────
async function handleUrgentNotifications(tickets, cfg) {
  if (!cfg.contacts || cfg.contacts.length === 0) return;

  const storage = await chrome.storage.local.get('notified_tickets');
  const notified = storage.notified_tickets || [];
  const now = new Date().getTime();

  // Limpa IDs antigos (mais de 24h) para não crescer infinitamente
  const cleanNotified = notified.filter(n => (now - n.time) < 86400000);

  for (const t of tickets) {
    const isCritical = t.urgency === 'critica';
    const isSlaWarning = t.slaMinutes !== null && t.slaMinutes >= 0 && t.slaMinutes <= 60;

    if (!isCritical && !isSlaWarning) continue;
    if (cleanNotified.find(n => n.id === t.id)) continue;

    console.log(`Novo chamado crítico/SLA urgente detectado: ${t.id}`);

    // Processa notificação
    await processUrgentTicket(t, cfg);

    cleanNotified.push({ id: t.id, time: now });
  }

  chrome.storage.local.set({ notified_tickets: cleanNotified });
}

async function processUrgentTicket(ticket, cfg) {
  const baseUrl = cfg.urlOpen ? cfg.urlOpen.split('/front/')[0] : '';
  const ticketUrl = baseUrl
    ? `${baseUrl}/front/ticket.form.php?id=${ticket.id}`
    : `Chamado #${ticket.id}`;

  let tabId = null;

  try {
    // 1. Abre chamado em aba oculta para pegar descricao
    let description = 'Descricao nao extraida.';
    if (baseUrl) {
      const tab = await createHiddenTab(ticketUrl);
      tabId = tab.id;
      description = await getTicketDescription(tab.id);
      await chrome.tabs.remove(tabId).catch(() => { });
      tabId = null;
    }

    // 2. Resume com SAI APP
    const summary = await summarizeWithSaiApp(description, cfg.apiKeySai);

    const isSlaWarning = ticket.slaMinutes !== null && ticket.slaMinutes >= 0 && ticket.slaMinutes <= 60;
    const prefix = isSlaWarning
      ? `⏰ SLA EXPIRANDO EM ${ticket.slaMinutes} MINUTOS`
      : `🚨 CHAMADO CRÍTICO`;

    // 3. Monta Mensagem (Markdown compativel com Telegram e Teams)
    const message =
      `${prefix} #${ticket.id}\n` +
      `Fila: ${ticket.group || 'N/D'}\n` +
      `Solicitante: ${ticket.user || 'N/I'}\n` +
      `Setor: ${ticket.userSector || 'N/I'}\n` +
      `Titulo: ${ticket.title}\n\n` +
      `Resumo SAI APP: ${summary}\n\n` +
      `Tecnico: ${ticket.assignee || 'Nao atribuido'}\n\n` +
      `Link: ${ticketUrl}`;

    // Versao HTML para Telegram (mais segura contra caracteres especiais)
    const escapeHtml = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    };

    const messageHtml =
      `<b>${isSlaWarning ? '⏰' : '🔔'} ${prefix} #${ticket.id}</b>\n` +
      `<b>Fila:</b> ${escapeHtml(ticket.group || 'N/D')}\n` +
      `<b>Solicitante:</b> ${escapeHtml(ticket.user || 'N/I')}\n` +
      `<b>Setor:</b> ${escapeHtml(ticket.userSector || 'N/I')}\n` +
      `<b>Título:</b> ${escapeHtml(ticket.title)}\n\n` +
      `<b>Resumo:</b> ${escapeHtml(summary)}\n\n` +
      `<b>Técnico:</b> ${escapeHtml(ticket.assignee || 'Não atribuído')}\n \n` +
      `<a href="${ticketUrl}">Abrir Chamado</a>`;

    // 4. Envia Webhooks Teams e Google Chat
    if (cfg.webhookTeams) await sendWebhook(cfg.webhookTeams, { text: message }, 'teams');
    if (cfg.webhookGoogle) await sendWebhook(cfg.webhookGoogle, { text: message }, 'gchat');

    // 5. Telegram -- Canal Global (todos os alertas urgentes)
    if (cfg.telegramBotToken && cfg.telegramGlobalChatId) {
      await sendTelegram(cfg.telegramBotToken, cfg.telegramGlobalChatId, messageHtml);
    }

    // 6. Telegram -- Roteamento por Fila (contatos)
    if (cfg.telegramBotToken && cfg.contacts && cfg.contacts.length > 0) {
      for (const c of cfg.contacts) {
        if (!c.active) continue;
        if (!c.telegramChatId) continue;
        const keyword = (c.queue || '').toLowerCase().trim();
        if (!keyword) continue;
        const inGroup = (ticket.group || '').toLowerCase().includes(keyword);
        const inTitle = (ticket.title || '').toLowerCase().includes(keyword);
        if (inGroup || inTitle) {
          await sendTelegram(cfg.telegramBotToken, c.telegramChatId, messageHtml);
          console.log(`Telegram enviado para ${c.name || c.telegramChatId} (fila: ${c.queue})`);
        }
      }
    }

  } catch (err) {
    if (tabId) {
      chrome.tabs.remove(tabId).catch(() => { });
    }
    console.error(`Erro ao processar notificacao do chamado ${ticket.id}:`, err);
  }
}


async function getTicketDescription(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const descEl = document.querySelector('.rich_text_container') ||
          document.querySelector('[name="content"]') ||
          document.querySelector('.ticket_description');
        return descEl ? descEl.innerText.trim() : "Descrição não encontrada";
      }
    }, (results) => {
      resolve(results?.[0]?.result || "Erro ao extrair descrição");
    });
  });
}

async function summarizeWithSaiApp(text, apiKey) {
  // Chave padrão se não houver no config
  const finalKey = apiKey || "oR/CU4a890qIKP7sdfsafdaf";
  const templateId = "6a3bea1c9020bef3d7f423a5";

  try {
    const response = await fetch(`https://sai-library.saiapplications.com/api/templates/${templateId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': finalKey
      },
      body: JSON.stringify({
        inputs: {
          "input": text
        }
      })
    });
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return data.output || data.result || (data.data ? data.data.output : null) || text.substring(0, 200) + "...";
    } else {
      // Se não for JSON, pegamos como texto bruto (provavelmente o resumo direto)
      const rawText = await response.text();
      return rawText || text.substring(0, 200) + "...";
    }
  } catch (e) {
    console.error("Erro SAI APP:", e);
    return text.substring(0, 200) + "... (Erro na API SAI APP)";
  }
}

async function sendWebhook(url, payload, type = 'generic') {
  try {
    let body = payload;
    if (type === 'teams') {
      // Teams aceita MessageCard simples
      body = { '@type': 'MessageCard', '@context': 'https://schema.org/extensions', 'text': payload.text };
    }
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) { console.error('Erro no Webhook:', e); }
}

async function sendTelegram(botToken, chatId, message) {
  if (!botToken || !chatId) return;
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    const data = await response.json();
    if (!data.ok) {
      console.error('Telegram API erro:', data.description, '| chat_id:', chatId);
    } else {
      console.log('Telegram enviado com sucesso para chat_id:', chatId);
    }
  } catch (e) {
    console.error('Erro ao enviar Telegram:', e);
  }
}

async function getConfig() {
  const res = await chrome.storage.local.get(CONFIG_KEY);
  const c = res[CONFIG_KEY];
  if (!c) return DEFAULT_CONFIG;
  if (c.profiles && c.activeProfileId) {
    const p = c.profiles.find(x => x.id === c.activeProfileId);
    const cfg = p || DEFAULT_CONFIG;
    // Garante campos novos no config retornado
    if (!cfg.telegramBotToken) cfg.telegramBotToken = '';
    if (!cfg.telegramGlobalChatId) cfg.telegramGlobalChatId = '';
    if (!cfg.contacts) cfg.contacts = [];
    return cfg;
  }
  return c || DEFAULT_CONFIG;
}

