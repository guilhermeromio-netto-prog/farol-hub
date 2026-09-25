// Utilidades de interface — Farol (byGui)

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Converte texto com HTML (ex.: resumo de RSS) em texto puro. */
export function textoPuro(html, max = 0) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  let t = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  if (max && t.length > max) t = t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
  return t;
}

export const icone = (id, cls = '') => `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const reais = (n) => BRL.format(Math.round(Number(n) || 0));
export const faixa = (a, b) => `${reais(a)} – ${reais(b)}`;
export const numero = (n, casas = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas }).format(Number(n) || 0);
export const arred = (n, passo = 50) => Math.round((Number(n) || 0) / passo) * passo;

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function dataCurta(iso) {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
export function diaSemana(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}
export function dataLonga(iso) {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  const t = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
export function tempoRelativo(data) {
  const d = data instanceof Date ? data : new Date(data);
  if (isNaN(d)) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  if (diff < 3600) return rtf.format(-Math.max(1, Math.round(diff / 60)), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (diff < 86400 * 30) return rtf.format(-Math.round(diff / 86400), 'day');
  return d.toLocaleDateString('pt-BR');
}

export function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const bandeira = (cc, w = 40) => (cc ? `https://flagcdn.com/w${w}/${String(cc).toLowerCase()}.png` : '');

/* ---------- skeletons e estados ---------- */
export const skLinhas = (n = 3) => Array.from({ length: n }, (_, i) => `<div class="sk sk--linha${i === n - 1 ? ' sk--curta' : ''}"></div>`).join('');
export const skCards = (n = 3, cls = 'grid grid--3') => `<div class="${cls}" aria-hidden="true">${Array.from({ length: n }, () => '<div class="sk sk--card"></div>').join('')}</div>`;
export const carregandoHTML = (rotulo = 'Carregando…', n = 3) => `<div role="status" aria-live="polite"><span class="sr-only">${esc(rotulo)}</span><div aria-hidden="true">${skLinhas(n)}</div></div>`;

export function erroHTML(msg, { tentar = true } = {}) {
  return `<div class="erro" role="alert"><strong>Não deu para carregar</strong>${esc(msg)}${tentar ? '<br><button type="button" class="btn btn--fantasma btn--pequeno" data-acao="tentar">Tentar de novo</button>' : ''}</div>`;
}
export const vazioHTML = (msg) => `<div class="vazio">${esc(msg)}</div>`;

/* ---------- toasts ---------- */
export function toast(msg, tipo = 'info', ms = 4200) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.innerHTML = `<span>${esc(msg)}</span><button type="button" aria-label="Fechar aviso">×</button>`;
  const fechar = () => {
    el.classList.add('is-saindo');
    setTimeout(() => el.remove(), 220);
  };
  el.querySelector('button').addEventListener('click', fechar);
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(fechar, ms);
}

/* ---------- confirmação acessível ---------- */
export function confirmar({ titulo, texto, ok = 'Apagar' }) {
  const dlg = document.getElementById('dialogo');
  if (!dlg || typeof dlg.showModal !== 'function') return Promise.resolve(window.confirm(`${titulo}\n\n${texto}`));
  dlg.querySelector('#dialogo-titulo').textContent = titulo;
  dlg.querySelector('#dialogo-texto').textContent = texto;
  dlg.querySelector('#dialogo-ok').textContent = ok;
  const anterior = document.activeElement;
  return new Promise((resolve) => {
    dlg.addEventListener('close', function fim() {
      dlg.removeEventListener('close', fim);
      resolve(dlg.returnValue === 'ok');
      if (anterior && anterior.isConnected) anterior.focus();
    });
    dlg.returnValue = '';
    dlg.showModal();
    dlg.querySelector('button[value="cancelar"]').focus();
  });
}

export const prefereMenosMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- abas acessíveis reutilizáveis ---------- */
let _abasSeq = 0;
/** abas: [[id, rotulo]]. Devolve {html, prefixo}. Painéis vazios para preencher depois. */
export function abasHTML(abas, ativa, rotuloGrupo, cls = '') {
  const p = 'ab' + (++_abasSeq);
  const html = `<div class="abas ${cls}" role="tablist" aria-label="${esc(rotuloGrupo)}">${abas.map(([k, r]) => `<button type="button" class="aba" role="tab" id="${p}-t-${k}" data-aba="${k}" aria-controls="${p}-p-${k}" aria-selected="${k === ativa}" tabindex="${k === ativa ? 0 : -1}">${r}</button>`).join('')}</div>
    ${abas.map(([k]) => `<section class="painel" role="tabpanel" id="${p}-p-${k}" data-painel="${k}" aria-labelledby="${p}-t-${k}" tabindex="0" ${k === ativa ? '' : 'hidden'}></section>`).join('')}`;
  return { html, prefixo: p };
}
export function ligarAbas(raiz, onTroca = () => {}) {
  const abas = [...raiz.querySelectorAll(':scope > .abas > [role="tab"]')];
  const ativar = (btn, focar = true) => {
    abas.forEach((b) => { const on = b === btn; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; const pn = raiz.querySelector('#' + b.getAttribute('aria-controls')); if (pn) pn.hidden = !on; });
    if (focar) btn.focus();
    onTroca(btn.dataset.aba);
  };
  abas.forEach((b, i) => {
    b.addEventListener('click', () => ativar(b));
    b.addEventListener('keydown', (ev) => {
      let j = null;
      if (ev.key === 'ArrowRight') j = (i + 1) % abas.length;
      if (ev.key === 'ArrowLeft') j = (i - 1 + abas.length) % abas.length;
      if (ev.key === 'Home') j = 0;
      if (ev.key === 'End') j = abas.length - 1;
      if (j !== null) { ev.preventDefault(); ativar(abas[j]); }
    });
  });
  return { ativar: (k) => { const b = abas.find((x) => x.dataset.aba === k); if (b) ativar(b, false); } };
}

export const dataBR = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : '');
export const reaisCentavos = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
export const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
