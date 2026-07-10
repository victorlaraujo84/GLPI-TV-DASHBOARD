// ── content.js ─────────────────────────────────────────────────
// Roda em todas as páginas que batem com host_permissions.
// Função principal: detectar se estamos numa página do GLPI
// e sinalizar ao background que a página está pronta.
//
// O scraping em si acontece via executeScript no background.js —
// este arquivo serve como camada de diagnóstico e fallback.
// ───────────────────────────────────────────────────────────────

(function () {
  // Verifica se é uma página do GLPI
  const isGLPI =
    document.querySelector('meta[name="glpi"]') !== null ||
    document.querySelector('div#page') !== null ||
    document.title.toLowerCase().includes('glpi') ||
    window.location.pathname.includes('/front/ticket') ||
    window.location.pathname.includes('/glpi/');

  if (!isGLPI) return;

  // Sinaliza ao background que a página está pronta
  chrome.runtime.sendMessage({ type: 'GLPI_PAGE_READY', url: window.location.href });

  // Escuta pedidos de extração direta (alternativa ao executeScript)
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'EXTRACT_NOW') {
      sendResponse({ data: extractVisible(msg.mode || 'open') });
    }
  });

  function extractVisible(mode) {
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
    }

    const rows = document.querySelectorAll(
      'tbody tr[class*="tab_bg"], tbody tr.odd, tbody tr.even, tbody tr[id^="ticket"], tbody tr'
    );
    const result = [];

    rows.forEach((row) => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 2) return;

      const idLink = row.querySelector('a[href*="ticket"]');
      const id = parseInt(
        idLink?.href?.match(/id=(\d+)/)?.[1] || tds[0]?.innerText?.trim()
      );
      if (!id) return;

      result.push({
        id,
        title: row.querySelector('a')?.innerText?.trim() || tds[1]?.innerText?.trim() || '',
        status: tds[2]?.innerText?.trim() || '',
        urgency: tds[3]?.innerText?.trim() || '',
        user: tds[4]?.innerText?.trim() || '',
        assignee: tds[5]?.innerText?.trim() || '',
        group: tds[6]?.innerText?.trim() || '',
        date: tds[7]?.innerText?.trim() || '',
        sla: null,
        mode,
      });
    });

    return result;
  }
})();
