// Compartilhamento (WhatsApp + Web Share API) e briefing codificado na URL. Farol · byGui
import { esc, icone, toast } from './ui.js';
import { TRANSPORTES, ORCAMENTOS, RITMOS, DIAS, MESES_OPCOES } from './planner.js';

export const urlCompleta = (hash) => location.origin + location.pathname + hash;

const b64url = {
  de(texto) {
    const bytes = new TextEncoder().encode(texto);
    let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  para(cod) {
    const s = cod.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s + '==='.slice((s.length + 3) % 4));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  },
};

/** Briefing → texto curto base64url (vai em #/planejar?b=...). */
export function codificarBrief(b) {
  const m = { d: b.destination, o: b.origin || '', t: b.transport, a: b.activities || [], w: (b.wish || '').slice(0, 280), n: b.days, v: b.travelers, g: b.budget, m: b.month, p: b.pace };
  if (b.lat != null && b.lon != null && !isNaN(b.lat)) { m.la = Math.round(b.lat * 1e4) / 1e4; m.lo = Math.round(b.lon * 1e4) / 1e4; }
  return b64url.de(JSON.stringify(m));
}

/** Decodifica e valida; devolve briefing ou null. */
export function decodificarBrief(cod, interessesValidos = []) {
  try {
    if (!/^[A-Za-z0-9_-]{8,3000}$/.test(cod)) return null;
    const m = JSON.parse(b64url.para(cod));
    const str = (x, max) => (typeof x === 'string' ? x.slice(0, max) : '');
    const dest = str(m.d, 80).trim();
    if (dest.length < 2) return null;
    const escolha = (x, lista, padrao) => (lista.includes(x) ? x : padrao);
    const b = {
      destination: dest,
      origin: str(m.o, 80),
      transport: escolha(m.t, TRANSPORTES.map((t) => t.id), 'car'),
      activities: Array.isArray(m.a) ? m.a.filter((x) => interessesValidos.includes(x)).slice(0, 12) : [],
      wish: str(m.w, 800),
      days: escolha(Number(m.n), DIAS, 7),
      travelers: escolha(Number(m.v), [1, 2, 3, 4, 5, 6], 2),
      budget: escolha(m.g, ORCAMENTOS.map((o) => o.id), '5-10'),
      month: escolha(String(m.m), MESES_OPCOES.map((x) => x.id), 'flex'),
      pace: escolha(m.p, RITMOS.map((r) => r.id), 'equilibrado'),
      lat: null, lon: null,
    };
    const la = Number(m.la), lo = Number(m.lo);
    if (isFinite(la) && isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180 && m.la != null) { b.lat = la; b.lon = lo; }
    return b;
  } catch { return null; }
}

/** HTML dos botões. O de WhatsApp é um link real (funciona sem JS extra). */
export function htmlCompartilhar(rotulo = 'Compartilhar') {
  return `<div class="compartilhar" data-compartilhar>
    <a class="btn btn--whats" data-whats href="https://wa.me/" target="_blank" rel="noopener noreferrer">${icone('i-whats')} WhatsApp<span class="sr-only"> (abre em nova aba)</span></a>
    <button type="button" class="btn btn--fantasma" data-share hidden>${icone('i-compartilhar')} ${esc(rotulo)}</button>
    <button type="button" class="btn btn--fantasma" data-copiar>Copiar link</button>
  </div>`;
}

/** Liga os botões. obter() → { titulo, texto, url } (lido na hora do clique). */
export function ligarCompartilhar(raiz, obter) {
  raiz.querySelectorAll('[data-compartilhar]:not([data-ligado])').forEach((box) => {
    box.dataset.ligado = '1';
    const w = box.querySelector('[data-whats]');
    const s = box.querySelector('[data-share]');
    const c = box.querySelector('[data-copiar]');
    const atualizar = () => { const x = obter(); w.href = 'https://wa.me/?text=' + encodeURIComponent(`${x.texto}\n\n${x.url}`); };
    atualizar();
    ['pointerdown', 'focus', 'keydown'].forEach((ev) => w.addEventListener(ev, atualizar));
    if (navigator.share) {
      s.hidden = false;
      s.addEventListener('click', async () => {
        const x = obter();
        try { await navigator.share({ title: x.titulo, text: x.texto, url: x.url }); }
        catch (e) { if (e && e.name !== 'AbortError') toast('Não foi possível abrir o compartilhamento do aparelho.', 'erro'); }
      });
    }
    c.addEventListener('click', async () => {
      const x = obter();
      try { await navigator.clipboard.writeText(x.url); toast('Link copiado.', 'ok'); }
      catch { window.prompt('Copie o link:', x.url); }
    });
  });
}
